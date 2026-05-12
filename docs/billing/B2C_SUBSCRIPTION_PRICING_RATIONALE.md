# B2C subscription pricing rationale (Plus / Pro)

**Status:** Draft for product and finance review  
**Last updated:** 2026-05-21  
**Environment referenced:** `homegeek-staging` (Firestore via Firebase MCP)

This document explains how HomeApp arrived at recommended **B2C tiered subscription** pricing: **Plus** (10M AI tokens/month) and **Pro** (25M AI tokens/month), with suggested list prices of **$19/month** and **$39/month** respectively. It ties together **observed usage**, **GCP LLM unit economics**, **shared infrastructure**, and **payment processing**.

---

## Executive summary

| Tier     | Monthly token cap                | Suggested price | Primary rationale                                                                                                       |
| -------- | -------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Free** | Env default (e.g. 1–2M) or trial | $0              | Acquisition; upgrade when quota bar hits limit                                                                          |
| **Plus** | **10,000,000**                   | **$19/mo**      | Covers ~p90 LLM cost at high utilization + infra share + Stripe; aligns with ~4M observed power-user month on a 10M cap |
| **Pro**  | **25,000,000**                   | **$39/mo**      | ~2.5× token headroom vs Plus; LLM COGS ~$18 at full cap; targets heavy agent + checkpoint + document use                |

**Monthly creation limits (UTC month, enforced on proxy):**

| Tier     | Document analyses / RAG files | Checkpoint AI runs |
| -------- | ----------------------------- | ------------------ |
| **Free** | 2                             | 5                  |
| **Plus** | 10                            | 30                 |
| **Pro**  | 30                            | 100                |

Configure via `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` including reserved key `free` (see `gcp/common/billing_plans.py`).

**Not included in token caps:** Vertex AI Agent Engine platform fees beyond model tokens, RAG import, GCS egress, Firestore/Storage at scale—these are allocated separately as **per-subscriber infrastructure**.

---

## 1. Goals and constraints

### Business goals

- Predictable monthly price for homeowners (and later property-manager org tiers).
- Monthly AI usage capped in **UTC calendar months**, consistent with existing [`gcp/common/token/quota.py`](../../gcp/common/token/quota.py).
- Gross margin after **LLM variable cost**, **shared GCP/Firebase infra**, and **Stripe fees**.
- Room to offer annual billing (~20% discount) without changing metering logic.

### Technical constraints (already in the product)

- Quota enforcement uses **`llm_token_usage/{userId}.periodTotalTokens`** when `quotaPeriodKey` matches the current month ([`gcp/common/token/README.md`](../../gcp/common/token/README.md)).
- Paid caps are intended to flow from **Stripe Price ID → `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` → Firestore `users/{uid}/billing/summary`** (B2C webhook path), with precedence over manual `preferences.monthlyTokenLimit`.
- Primary models in production paths: **`gemini-3.1-flash-lite`** (agents, checkpoint worker, most vision); **`gemini-2.5-flash`** (document extraction, some cost/DIY direct calls)—see [`gcp/agents/homecare/property_agent/model_config.py`](../../gcp/agents/homecare/property_agent/model_config.py).

---

## 2. Empirical anchor: staging power user

On **2026-05-21**, Firestore was read via Firebase MCP for project **`homegeek-staging`**:

**Document:** `llm_token_usage/GqC3zTlnb6hRS4vTH6TGeCpDXgH2`

| Field                      | Value                | Notes                                    |
| -------------------------- | -------------------- | ---------------------------------------- |
| `quotaPeriodKey`           | `2026-05`            | Current UTC month                        |
| `periodTotalTokens`        | **4,018,977**        | **Quota meter** (input + output)         |
| `periodInputTokens`        | 3,742,938            | ~93% of period total                     |
| `periodOutputTokens`       | 276,039              | ~7% of period total                      |
| `periodAgentStreamCount`   | 212                  | Reasoning Engine proxy streams           |
| `periodWorkerLlmCallCount` | 15                   | Checkpoint/doc worker Gemini calls       |
| `updatedAt`                | 2026-05-21T10:43:03Z |                                          |
| Lifetime `totalTokens`     | 4,106,804            | Slightly above period (rollover/history) |

**Preferences:** `users/GqC3zTlnb6hRS4vTH6TGeCpDXgH2/preferences/user` → `monthlyTokenLimit: **10,000,000**` (manual override, not Stripe).

**Billing:** No `users/.../billing/summary` document (no active Stripe subscription recorded).

**Archived month:** `periods/2026-03` → `periodTotalTokens: 87,827` (low usage that month).

### How this user informed tier caps

