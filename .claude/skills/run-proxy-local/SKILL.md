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

## Routing — Firebase ID token (Phase 2.1)

User-facing routes are mounted at the **root** (no path secret):

```
POST http://127.0.0.1:8080/firebase-agent-stream
Authorization: Bearer <Firebase ID token>
```

Legacy prefix `/{FIREBASE_WEBHOOK_SECRET}/...` is still mounted when `ENABLE_LEGACY_SECRET_PREFIX=true` (default); clients should use the root URLs + Bearer.

`GET /health` is unauthenticated.

**Local dev without tokens:** set `DISABLE_FIREBASE_AUTH=true` in `gcp/proxy/.env` and send `user_id` / `userId` in the JSON body (pytest uses this).

Telegram still uses `/{TELEGRAM_WEBHOOK_SECRET}/...`.

## Env vars you need set (minimum)

From `gcp/proxy/api/core/config.py`:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `REASONING_ENGINE_ID` — must be a real, reachable Agent Engine or `stream_query` calls fail
- `FIREBASE_WEBHOOK_SECRET` — optional legacy path prefix (not a substitute for auth)
- `DISABLE_FIREBASE_AUTH=true` — local/tests only; trust body `user_id`
- `TELEGRAM_WEBHOOK_SECRET` — only if you're testing the bot
- `USER_UPLOAD_TOPIC`, `USER_UPLOAD_RESULT_SUBSCRIPTION`, `GCS_BUCKET` — for upload + RAG flow
- `TOKEN_QUOTA_PERIOD_MAX_TOKENS` (optional) — global monthly cap
- `PROXY_CORS_ORIGINS` (optional) — comma-separated browser origins; unset uses defaults in `core/cors.py` (`https://asset-mem.com`, `https://homegeek.ai`, App Hosting URLs, `http://localhost:9002`)
- `PROXY_RATE_LIMIT_ENABLED` (default `true`) — per-UID limits; set `false` for unconstrained local testing
- `PROXY_RATE_LIMIT_AGENT_PER_WINDOW` (default `30` per 60s), `PROXY_RATE_LIMIT_CHECKPOINT_PER_WINDOW` (`20`), etc.
- `PROXY_OBSERVABILITY_TRACING` / `PROXY_OBSERVABILITY_METRICS` (default `false`) — enable OTel export when exporter packages are installed

You also need ADC: `gcloud auth application-default login` (Firestore + Vertex calls fail without it).

## Hitting it

```bash
# Sanity
curl http://127.0.0.1:8080/health

# Token quota for a user (no secret needed)
curl -X POST http://127.0.0.1:8080/token-quota-status \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<firebase-uid>"}'

# Agent stream — Bearer token (or DISABLE_FIREBASE_AUTH + body user_id)
curl -N -X POST "http://127.0.0.1:8080/firebase-agent-stream" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TEST_FIREBASE_ID_TOKEN" \
  -d '{"user_id":"<uid>","session_id":"<sid>","user_query":"hello"}'
```

For an end-to-end token-usage smoke test, use the included script (see the **check-token-quota** skill).

## Common gotchas
- The test suite for the proxy runs via `bash gcp/proxy/api/run_tests.sh` from `gcp/proxy/api/`.
- Don't run `python main.py` directly — `main.py` is only the ASGI app object; uvicorn imports it.
- If Pub/Sub background listeners log errors on startup, the topics/subscriptions in `USER_UPLOAD_*` env vars don't exist in your project. Create them or unset the vars for a quieter local run.
