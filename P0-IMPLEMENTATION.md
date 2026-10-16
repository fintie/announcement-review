# P0 implementation status

Implemented on this branch:
- PostgreSQL-backed disclosure intake with a private pilot credential
- Review job creation and retrieval
- Atomic database job leasing for outbound Mac Studio workers
- Ollama JSON claim extraction, explicitly labelled unverified
- Separate worker credential; no public inbound Mac Studio port required

Not implemented:
- Public multi-user authentication and authorization
- Browser-to-API integration
- PDF ingestion, malware scanning and object storage
- Qdrant and independent-source retrieval
- IMD production execution, audit trails, billing and operational monitoring

## Setup sequence
1. Provision PostgreSQL and a private HTTPS API host.
2. Configure DATABASE_URL, PILOT_USER_KEY and WORKER_KEY (distinct long random values).
3. Install api/requirements.txt; start `uvicorn app:app --host 0.0.0.0 --port 8000` behind TLS and ingress protections.
4. On Mac Studio, install worker/requirements.txt and run `python poller.py` with PILOT_API_URL, WORKER_KEY and OLLAMA_MODEL.
5. Use a server-side client to POST an announcement to `/api/announcements` with PILOT_USER_KEY, then POST `/api/announcements/{id}/review`. GET `/api/jobs/{id}` to inspect the draft.

This is a staging foundation, **not** a complete production release. Never place PILOT_USER_KEY or WORKER_KEY in the GitHub Pages JavaScript.