- They consumed **~40%** of a **10M** cap in one active month → **10M Plus** is a credible “serious homeowner” ceiling without forcing upgrade mid-month for this profile.
- **25M Pro** gives **~6×** this user’s current month (or **2.5×** a hypothetical 10M max-out), appropriate for multiple properties, heavy checkpoints, and long agent threads.
- Earlier draft marketing copy used **8M Plus / 25M Pro**; **10M Plus** matches this user’s **existing preference cap** and adds margin vs 8M for the same price point.

---

## 3. What counts as a “token” for billing

HomeApp increments **`periodTotalTokens`** from API `usage_metadata` on:

- **Proxy:** Vertex AI Reasoning Engine **`stream_query`** (aggregated per stream in [`gcp/proxy/api/services/token_usage_service.py`](../../gcp/proxy/api/services/token_usage_service.py)).
- **Workers:** Gemini **`generate_content`** / **`embed_content`** (checkpoint analysis, document analysis, embeddings)—see [`gcp/common/token/genai.py`](../../gcp/common/token/genai.py).

**Implication for pricing:** A “token” in the subscription is the **same unit** the quota system enforces—not a separate Stripe meter. Subscription price must cover **expected mix** of agent streams (high input, multi-step) and worker vision calls.

---

## 4. LLM unit cost model (GCP / Vertex)

### 4.1 Reference list prices (verify before launch)

Source: [Vertex AI Generative AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) (Standard tier, subject to change).

| Model (HomeApp usage)     | Input (USD / 1M tokens) | Output (USD / 1M tokens) |
| ------------------------- | ----------------------- | ------------------------ |
| **Gemini 3.1 Flash-Lite** | ~0.25                   | ~1.50                    |
| **Gemini 2.5 Flash**      | ~0.30                   | ~2.50                    |

Document extraction uses **2.5 Flash**; most other metered paths use **Flash-Lite**. Pricing math below uses **Flash-Lite** as the default, with a **+20% buffer** line item for model mix and billing lag.

### 4.2 Blended cost formula

Let:

- \(I\) = input tokens, \(O\) = output tokens, \(T = I + O\)
- \(r\) = input share \(I/T\) (staging user: **~0.93**)
- Flash-Lite rates: \(p_i = 0.25\), \(p_o = 1.50\) per million tokens

**Cost per million total tokens** (when input share is \(r\)):

\[
\text{USD per 1M} = r \cdot p_i + (1-r) \cdot p_o
\]

For \(r = 0.93\): \(0.93 \times 0.25 + 0.07 \times 1.50 \approx 0.34\) USD / 1M tokens.

**Monthly LLM cost at cap \(C\)** (millions of tokens):

\[
\text{LLM_cost} \approx C \times (r \cdot p_i + (1-r) \cdot p_o) \times 1.2
\]

The **1.2** factor is a **20% safety margin** (2.5 Flash calls, Reasoning Engine overhead, price changes).

### 4.3 Calculated LLM COGS at tier caps

Using \(r = 0.93\), Flash-Lite rates, 20% buffer:

| Cap (millions) | Formula (approx.)             | **LLM COGS at 100% utilization**                                        |
| -------------- | ----------------------------- | ----------------------------------------------------------------------- |
| **10M (Plus)** | \(10 \times 0.34 \times 1.2\) | **~$4.1** (round to **~$5–7** with conservative \(r=0.8\) and round-up) |
| **25M (Pro)**  | \(25 \times 0.34 \times 1.2\) | **~$10.2** (round to **~$16–18** with 50/50 stress test)                |

**Conservative stress (50% input / 50% output)**—output-heavy sessions:

- Per 1M: \(0.5 \times 0.25 + 0.5 \times 1.50 = 0.875\) USD / 1M
- 10M → **~$10.5** × 1.2 ≈ **$12.6**
- 25M → **~$26** × 1.2 ≈ **$31**

**Recommended planning numbers for finance:**

| Tier     | Planning LLM COGS (full cap) | Planning LLM COGS (50% avg utilization) |
| -------- | ---------------------------- | --------------------------------------- |
| Plus 10M | **$7**                       | **$3.50**                               |
| Pro 25M  | **$18**                      | **$9**                                  |

### 4.4 Staging user month (actual)

| Metric                                    | Value                                             |
| ----------------------------------------- | ------------------------------------------------- |
| Tokens                                    | 4.02M                                             |
| Implied LLM COGS (0.93 input share, +20%) | **~$1.6–2.5**                                     |
| At **$19 Plus** (if subscribed)           | **~$16+** contribution margin before shared infra |

---

## 5. Utilization assumptions (why caps ≠ cost)

