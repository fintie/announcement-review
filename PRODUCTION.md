# Production readiness checklist

## Current release boundary
The GitHub Pages application is a **single-browser, local-only research workspace**. It is not a production multi-user verification service. The Render service is a restricted public IMD proxy. The Mac Studio Ollama worker is an experimental loopback-only process.

## Before any multi-user production launch
- [ ] Select and implement an identity provider and role-based authorization for users and reviewers.
- [ ] Move sensitive records to durable encrypted server-side storage with access controls, backups, retention, and deletion policies.
- [ ] Add authenticated asynchronous job dispatch between Render and Mac Studio (no direct public worker port).
- [ ] Add PDF parsing, document limits, antivirus scanning and prompt-injection defenses.
- [ ] Verify source provenance and support evidence-level audit logs and human review.
- [ ] Add request quotas, monitoring, structured logging, alerts and abuse controls.
- [ ] Add CI integration tests and staging deployment with rollback.
- [ ] Validate IMD API compatibility and terms; keep paid requests behind explicit user approval.
- [ ] Complete security review, privacy policy, incident response plan and load tests.
- [ ] Test real user journeys and accessibility.

## Safe local use
Do not enter confidential, unpublished market-sensitive, or third-party personal information into the browser prototype. Review exported data carefully before sharing. Never expose the unauthenticated local worker outside 127.0.0.1.

## Release gate
Do not advertise the service as independently verifying facts. Claim extraction is not verification. Do not merge to main or enable production traffic until the above controls are implemented and tested.
