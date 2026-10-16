# Pilot API

Private pilot implementation of durable announcements and asynchronous review jobs.

Requires PostgreSQL and separate 32+ character secrets: `DATABASE_URL`, `PILOT_USER_KEY`, `WORKER_KEY`.

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Pilot-user endpoints require `Authorization: Bearer $PILOT_USER_KEY`.
Worker endpoints require `Authorization: Bearer $WORKER_KEY`.

This is **not** general-public user authentication. Do not embed the pilot key in a public frontend or browser bundle. Run behind HTTPS with rate limits, firewall rules and secret management. No public frontend is connected yet. Job leasing is at-least-once; consumers must tolerate retries. PDF intake, multi-user identity, audit logs and a production-ready retry/dead-letter mechanism remain future work.
