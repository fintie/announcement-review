# Community Review and Threads — prototype

## What is implemented
- Every indexed news or public discussion URL opens `thread.html?url=<encoded-source-url>`.
- The article title, timestamp, source, and ASX ticker (when present in the headline) are prefilled from the existing public RSS index. **Full publisher text is not imported** because the current feed only contains titles and URLs and may be subject to copyright/subscription restrictions.
- A user supplies a display name and a comment. This is recorded as a **Community Review**, not as an independently verified fact-check.
- Replies are supported, and all users connected to the same API see the same thread.
- A clearly labeled **AI Bot** adds a neutral research question approximately once per four hours **only to threads with human activity**; it does not invent facts or impersonate users.
- Historical threads remain accessible after a headline leaves the 24-hour feed, provided the backend has stored the thread and is still reachable.

## Deployment and cost approval
The GitHub Pages front end is static. Multi-user discussion requires a separate Node service with persistent storage. The updated `render.yaml` is an **opt-in** Blueprint with a **paid Render Starter plan and persistent disk**. Do not deploy without approving the hosting charges. Render free ephemeral storage will lose comments on restarts or redeployments.

1. Review `render.yaml` and approve the recurring service and disk cost.
2. Deploy the Blueprint to Render, using the repository's main branch after merge.
3. Check `https://<service>/health` reports `ok: true` and `storage: configured`.
4. Open any `thread.html` page; paste the API HTTPS URL in Community service settings and click Connect. The URL is stored in the current browser only.
5. Test from two different browsers and confirm both users see the same comment and reply.

## Security and limitations
- Display names are **unverified** and can be impersonated. No account registration or authentication yet.
- IP rate limits, content length limits and origin allowlisting are basic controls, **not** a production anti-spam or moderation system.
- The server persists JSON on one mounted disk and serializes writes. It is suitable for a small pilot, not high-volume multi-instance production. Production should use PostgreSQL, authentication, reporting/moderation, deletion requests and abuse monitoring.
- Bot questions are static templates, not live LLM inference. The bot cannot certify facts and should not be presented as a human reviewer.
- The existing evidence-based local Review workflow remains separate from community comments. Community comments do not create a Solana Proof automatically.
- If the Community API is not deployed or connected, the page explains why posting is disabled; it does not pretend comments were shared.
