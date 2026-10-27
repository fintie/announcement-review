# Announcement review

Unbranded browser-local workspace for reviewing Australian company disclosures.

## Features

- Company watchlist and announcement inbox
- Paste text or import UTF-8 text files
- Manual claim evidence labels, quotations and reviewer notes
- Daily brief and workspace exports
- Draft IMD request export (no task submission or payment)

## GitHub Pages

The Studio IMD terminal is hosted at https://announcement.nextgenius.com.au/terminal/. The existing homepage, market feed and community application remain at the root. Public IMD calls use the Render bridge; local Ollama review runs separately on the Mac.

Rebuild after frontend edits with `python3 studio/web/build_pages.py` (first install `npm ci --prefix studio/web`). Commit only source and generated assets; never commit `studio/data`, virtual environments, `.env` or `node_modules`.

The hosted client generates a request credential in page memory. Before leaving a page with orders, use **Network connection → Export request credential & order IDs**, then restore that file to recover private order data. The bridge forwards caller credentials without storing them.


In Settings → Pages, select **Deploy from a branch**, choose **main** and **/ (root)**, and save.

Expected URL: https://fintie.github.io/announcement-review/

## Data and limitations

All records and notes are stored in this browser's localStorage. Fictional samples are labelled. Live monitoring and IMD verification are not connected. GitHub Pages serves the public application; locally entered records are not uploaded by the app. No build or dependencies are required.

## Mac Studio local processing foundation

A separate persistent local review app is available in [`studio/`](studio/README.md).
Run `bash studio/start.sh`, then visit http://127.0.0.1:8765. It uses installed
local Ollama models and adds document upload, a durable queue, evidence review,
citation validation and JSON reports. Read the prototype limits before use.

## Full IMD client

The local Studio app now includes a Curve-inspired IMD terminal alongside local
reviews: jobs, workflows, oracle, network, publications, request composition and
wallet payment integration. See [studio/IMD_CLIENT.md](studio/IMD_CLIENT.md) for
usage, payment setup, supported scope and validation limits.
