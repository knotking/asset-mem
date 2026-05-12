# B2C Stripe configuration

Step-by-step guide to wire **HomeApp Plus ($19/mo)** and **Pro ($39/mo)** subscriptions after Products and Prices are created in the [Stripe Dashboard](https://dashboard.stripe.com).

**Related docs**

| Doc | Purpose |
|-----|---------|
| [B2C_SUBSCRIPTION_PRICING_RATIONALE.md](./B2C_SUBSCRIPTION_PRICING_RATIONALE.md) | Why caps and list prices were chosen |
| [../proxy/DEPLOYMENT.md](../proxy/DEPLOYMENT.md) | Local proxy + `stripe listen` for webhooks |
| [../../gcp/common/token/README.md](../../gcp/common/token/README.md) | Token usage Firestore schema |
| [../../apps/webapp/.env.example](../../apps/webapp/.env.example) | Webapp env template |

---

## Overview

```text
User (webapp) ──Firebase ID token──► Proxy API
                                      ├── POST /billing/b2c/checkout-session  → Stripe Checkout
                                      ├── POST /billing/b2c/portal-session      → Stripe Portal
                                      └── POST /stripe/webhook                  ← Stripe events
                                              └── Firestore users/{uid}/billing/summary

Enforcement (proxy + workers):
  • monthlyTokenLimit      → Reasoning Engine / Gemini (llm_token_usage)
  • monthlyDocumentLimit   → extract-doc-info, rag-file-upload (per file)
  • monthlyCheckpointLimit → analyze-checkpoint
```

List prices on the landing page are **marketing copy** (`apps/webapp/src/lib/plan-limits-public.ts`). **Stripe Prices** must be configured to $19 and $39 in Dashboard. **Usage caps** come from `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` on the proxy.

---

## 1. Stripe Dashboard

Do this separately for **Test mode** (staging/dev) and **Live mode** (production).

### 1.1 Products and Prices

Create recurring monthly Prices (or confirm existing ones):

| Plan | List price | Suggested caps (enforced via proxy JSON) |
|------|------------|----------------------------------------|
| **Plus** | $19 / month | 10M tokens, 10 documents/mo, 30 checkpoint AI/mo |
| **Pro** | $39 / month | 25M tokens, 30 documents/mo, 100 checkpoint AI/mo |

Copy each **Price id** (`price_…`) — you need them in both proxy and webapp config.

### 1.2 Webhook endpoint

Add an endpoint pointing at the **proxy** (no `FIREBASE_WEBHOOK_SECRET` prefix):

| Environment | URL pattern |
|-------------|-------------|
| Staging | `https://<staging-cloud-run-proxy-host>/stripe/webhook` |
| Production | `https://<prod-cloud-run-proxy-host>/stripe/webhook` |
| Local dev | `stripe listen --forward-to localhost:8080/stripe/webhook` |

**Events to subscribe to (minimum):**

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the webhook **signing secret** (`whsec_…`).

### 1.3 Customer Portal

In Stripe → **Settings → Billing → Customer portal**, enable the portal so **Settings → Plan & billing → Manage billing** works.

### 1.4 API keys

| Key | Use |
|-----|-----|
| **Secret key** `sk_test_…` / `sk_live_…` | Proxy only (`STRIPE_SECRET_KEY`) — never in webapp or git |
| **Publishable key** | Not required for current Checkout flow (server creates sessions) |

---

## 2. Proxy (Cloud Run)

Set via GitHub **Environment** secrets/variables and deployed by [`.github/workflows/deploy-homecare-agent-proxy.yaml`](../../.github/workflows/deploy-homecare-agent-proxy.yaml).

### 2.1 Secrets (GitHub)

| Variable | Example | Description |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_…` | Stripe secret API key |
| `STRIPE_WEBHOOK_SIGNING_SECRET` | `whsec_…` | From Dashboard webhook or Stripe CLI (local) |

### 2.2 Variables (GitHub)

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` | **Yes** | JSON map: reserved **`free`** key + Stripe **Price ids** (see below) |
| `BILLING_PUBLIC_APP_BASE_URL` | **Yes** | Public webapp origin, **no** trailing slash (Checkout return URLs) |

**`STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` format**

Required reserved key **`free`** (non-subscribers). Paid tiers use keys **`plus`** and **`pro`** (checkout sends `{ "tier": "plus" }` — the proxy resolves `stripePriceId`).

**Recommended (checkout by tier)** — tokens + document + checkpoint limits:

```json
{
  "free": {
    "monthlyTokenLimit": 1000000,
    "monthlyDocumentLimit": 2,
    "monthlyCheckpointLimit": 5
  },
  "plus": {
    "stripePriceId": "price_xxxxxxxxxxxx",
    "monthlyTokenLimit": 10000000,
    "monthlyDocumentLimit": 10,
    "monthlyCheckpointLimit": 30
  },
  "pro": {
    "stripePriceId": "price_yyyyyyyyyyyy",
    "monthlyTokenLimit": 25000000,
    "monthlyDocumentLimit": 30,
    "monthlyCheckpointLimit": 100
  }
}
```

**Legacy** — top-level key is a Stripe **Price id** (`price_…`) or integer token cap only (webhooks still match by `price_…`):

```json
{
  "price_xxxxxxxxxxxx": 10000000,
  "price_yyyyyyyyyyyy": 25000000
}
```

Use `0` for a field to mean **unlimited** for that dimension.

On active subscription webhooks, the proxy writes to Firestore:

`users/{firebaseUid}/billing/summary` → `subscriptionStatus`, `priceId`, `monthlyTokenLimit`, `monthlyDocumentLimit`, `monthlyCheckpointLimit`, `stripeCustomerId`, …

### 2.3 Local development

Create `gcp/proxy/api/.env` (not committed):

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...   # from: stripe listen --forward-to localhost:8080/stripe/webhook
STRIPE_B2C_PRICE_TOKEN_CAPS_JSON='{"free":{"monthlyTokenLimit":1000000,"monthlyDocumentLimit":2,"monthlyCheckpointLimit":5},"plus":{"stripePriceId":"price_...","monthlyTokenLimit":10000000,"monthlyDocumentLimit":10,"monthlyCheckpointLimit":30},"pro":{"stripePriceId":"price_...","monthlyTokenLimit":25000000,"monthlyDocumentLimit":30,"monthlyCheckpointLimit":100}}'
BILLING_PUBLIC_APP_BASE_URL=http://localhost:9002
GCP_PROJECT_ID=your-project-id
```

```bash
cd gcp/proxy/api
uvicorn main:app --host=0.0.0.0 --port=8080 --reload
```

---

## 3. Webapp (Firebase App Hosting)

Checkout calls **`POST /billing/b2c/checkout-session`** with `{ "tier": "plus" }` or `{ "tier": "pro" }`. The webapp does **not** need Stripe Price ids in its env.

### 3.1 Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** | Proxy base URL (existing) |

AI usage limits come from **`POST /token-quota-status`** on the proxy.

### 3.2 Where to set them

| Surface | File / location |
|---------|-----------------|
| Local dev | `apps/webapp/.env.local` or `.env.staging` (gitignored) |
| Staging deploy | `apps/webapp/apphosting.staging.yaml` |
| Production deploy | `apps/webapp/apphosting.prod.yaml` |

`BILLING_PUBLIC_APP_BASE_URL` on the proxy should match `NEXT_PUBLIC_SITE_URL` (or the URL users actually use) for that environment — e.g. staging hosted app URL for staging.

---

## 4. Alignment checklist

Before calling an environment “done”:

- [ ] `plus` / `pro` tiers in `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` with correct `stripePriceId` values from Stripe
- [ ] Test vs Live: test keys + test prices in staging; live keys + live prices in prod
- [ ] Webhook URL hits **`/stripe/webhook`** on the deployed proxy
- [ ] `BILLING_PUBLIC_APP_BASE_URL` = webapp origin for that env
- [ ] Customer Portal enabled in Stripe
- [ ] Proxy and webapp redeployed after env changes

---

## 5. Verification

### 5.1 Checkout

1. Sign in on webapp → **Settings → Plan & billing** or landing **#pricing**.
2. **Upgrade to Plus** / **Pro** → redirect to Stripe Checkout (email prefilled from Firebase Auth when available).
3. Complete payment (test card `4242…` in test mode).

### 5.2 Firestore

Document: `users/{yourUid}/billing/summary`

Expect (among others):

- `subscriptionStatus`: `active` or `trialing`
- `priceId`: your Stripe Price id
- `monthlyTokenLimit`, `monthlyDocumentLimit`, `monthlyCheckpointLimit`: from JSON
- `stripeCustomerId`, `stripeSubscriptionId`

(Client read-only; writes are webhook-only per `apps/webapp/firestore.rules`.)

### 5.3 Quota API

```bash
# Replace BASE and Firebase ID token
curl -s -X POST "$BASE/token-quota-status" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"YOUR_UID"}'
```

Response includes `max_tokens`, `documents`, and `checkpoints` with `used` / `limit` for the current UTC month.

### 5.4 Enforcement smoke tests

| Action | Over limit returns |
|--------|-------------------|
| Agent stream / session | `TOKEN_QUOTA_EXCEEDED` |
| Document queue / RAG upload | `DOCUMENT_QUOTA_EXCEEDED` (HTTP 429) |
| Checkpoint analyze | `CHECKPOINT_QUOTA_EXCEEDED` (HTTP 429) |

---

## 6. Plan reference (product defaults)

Marketing and enforcement defaults (keep JSON and `plan-limits-public.ts` in sync when changing):

| Tier | Price | Tokens / month | Documents / month | Checkpoint AI / month |
|------|-------|----------------|-------------------|------------------------|
| Free | $0 | `free` in JSON (e.g. 1M tokens) | 2 | 5 |
| Plus | $19 | 10M | 10 | 30 |
| Pro | $39 | 25M | 30 | 100 |

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Checkout returns 400 unknown tier | `plus` / `pro` missing from `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` or missing `stripePriceId` |
| Checkout returns 400 tier has no Stripe Price id | Tier entry exists but `stripePriceId` is empty |
| Paid user still on free limits | Webhook not received; check proxy logs and Stripe webhook delivery |
| `billing/summary` empty after pay | Wrong signing secret; or Checkout session missing `client_reference_id` / `firebaseUid` metadata |
| Portal 400 “No billing profile” | User never completed Checkout (no `stripeCustomerId`) |
| Limits wrong after plan change | Re-send subscription webhook or update subscription in Portal; confirm JSON keys match new Price id |

**Code references**

- Billing service: `gcp/proxy/api/services/billing_service.py`
- Plan limits: `gcp/common/plan_limits.py`
- Price JSON parser: `gcp/common/billing_plans.py`
- Webapp checkout: `apps/webapp/src/lib/billing-client.ts`
