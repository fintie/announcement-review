# Mac Studio local AI worker (experimental)

This is a **new foundation**, not a recovery of an earlier ZIP. It does not change the existing GitHub Pages app or Render bridge.

## Run on Mac Studio

Install Python 3.11+ and Ollama. From the repository root:

```bash
cd worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ollama list
export OLLAMA_MODEL=qwen2.5:7b  # replace with a model already installed
uvicorn app:app --host 127.0.0.1 --port 8765
```

Check `http://127.0.0.1:8765/health`. POST JSON to `/review` with a `text` field to extract **unverified draft** claims.

## Security and integration

Only bind to loopback. This endpoint has no authentication and **must not** be exposed directly to the Internet. No production frontend integration, job queue, Qdrant, PDF extraction, IMD network submission, or Render-to-Studio tunnel is included yet. Those require separate design, authentication, and testing. Never commit credentials or unpublished announcements.