Subscription caps are **upper bounds**. SaaS AI products typically see:

| Percentile        | % of monthly cap used   | Used for pricing               |
| ----------------- | ----------------------- | ------------------------------ |
| Median subscriber | 15–35%                  | Average COGS                   |
| p75               | 40–60%                  | **Plus** planning (~this user) |
| p90               | 70–90%                  | Stress test                    |
| p99               | 100%+ (if cap enforced) | Worst-case COGS = full cap     |

**Plus at $19** remains viable if **average** utilization is **&lt;60%** of 10M or if only a minority max out the cap.

---

## 6. Infrastructure and platform costs (non-token)

Token meters **do not** include all GCP spend. Shared monthly costs (order-of-magnitude for early staging/production scale):

| Component                          | Role                                            | Typical monthly range (whole project)         |
| ---------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| Cloud Run (`homecare-agent-proxy`) | API, Stripe webhooks, agent SSE                 | $50–300+                                      |
| Cloud Functions                    | Checkpoint, document, metrics workers           | $50–500+                                      |
| **Vertex AI Agent Engine**         | Session/orchestration **on top of** token bills | **$100–1,000+** — **validate in GCP Billing** |
| Firestore                          | Usage docs, app data                            | $20–200+                                      |
| Cloud Storage                      | Media, uploads                                  | $20–150+                                      |
| Pub/Sub                            | Async jobs                                      | $10–100+                                      |
| Firebase App Hosting               | Webapp                                          | $20–100+                                      |
| Observability / networking         | Logs, egress                                    | $20–100+                                      |

### Per-subscriber allocation method

Until you have stable **$/paid user/month** from Billing export:

\[
\text{Infra per sub} \approx \frac{\text{Monthly GCP subtotal (excl. pass-through LLM line items)}}{\text{Paid subscribers}}
\]

**Planning allowances used in this recommendation:**

| Paid subscribers (approx.) | Infra + platform per sub / month |
| -------------------------- | -------------------------------- |
| 50                         | $8–25                            |
| 200                        | $4–8                             |
| 1,000                      | $2–4                             |
| 5,000+                     | $1–2                             |

**Recommendation used $4–5/sub** in the $19 / $39 price build (mid-scale startup).

---

## 7. Payment processing and operating overhead

### Stripe (US cards, illustrative)

- **2.9% + $0.30** per successful monthly charge.
- **$19 Plus:** ~$0.85
- **$39 Pro:** ~$1.43

### Operating reserve (suggested)

- **5–10%** of gross for support, refunds, chargebacks, tax/accounting friction.

---

## 8. Build-up to recommended list prices

### Plus — $19/month, 10M tokens

| Line item                                        | USD / subscriber / month                    |
| ------------------------------------------------ | ------------------------------------------- |
| LLM COGS (planning, p75 utilization ~50% of cap) | $3.50                                       |
| LLM stress (p99 at 100% cap)                     | up to $7.00                                 |
| Infra + Agent Engine allocation                  | $4.00                                       |
| Stripe                                           | $0.85                                       |
| **Subtotal**                                     | **~$8.35** (typical) – **~$11.85** (stress) |
| **List price**                                   | **$19.00**                                  |
| **Implied margin (typical)**                     | **~$7.65** (~40%) before OpEx               |
| **Implied margin (stress)**                      | **~$7.15** (~38%)                           |

### Pro — $39/month, 25M tokens

| Line item                        | USD / subscriber / month                     |
| -------------------------------- | -------------------------------------------- |
| LLM COGS (planning, ~50% of cap) | $9.00                                        |
| LLM stress (100% cap)            | $18.00                                       |
| Infra + platform allocation      | $5.00                                        |
| Stripe                           | $1.43                                        |
| **Subtotal**                     | **~$15.43** (typical) – **~$24.43** (stress) |
| **List price**                   | **$39.00**                                   |
| **Implied margin (typical)**     | **~$23.57** (~60%)                           |
| **Implied margin (stress)**      | **~$14.57** (~37%)                           |

Pro margin is healthier because **heavy users self-select** into Pro while **average** Pro utilization may stay below cap.

---

## 9. Competitive context (consumer AI, 2025–2026)

Reference points (not direct comparables—different products, but anchor willingness to pay):

| Product                     | Indicative consumer price | Notes                  |
| --------------------------- | ------------------------- | ---------------------- |
| ChatGPT Plus                | ~$20/mo                   | General chat           |
| Claude Pro                  | ~$20/mo                   | General chat           |
| Cursor Pro                  | ~$20/mo                   | IDE + agent usage caps |
| “Pro” tiers with more usage | $30–60/mo                 | Power users            |

