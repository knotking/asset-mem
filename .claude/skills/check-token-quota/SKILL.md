---
name: check-token-quota
description: Inspect, test, or debug the LLM token-quota system that gates Reasoning Engine and Gemini calls in the HomeApp proxy and workers. Use whenever the user asks about TOKEN_QUOTA_EXCEEDED, monthlyTokenLimit, llm_token_usage Firestore docs, the AI usage bar in the webapp/mapp settings, or wants to verify quota end-to-end.
---

# Inspecting and testing the token-quota system

## Where it lives

- **Library:** `gcp/common/token/` (imported as `common.token` from both proxy and workers). `quota.py` enforces, the surrounding helpers persist counters.
- **Firestore root doc:** `llm_token_usage/{userId}` with a `periods/{YYYY-MM}` subcollection. Schema details are in `gcp/common/token/README.md`.
- **Per-user override:** `users/{userId}/preferences/user.monthlyTokenLimit` (positive number wins).
- **Global default env:** `TOKEN_QUOTA_PERIOD_MAX_TOKENS` (set in proxy + worker env). `0` or unset = unlimited unless overridden per-user.
- **Status endpoint:** `POST /token-quota-status` (also exposed under `/{FIREBASE_WEBHOOK_SECRET}/token-quota-status`).

## Resolution order (enforced by `quota.py`)
1. `users/{userId}/preferences/user.monthlyTokenLimit` if it exists and is > 0.
2. Otherwise the env value `TOKEN_QUOTA_PERIOD_MAX_TOKENS`.
3. If both are unset/0, the user is unlimited.

## Where it gets called
- Proxy `services/agent_service.py` — before Reasoning Engine `stream_query` and session creation.
- Document analysis worker `gcp/proxy/workers/function/document_analysis/` — at the start of each job (same pattern as checkpoint worker).
- Worker `gcp/proxy/workers/function/checkpoint_analysis/` — at the start of each job.

After each LLM call, `usage_metadata` from the response increments the counters on the root doc and the current period subdoc. The checkpoint worker also increments `workerLlmCallCount`.

## Manual end-to-end smoke test

The repo ships a script that exercises `/firebase-agent-stream` and waits for the full body so the server has time to persist usage:

```bash
cd gcp/proxy
export FIREBASE_WEBHOOK_SECRET=...    # match the value in gcp/proxy/.env
export TEST_USER_ID=<firebase-uid>
python scripts/test_token_usage_request.py
```

Optional env:
- `PROXY_BASE_URL` (default `http://127.0.0.1:8080`)
- `TEST_USER_QUERY` (default `hello`)
- `TEST_SESSION_ID`

Add `--stream-chunks` to print SSE chunks as they arrive. The script still drains the full body before exiting, which is the important part — don't break early or the proxy may not finish writing token totals.

After it returns, check Firestore `llm_token_usage/{TEST_USER_ID}` and `llm_token_usage/{TEST_USER_ID}/periods/{YYYY-MM}` for incremented counters. The proxy logs `Recorded token usage` / `Token usage:` lines on success.

Prereqs: proxy reachable, ADC set (`gcloud auth application-default login`), `REASONING_ENGINE_ID` valid (otherwise the stream errors before usage is recorded).

## Querying the resolved cap from a client

```bash
curl -X POST http://127.0.0.1:8080/token-quota-status \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<firebase-uid>"}'
# → { "period": "2026-04", "used": 12345, "max_tokens": 1000000, "unlimited": false }
```

`max_tokens: 0` means unlimited. The webapp **AI usage** card and the mapp **TokenUsageBar** call this so the UI doesn't have to bake `TOKEN_QUOTA_PERIOD_MAX_TOKENS` into client builds. Don't duplicate the env into `NEXT_PUBLIC_*`/`extra.*` unless you want a fallback for when the proxy is unreachable.

## Setting / clearing a per-user override

In Firestore (or a quick admin script):
```
users/<uid>/preferences/user
  monthlyTokenLimit: 500000        # set
  monthlyTokenLimit: deleteField   # remove → falls back to env default
```
The next request the user makes will use the new value (no cache).

## Resetting a user's usage

Delete the period doc, not the root doc:
```
llm_token_usage/<uid>/periods/<YYYY-MM>
```
The root doc tracks lifetime totals; deleting it clears history.

## Over-limit responses

The proxy returns an error body with `code: TOKEN_QUOTA_EXCEEDED`. Clients should map that to a friendly "monthly limit reached" message — both mapp and webapp already do.

## Common gotchas
- **Document analysis quota** — `POST …/extract-doc-info` requires `userId` in the JSON body; the worker calls `check_token_quota_or_raise` before Gemini. Over limit: the worker sets the Firestore doc to `status: failed` with `docAnalysisQuotaExceeded` (no HTTP 429 on the queue call).
- **Worker writes don't show up** — the worker uses `gcp/common/token/` too, but it needs Firestore credentials (Cloud Functions service account, or ADC locally).
- **Counters didn't increment after a stream call** — the script returned before the body finished, OR `usage_metadata` was missing from stream events (older Vertex SDK version). Run with `--stream-chunks` and check the logs.
- **`monthlyTokenLimit` ignored** — make sure it's a positive number, not a string. Zero is treated as "no override".
