# LLM token usage & quota

Shared **Firestore accounting** for LLM tokens (proxy Reasoning Engine + worker Gemini) and **monthly UTC quotas**.

## Code layout

| Module | Role |
|--------|------|
| `constants.py` | Firestore collection / subcollection names |
| `genai.py` | Aggregate tokens from `google-genai` responses |
| `persist.py` | Transactional updates + period rollover + period archive |
| `quota.py` | Token limits from Stripe B2C billing doc / preferences / env, pre-call checks |
| `../plan_limits.py` | Monthly document & checkpoint **creation** limits (same billing resolution) |
| `../billing_plans.py` | Parse `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` (tokens + doc/checkpoint caps) |

---

## Firestore schema

All paths are under the default database. **Writes** use the Admin / server SDK (proxy, workers). **Client reads** are allowed for the signed-in user only; see `apps/webapp/firestore.rules`.

### Structure (overview)

```text
users/{userId}/billing/summary              # B2C Stripe mirror (proxy webhooks only; client read)
  └── subscriptionStatus, priceId, monthlyTokenLimit, monthlyDocumentLimit,
      monthlyCheckpointLimit, stripeCustomerId, …

llm_token_usage/{userId}                    # one document per user
  ├── (fields: lifetime totals, current month, metadata)
  └── periods/{YYYY-MM}                     # optional: closed UTC months (history)
        └── (fields: snapshot for that month)
```

- **`userId`**: Firebase Auth UID (string).
- **`YYYY-MM`**: UTC calendar month, e.g. `2026-03`, aligned with `quotaPeriodKey`.

### Root document: `llm_token_usage/{userId}`

| Field | Type | Meaning |
|-------|------|---------|
| `updatedAt` | timestamp | Last update (server time). |
| `quotaPeriodKey` | string | Current UTC month id `YYYY-MM`; drives which month the `period*` fields describe. |
| `inputTokens` | number | **Lifetime** input tokens (prompt + embed input, as recorded). |
| `outputTokens` | number | **Lifetime** output / candidate tokens. |
| `totalTokens` | number | **Lifetime** total tokens (see persist logic when only `total` is available). |
| `agentStreamCount` | number | **Lifetime** count of Reasoning Engine proxy streams recorded. |
| `workerLlmCallCount` | number | **Lifetime** count of worker Gemini API calls recorded. |
| `periodInputTokens` | number | **Current UTC month only** — input tokens. |
| `periodOutputTokens` | number | **Current UTC month only** — output tokens. |
| `periodTotalTokens` | number | **Current UTC month only** — total tokens; **used for quota** vs `monthlyTokenLimit` / env when `quotaPeriodKey` matches the current month. |
| `periodAgentStreamCount` | number | **Current UTC month only** — proxy streams. |
| `periodWorkerLlmCallCount` | number | **Current UTC month only** — worker LLM calls. |
| `periodDocumentCreations` | number | **Current UTC month** — document analysis + RAG import slots consumed. |
| `periodCheckpointCreations` | number | **Current UTC month** — checkpoint AI analyses queued. |
| `documentCreations` | number | **Lifetime** document creation counter. |
| `checkpointCreations` | number | **Lifetime** checkpoint creation counter. |

On **UTC month rollover**, the `period*` fields on this document are **reset** for the new month (starting from the first write in that month). **Lifetime** fields keep increasing.

### History: `llm_token_usage/{userId}/periods/{YYYY-MM}`

Created on rollover when the previous month had a valid `quotaPeriodKey` and the snapshot doc does not already exist (idempotent).

| Field | Type | Meaning |
|-------|------|---------|
| `quotaPeriodKey` | string | Same as document id (`YYYY-MM`). |
| `periodInputTokens` | number | Archived month input total. |
| `periodOutputTokens` | number | Archived month output total. |
| `periodTotalTokens` | number | Archived month total tokens. |
| `periodAgentStreamCount` | number | Archived month proxy stream count. |
| `periodWorkerLlmCallCount` | number | Archived month worker LLM call count. |
| `archivedAt` | timestamp | When the snapshot was written. |

**Note:** History exists only from **after** this feature is deployed; months with no token usage produce no `periods` doc. Very old documents without a proper `quotaPeriodKey` may not be archived until keys are consistent.

### Client queries (read-only)

- Current usage / quota display: document `llm_token_usage/{uid}`.
- Past months: collection `llm_token_usage/{uid}/periods` (list or get by id `YYYY-MM`).

---

## Quota resolution (monthly UTC)

1. **`users/{userId}/preferences/user`** → **`monthlyTokenLimit`** (positive number) if set — **highest precedence**.
2. Else **`STRIPE_B2C_PRICE_TOKEN_CAPS_JSON`** → **`free`** plan `monthlyTokenLimit`. Unset or **`0`** ⇒ unlimited.
3. Enforcement: proxy before Reasoning Engine calls; checkpoint worker at job start. Clients may see `TOKEN_QUOTA_EXCEEDED`.

---

## Import

```python
from common.token import (
    PERIODS_SUBCOLLECTION,
    TOKEN_USAGE_COLLECTION,
    new_llm_usage_sink,
    accumulate_google_genai_generate_response,
    accumulate_google_genai_embed_response,
    persist_firestore_token_totals,
    TokenQuotaExceeded,
    check_token_quota_or_raise,
    get_token_quota_status,
)
```