**Plus at $19** and **Pro at $39** sit in a **credible band** for property-specific AI (checkpoints, documents, agents) without underpricing vs general assistants.

---

## 10. Final product configuration

### Token caps (enforce via Stripe → Firestore → `quota.py`)

```json
{
  "price_XXXXX_PLUS": 10000000,
  "price_XXXXX_PRO": 25000000
}
```

(Map real Stripe Price IDs in `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` on the proxy.)

### Suggested Stripe list prices

| Tier | Price              | Annual (optional, ~20% off)  |
| ---- | ------------------ | ---------------------------- |
| Plus | **$19.00 / month** | **$182 / year** (~$15.17/mo) |
| Pro  | **$39.00 / month** | **$374 / year** (~$31.17/mo) |

### Free tier

- Keep **`free`** in `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` for non-paying users (e.g. **1M–2M** tokens), so conversion triggers are clear in the AI usage UI.

### Marketing copy (landing / settings)

- **Plus:** 10 million AI tokens per UTC month — agent chat, document analysis, checkpoint AI.
- **Pro:** 25 million AI tokens per UTC month — for heavy use across properties and team-style workflows (B2B org tiers separate).

---

## 11. Risks and validation plan

### Key risks

| Risk                                            | Mitigation                                                |
| ----------------------------------------------- | --------------------------------------------------------- |
| Agent Engine platform cost dominates token cost | Export Billing by SKU monthly; adjust prices or caps      |
| Users cluster at 100% of Plus cap               | Raise Plus to $24 or reduce cap; add soft warnings at 80% |
| Document-heavy users (2.5 Flash)                | Monitor `periodWorkerLlmCallCount` vs token growth        |
| Input/output mix shifts                         | Recompute §4.2 quarterly from Firestore samples           |
| Infra per user higher at low paid count         | Delay marketing spend until N &gt; 100 paid               |

### Validation checklist (before locking prices)

1. **GCP Billing** (staging + prod): split **Generative AI** vs **Agent Engine** vs **Cloud Run** for last 30 days.
2. **Sample 20–50 users** from `llm_token_usage`: distribution of `periodTotalTokens` / cap.
3. **Pilot** 10–20 paid users at $19/$39; measure actual margin after 60 days.
4. **Stripe test mode** E2E: Checkout → webhook → `billing/summary` → quota resolution.
5. Re-read Vertex pricing page at launch (Google changes list prices).

---

## 12. Related implementation docs

| Topic                                 | Location                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Token schema & quota order            | [`gcp/common/token/README.md`](../../gcp/common/token/README.md)                                                           |
| Stripe B2C local dev                  | [`docs/proxy/DEPLOYMENT.md`](../proxy/DEPLOYMENT.md) (Stripe B2C section)                                                  |
| Cursor Firebase MCP / Firestore reads | [`.cursor/README.md`](../../.cursor/README.md)                                                                             |
| Proxy billing routes                  | [`gcp/proxy/api/services/billing_service.py`](../../gcp/proxy/api/services/billing_service.py)                             |
| Landing pricing UI                    | [`apps/webapp/src/app/landing/landing-pricing-section.tsx`](../../apps/webapp/src/app/landing/landing-pricing-section.tsx) |

---

## Appendix A — Raw Firestore snapshot (staging, 2026-05-21)

**User ID:** `GqC3zTlnb6hRS4vTH6TGeCpDXgH2`  
**Project:** `homegeek-staging`

```text
llm_token_usage/GqC3zTlnb6hRS4vTH6TGeCpDXgH2
  quotaPeriodKey: 2026-05
  periodTotalTokens: 4018977
  periodInputTokens: 3742938
  periodOutputTokens: 276039
  periodAgentStreamCount: 212
  periodWorkerLlmCallCount: 15
  totalTokens: 4106804
  inputTokens: 3826857
  outputTokens: 279947
  agentStreamCount: 219
  workerLlmCallCount: 24
  updatedAt: 2026-05-21T10:43:03.583Z

users/.../preferences/user
  monthlyTokenLimit: 10000000

users/.../billing/summary — not found
```

---

## Appendix B — Sensitivity table (LLM only, Flash-Lite + 20% buffer)

| Cap | Input share 93% | Input share 50% |
| --- | --------------- | --------------- |
| 10M | ~$4.1           | ~$10.5          |
| 25M | ~$10.2          | ~$26.3          |

_Add infra, Stripe, and margin per §8 for retail price._

---

## Document history

| Date       | Change                                                                             |
| ---------- | ---------------------------------------------------------------------------------- |
| 2026-05-21 | Initial version: staging user anchor, 10M Plus / 25M Pro, $19 / $39 recommendation |
