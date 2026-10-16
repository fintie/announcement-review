"""Private pilot API: durable disclosure intake and outbound worker job leasing."""
import hashlib
import hmac
import json
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

DATABASE_URL = os.getenv("DATABASE_URL")
USER_KEY = os.getenv("PILOT_USER_KEY")
WORKER_KEY = os.getenv("WORKER_KEY")
SCHEMA = """
CREATE TABLE IF NOT EXISTS announcements (
 id uuid PRIMARY KEY, owner_id text NOT NULL, company text NOT NULL,
 title text NOT NULL, source_url text, published_date date,
 source_text text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jobs (
 id uuid PRIMARY KEY, announcement_id uuid NOT NULL REFERENCES announcements(id),
 owner_id text NOT NULL, status text NOT NULL DEFAULT 'queued',
 lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 result jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status, lease_until, created_at);
"""

@asynccontextmanager
async def lifespan(app):
    if not DATABASE_URL or not USER_KEY or not WORKER_KEY:
        raise RuntimeError("DATABASE_URL, PILOT_USER_KEY and WORKER_KEY are required")
    if len(USER_KEY) < 32 or len(WORKER_KEY) < 32 or USER_KEY == WORKER_KEY:
        raise RuntimeError("Use separate random 32+ character credentials")
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute(SCHEMA, prepare=False)
    yield

app = FastAPI(title="Announcement Review Pilot API", lifespan=lifespan, docs_url=None, redoc_url=None)

def auth(key, expected):
    if not key or not hmac.compare_digest(key, expected):
        raise HTTPException(401, "Unauthorized")

def user(authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ").strip() if authorization else "", USER_KEY)
    return "pilot"

def worker(authorization: str | None = Header(default=None)):
    auth(authorization.removeprefix("Bearer ").strip() if authorization else "", WORKER_KEY)
    return "worker"

def db():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        yield conn

class Announcement(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=500)
    source_url: str | None = Field(default=None, max_length=2000)
    published_date: str | None = None
    source_text: str = Field(min_length=1, max_length=40000)

class JobResult(BaseModel):
    result: dict = Field(default_factory=dict)
    error: str | None = Field(default=None, max_length=2000)

@app.get("/health")
def health():
    return {"ok": True, "service": "announcement-review-pilot"}

@app.post("/api/announcements", status_code=201)
def create_announcement(item: Announcement, owner=Depends(user), conn=Depends(db)):
    uid = str(__import__("uuid").uuid4())
    try:
        row = conn.execute(
            """INSERT INTO announcements (id, owner_id, company, title, source_url, published_date, source_text)
            VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id,company,title,source_url,published_date,created_at""",
            (uid, owner, item.company, item.title, item.source_url, item.published_date, item.source_text)
        ).fetchone()
        conn.commit()
        return row
    except psycopg.DataError:
        raise HTTPException(422, "Invalid announcement date")

@app.get("/api/announcements")
def list_announcements(owner=Depends(user), conn=Depends(db)):
    return conn.execute("""SELECT id,company,title,source_url,published_date,created_at
       FROM announcements WHERE owner_id=%s ORDER BY created_at DESC LIMIT 100""", (owner,)).fetchall()

@app.post("/api/announcements/{announcement_id}/review", status_code=202)
def queue_review(announcement_id: UUID, owner=Depends(user), conn=Depends(db)):
    existing = conn.execute("SELECT id FROM announcements WHERE id=%s AND owner_id=%s", (str(announcement_id), owner)).fetchone()
    if not existing:
        raise HTTPException(404, "Announcement not found")
    uid = str(__import__("uuid").uuid4())
    conn.execute("INSERT INTO jobs(id,announcement_id,owner_id) VALUES(%s,%s,%s)", (uid, str(announcement_id), owner))
    conn.commit()
    return {"job_id": uid, "status": "queued"}

@app.get("/api/jobs/{job_id}")
def get_job(job_id: UUID, owner=Depends(user), conn=Depends(db)):
    row = conn.execute("SELECT id,announcement_id,status,result,error,created_at,updated_at FROM jobs WHERE id=%s AND owner_id=%s",
                       (str(job_id), owner)).fetchone()
    if not row:
        raise HTTPException(404, "Job not found")
    return row

@app.post("/worker/lease")
def lease_job(_=Depends(worker), conn=Depends(db)):
    with conn.transaction():
        row = conn.execute("""SELECT j.id,j.announcement_id,a.source_text
          FROM jobs j JOIN announcements a ON a.id=j.announcement_id
          WHERE j.status='queued' OR (j.status='leased' AND j.lease_until < now() AND j.attempts < 3)
          ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1""").fetchone()
        if not row:
            return {"job": None}
        conn.execute("""UPDATE jobs SET status='leased',attempts=attempts+1,
          lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=%s""", (row["id"],))
        return {"job": row}

@app.post("/worker/jobs/{job_id}/complete")
def complete_job(job_id: UUID, payload: JobResult, _=Depends(worker), conn=Depends(db)):
    row = conn.execute("""UPDATE jobs SET status=%s,result=%s::jsonb,error=%s,
      updated_at=now(),lease_until=NULL WHERE id=%s AND status='leased' AND lease_until > now()
      RETURNING id""", ("failed" if payload.error else "completed",
                         json.dumps(payload.result), payload.error, str(job_id))).fetchone()
    if not row:
        raise HTTPException(409, "Job lease expired or not found")
    conn.commit()
    return {"ok": True}
