---
name: firestore-homeapp
description: >-
  Query HomeApp Firestore via the Firebase MCP server (firestore_get_document,
  firestore_list_documents, firestore_query_collection). Use for llm_token_usage,
  billing/summary, user preferences, debugging TOKEN_QUOTA_EXCEEDED, or Stripe
  webhook state. Requires firebase login and .cursor/mcp.json firebase server.
---

# HomeApp Firestore (Firebase MCP)

## Prerequisites

1. **MCP:** `.cursor/mcp.json` → server `firebase` (`firebase-tools mcp`, `--dir` = `apps/webapp`, `--only firestore`).
2. **Auth:** `npx firebase-tools@latest login` (or ADC with Firestore access).
3. **Project:** Default in `apps/webapp/.firebaserc` is `homegeek-staging`; `firebase use prod` for `homegeek-prod`. (Legacy GCP IDs; product brand is AssetMem AI.)
4. Setup details: `.cursor/README.md`.

## Primary MCP tools (server: `firebase`)

| Tool | Use when |
| ---- | -------- |
| `firestore_get_document` | Known full path, e.g. `llm_token_usage/{uid}` |
| `firestore_list_documents` | List docs in a collection (pagination) |
| `firestore_query_collection` | Filter by field (collection path + filters) |
| `firebase_get_environment` | Confirm active Firebase project and login |

Read tool schemas in Cursor MCP tool descriptors before calling.

## Token usage (`llm_token_usage`)

**Current month quota enforcement** uses root doc fields when `quotaPeriodKey` matches current UTC `YYYY-MM`:

- `periodTotalTokens` — compared to monthly cap
- `periodInputTokens`, `periodOutputTokens`
- `agentStreamCount`, `workerLlmCallCount` (period + lifetime variants on same doc)

**Path:** `llm_token_usage/{firebaseUid}`

**History:** `llm_token_usage/{firebaseUid}/periods/{YYYY-MM}`

Full schema: `gcp/common/token/README.md`.

Example agent request: “Use Firebase MCP to get `llm_token_usage/<uid>` and summarize period usage vs limit.”

## B2C billing (`users/{uid}/billing/summary`)

Server-written by Stripe webhooks (proxy). Client read-only per `apps/webapp/firestore.rules`.

Typical fields: `subscriptionStatus`, `priceId`, `monthlyTokenLimit`, `stripeCustomerId`, `stripeSubscriptionId`, `updatedAt`.

## Preferences override

`users/{uid}/preferences/user` → `monthlyTokenLimit` (positive int) overrides env default when no active Stripe cap (see `gcp/common/token/quota.py` resolution order).

## Safety

- Prefer **read** tools in production unless the user explicitly asks to modify data.
- Do not paste full PII from user docs into unrelated responses.
- Firestore rules allow users to read their own `users/{uid}/**` except `billing/**` (billing read-only, no client write).

## Fallback (no MCP)

```bash
gcloud firestore documents get \
  "projects/homegeek-staging/databases/(default)/documents/llm_token_usage/USER_UID" \
  --format=json
```

Or proxy: `POST /token-quota-status` with `{"user_id":"USER_UID"}` for resolved cap + used (no Firestore doc dump).
