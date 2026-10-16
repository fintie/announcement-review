"""Local-only IMD announcement review worker. No public inbound access required."""
import os
import re
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import httpx

app = FastAPI(title="Announcement Review Local Worker")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

class ReviewRequest(BaseModel):
    text: str = Field(min_length=1, max_length=40000)
    model: str | None = None

@app.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
            models = [m.get("name") for m in response.json().get("models", [])]
        return {"ok": True, "ollama": True, "models": models}
    except Exception:
        return {"ok": True, "ollama": False, "models": []}

@app.post("/review")
async def review(req: ReviewRequest):
    model = req.model or MODEL
    prompt = ("Extract up to ten verifiable claims from the announcement. "
              "For each, quote the source text, identify evidence required and "
              "flag uncertainty. Do not invent external sources or claim verification. "
              "Return concise JSON with a claims array.\n\nAnnouncement:\n" + req.text)
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            result = await client.post(f"{OLLAMA_URL}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False,
                      "format": "json", "options": {"temperature": 0}})
            result.raise_for_status()
            output = result.json().get("response", "")
        return {"model": model, "draft": output, "verified": False}
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Local model unavailable: {type(exc).__name__}")
