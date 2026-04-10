---
name: run-proxy-local
description: Run the HomeApp FastAPI proxy (gcp/proxy/api) locally with the right env file, sys.path, and secret-prefixed routes. Use when the user asks to start, debug, or hit the proxy API on their machine, or when they get import errors like "No module named 'common'" or 404s on routes that should exist.
---

# Running the HomeApp proxy locally

## TL;DR
```bash
cd gcp/proxy/api
uvicorn main:app --host=0.0.0.0 --port=8080 --env-file=../.env --reload
```

The `.env` file lives at `gcp/proxy/.env` (one level up from `api/`). Don't pass an env file from the wrong directory or `core/config.py` will silently fall back to defaults.

## Why the working directory matters

`gcp/proxy/api/main.py` mutates `sys.path` to make `gcp/common` importable as `common.*`. The lookup is:

1. `_here.parent.parent` — works when you run from `gcp/proxy/api/` (the parent chain `…/gcp/proxy/api → …/gcp` puts `gcp` on the path so `common.*` resolves).
2. `_here` — works in Docker/Cloud Run, where GitHub Actions stages a copy of `gcp/common` next to `main.py` as `gcp/proxy/api/common`.

If you see `ModuleNotFoundError: No module named 'common'`:
- You probably ran uvicorn from the repo root or from `gcp/proxy/`. Run it from `gcp/proxy/api/`.
- Or you copied `common/` somewhere weird. The two layouts above are the only ones supported.

## Routing — the secret prefix

In `main.py`, agent / documents / service_broker / checkpoint / token_quota routers are **only mounted** when `FIREBASE_WEBHOOK_SECRET` is set, and they're mounted under `/{FIREBASE_WEBHOOK_SECRET}`. So a route like `/firebase-agent-stream` is actually at:

```
POST http://127.0.0.1:8080/<FIREBASE_WEBHOOK_SECRET>/firebase-agent-stream
```

The same pattern applies to Telegram (`TELEGRAM_WEBHOOK_SECRET`).

Two endpoints are exempt from the secret:
- `GET /health`
- `POST /token-quota-status` (also re-mounted under the secret prefix)

If a curl to a known endpoint returns 404, double-check you included the secret prefix.

## Env vars you need set (minimum)

From `gcp/proxy/api/core/config.py`:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `REASONING_ENGINE_ID` — must be a real, reachable Agent Engine or `stream_query` calls fail
- `FIREBASE_WEBHOOK_SECRET` — gates router mounting
- `TELEGRAM_WEBHOOK_SECRET` — only if you're testing the bot
- `USER_UPLOAD_TOPIC`, `USER_UPLOAD_RESULT_SUBSCRIPTION`, `GCS_BUCKET` — for upload + RAG flow
- `TOKEN_QUOTA_PERIOD_MAX_TOKENS` (optional) — global monthly cap

You also need ADC: `gcloud auth application-default login` (Firestore + Vertex calls fail without it).

## Hitting it

```bash
# Sanity
curl http://127.0.0.1:8080/health

# Token quota for a user (no secret needed)
curl -X POST http://127.0.0.1:8080/token-quota-status \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<firebase-uid>"}'

# Real agent stream — secret prefix required
SECRET=$FIREBASE_WEBHOOK_SECRET
curl -N -X POST "http://127.0.0.1:8080/$SECRET/firebase-agent-stream" \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<uid>","session_id":"<sid>","user_query":"hello"}'
```

For an end-to-end token-usage smoke test, use the included script (see the **check-token-quota** skill).

## Common gotchas
- The test suite for the proxy runs via `bash gcp/proxy/api/run_tests.sh` from `gcp/proxy/api/`.
- Don't run `python main.py` directly — `main.py` is only the ASGI app object; uvicorn imports it.
- If Pub/Sub background listeners log errors on startup, the topics/subscriptions in `USER_UPLOAD_*` env vars don't exist in your project. Create them or unset the vars for a quieter local run.
