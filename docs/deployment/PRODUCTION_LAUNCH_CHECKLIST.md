# Production Launch Checklist

Unified sign-off checklist for **production GA** (general availability), consolidating security, reliability, compliance, operations, and testing gaps identified in architecture review. Use after or in parallel with [Product Hunt Launch](./PRODUCT_HUNT_LAUNCH.md); PH can ship with a subset of Phase 1 items — **GA requires all Critical and High items signed off**.

**Canonical deploy path:** GitHub Actions + `gcloud` (prefer workflows over ad-hoc snippets). Environment bootstrap: [`create-environment.yaml`](../../.github/workflows/create-environment.yaml). See [CI/CD](./CICD.md), [SETUP_AND_DEPLOYMENT](../../gcp/docs/SETUP_AND_DEPLOYMENT.md), [`.github/workflows/README.md`](../../.github/workflows/README.md).

**Phase tracker (engineering tasks + per-phase operational TODOs):** [LAUNCH_PLAN_PROGRESS.md](./LAUNCH_PLAN_PROGRESS.md)

**Product Hunt ops:** [PRODUCT_HUNT_LAUNCH.md](./PRODUCT_HUNT_LAUNCH.md) (includes §2.1 production web env vars)

**Status key:** `[ ]` Not started · `[~]` In progress · `[x]` Done · `[—]` N/A or deferred with written approval

---

## How to use this document

1. Assign an **Owner** per section (name in table footer).
2. Complete **Staging** verification before **Production** sign-off.
3. Link PRs / tickets in the Notes column where helpful.
4. **Critical** items block GA; **High** strongly recommended; **Medium** can ship with dated follow-ups.

Phases align with the repo launch plan:

| Phase | Focus |
|-------|--------|
| **1** | Product Hunt / web conversion (partial overlap below) |
| **2** | Security & API hardening (Firebase ID token, limits, observability) |
| **3** | Compliance, ops, CI, scalability |
| **4** | Future infrastructure (API Gateway, etc.) — **post-GA, not blocking** |

### Phase 1 items (Product Hunt) — cross-reference

Many PH items are tracked in [LAUNCH_PLAN_PROGRESS.md § Phase 1](./LAUNCH_PLAN_PROGRESS.md#phase-1--product-hunt-readiness). GA checklist overlap:

| PH / Phase 1 item | GA section | Progress |
|-------------------|------------|----------|
| Privacy / Terms / About pages | §4.1–4.2 | `[x]` Code shipped — legal review / prod verify `[ ]` |
| Landing footer + contact | §4.7 | `[x]` Code — verify on prod `[ ]` |
| OG / `NEXT_PUBLIC_SITE_URL` | §9 docs | `[x]` Code — set env + verify `[ ]` |
| Analytics / `NEXT_PUBLIC_GA_MEASUREMENT_ID` | — | `[x]` Code — add GA ID to prod yaml `[ ]` |
| Google sign-in web + onboarding | §7.3–7.4 | `[x]` Code — verify Google provider in Firebase `[ ]` |
| `maxInstances` / smoke / on-call | §6.1, PH doc §3–5 | `[ ]` Not started |

---

## 1. Security (Critical / High)

| # | Priority | Item | Verification | Staging | Prod | Owner | Notes |
|---|----------|------|--------------|---------|------|-------|-------|
| 1.1 | **Critical** | Firebase ID token required on all user-facing proxy routes | Requests without `Authorization: Bearer` return 401; `uid` from token, not body | [ ] | [ ] | Eng | `gcp/proxy/api/main.py`, routers |
| 1.2 | **Critical** | Remove webhook secret from public client config | `NEXT_PUBLIC_API_BASE_URL` is origin only; no path token in web/mapp bundles | [ ] | [ ] | Eng | `apphosting.prod.yaml`, `app.config.js` |
| 1.3 | **Critical** | Rotate `FIREBASE_WEBHOOK_SECRET` after cutover | New secret in Secret Manager / GitHub env; old secret invalidated | [ ] | [ ] | Eng | |
| 1.4 | **High** | `/token-quota-status` requires auth; returns only caller’s quota | Spoofed `user_id` rejected | [ ] | [ ] | Eng | `routers/token_quota.py` |
| 1.5 | **High** | CORS restricted to app origins | Not `allow_origins=["*"]` with credentials | [ ] | [ ] | Eng | `gcp/proxy/api/main.py` |
| 1.6 | **High** | Per-UID API rate limiting (agent, checkpoint, documents) | Abuse test cannot exhaust Vertex in minutes | [ ] | [ ] | Eng | See `docs/checkpoint/CHECKPOINT_SCALABILITY_RECOMMENDATIONS.md` |
| 1.7 | **High** | Stable API errors (no raw `str(e)` to clients) | 4xx/5xx use codes; details in logs only | [ ] | [ ] | Eng | |
| 1.8 | **Medium** | GCS bucket CORS not `*` in prod | `create-environment.yaml` / bucket config | [ ] | [ ] | Eng | |
| 1.9 | **Medium** | Shared chat links reviewed (`sharedChats` public read) | Policy documented; expiry / noindex | [x] | [ ] | Product | `expiresAt`, `share/layout.tsx` robots, `firestore.rules` |
| 1.10 | **Medium** | Cloud Run IAM reviewed (not only path-secret security) | Document threat model | [ ] | [ ] | Eng | |

**References:** [API Overview](../proxy/API_OVERVIEW.md) · [add-proxy-endpoint skill](../../.claude/skills/add-proxy-endpoint/SKILL.md) · [check-token-quota skill](../../.claude/skills/check-token-quota/SKILL.md)

---

## 2. Reliability (High / Medium)

| # | Priority | Item | Verification | Staging | Prod | Owner | Notes |
|---|----------|------|--------------|---------|------|-------|-------|
| 2.1 | **High** | Readiness health fails when Reasoning Engine down | `/health` returns 503 when engine unavailable | [ ] | [ ] | Eng | `gcp/proxy/api/main.py` |
| 2.2 | **High** | Pub/Sub DLQ configured for worker subscriptions | Failed messages after N attempts go to DLQ | [ ] | [ ] | Eng | `create-environment.yaml`, `WORKERS_DEPLOYMENT.md` |
| 2.3 | **Medium** | Graceful shutdown for Pub/Sub listener | No lost in-flight on deploy | [ ] | [ ] | Eng | `gcp/proxy/api/core/events.py` |
| 2.4 | **Medium** | Service broker disabled or implemented | No stub endpoint in prod | [ ] | [ ] | Eng | `service_broker_service.py` |
| 2.5 | **Medium** | User-upload result handler not a no-op | Or listener removed | [ ] | [ ] | Eng | `core/events.py` |
| 2.6 | **Low** | Timeouts / bounded retries for Vertex/Gemini | Document limits | [ ] | [ ] | Eng | |

---

## 3. Observability & operations (High)

| # | Priority | Item | Verification | Staging | Prod | Owner | Notes |
|---|----------|------|--------------|---------|------|-------|-------|
| 3.1 | **High** | `initialize_observability()` on proxy startup | Metrics/traces in Cloud Monitoring | [ ] | [ ] | Eng | Workers already use `gcp/common/observability` |
| 3.2 | **High** | Alert policies: proxy 5xx, latency, quota exceeded | Alert fires on synthetic test | [ ] | [ ] | Ops | Document + apply via `docs/deployment/` and/or checked-in gcloud scripts; GHA optional |
| 3.3 | **High** | Alert policies: Pub/Sub backlog, function errors | | [ ] | [ ] | Ops | Same as 3.2 |
| 3.4 | **High** | Uptime check on prod web + proxy `/health` | | [ ] | [ ] | Ops | |
| 3.5 | **High** | Incident runbooks published | Proxy down, Vertex outage, worker backlog | [ ] | [ ] | Ops | Link runbook URLs below |
| 3.6 | **Medium** | Correlation IDs verified in logs (`X-Request-ID`) | Sample request traceable | [ ] | [ ] | Eng | Already implemented |
| 3.7 | **Medium** | Billing alerts on GCP project | | [ ] | [ ] | Ops | |

**Runbook links:**

- Proxy / API: [runbooks/proxy-down.md](./runbooks/proxy-down.md)
- Vertex / Agent: [runbooks/vertex-outage.md](./runbooks/vertex-outage.md)
- Workers / Pub/Sub: [runbooks/worker-backlog.md](./runbooks/worker-backlog.md)
- Ops index: [OPERATIONS.md](./OPERATIONS.md) · Apply script/workflow: [apply-operations-config.yaml](../../.github/workflows/apply-operations-config.yaml)

---

## 4. Compliance & legal (Critical / High)

| # | Priority | Item | Verification | Staging | Prod | Owner | Notes |
|---|----------|------|--------------|---------|------|-------|-------|
| 4.1 | **Critical** | Privacy Policy published and linked | Footer + signup flow | [ ] | [ ] | Legal | |
| 4.2 | **Critical** | Terms of Service published and linked | Footer + signup flow | [ ] | [ ] | Legal | |
| 4.3 | **High** | Self-service account deletion | User can delete account in settings | [x] | [ ] | Eng | mapp + web Settings; help URL `/account-deletion` |
| 4.4 | **High** | Data export (GDPR/CCPA-style) | User can request/export their data | [ ] | [ ] | Eng | |
| 4.5 | **High** | Data retention policy documented | Firestore, Storage, RAG, logs | [ ] | [ ] | Legal | |
| 4.6 | **High** | Privacy docs match actual data (addresses, photos, docs) | No inaccurate “no PII” claims | [ ] | [ ] | Legal | `docs/costing/OVERVIEW.md` |
| 4.7 | **Medium** | Support contact reachable | Email or form works | [ ] | [ ] | Ops | |

---

## 5. Testing & CI (High)

| # | Priority | Item | Verification | PR CI | Owner | Notes |
|---|----------|------|--------------|-------|-------|-------|
| 5.1 | **High** | Proxy tests in PR CI | `gcp/proxy/api/run_tests.sh` | [ ] | Eng | New workflow |
| 5.2 | **High** | Webapp lint + typecheck in PR CI | `npm run lint`, `npm run typecheck` | [ ] | Eng | |
| 5.3 | **High** | Agent unit tests in PR CI | `test-homecare-agent.yaml` | [x] | Eng | Already exists |
| 5.4 | **High** | Smoke E2E: signup → property → chat | Playwright or manual script in PH doc | [ ] | Eng | |
| 5.5 | **Medium** | Staging soak test (24–48h) | No critical errors | [ ] | Eng | |
| 5.6 | **Medium** | Manual agent QA on staging (optional) | `adk web` | [ ] | Eng | ADK evalsets removed; not blocking |

---

## 6. Performance & scalability (High / Medium)

| # | Priority | Item | Verification | Staging | Prod | Owner | Notes |
|---|----------|------|--------------|---------|------|-------|-------|
| 6.1 | **High** | Webapp `maxInstances` sized for expected load | Load test or PH spike plan | [ ] | [ ] | Eng | [PRODUCTION_HARDWARE_ALLOCATIONS.md](./PRODUCTION_HARDWARE_ALLOCATIONS.md), tier `ph` |
| 6.2 | **High** | Proxy Cloud Run min/max instances appropriate | | [ ] | [ ] | Eng | [apply-production-hardware.yaml](../../.github/workflows/apply-production-hardware.yaml) |
| 6.3 | **High** | Plan limits JSON configured for prod | `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` (`free` + Price ids) | [ ] | [ ] | Eng | `docs/billing/B2C_STRIPE_CONFIGURATION.md` |
| 6.4 | **Medium** | Checkpoint list pagination | No unbounded Firestore listener | [x] | [ ] | Eng | `CHECKPOINT_PAGE_SIZE=20`, cursor `loadMore` in `@asset-mem/common` + webapp |
| 6.5 | **Medium** | Load test: concurrent signups + chats | Document p95 latency | [ ] | [ ] | Eng | |

---

## 7. Product completeness (High)

| # | Priority | Item | Verification | Staging | Prod | Owner | Notes |
|---|----------|------|--------------|---------|------|-------|-------|
| 7.1 | **High** | Providers tab available (saved from chat); Services placeholder not marketed | Providers shipped | [ ] | [ ] | Eng | ~~Launch plan §1.4 hide work cancelled~~ |
| 7.2 | **Medium** | Mobile multi-checkpoint analysis hidden or shipped | No mock in prod build, or ship API | [ ] | [ ] | Eng | Not gated by cancelled §1.4 |
| 7.3 | **Medium** | First-run onboarding (property → doc/photo → chat) | | [ ] | [ ] | Eng | PH conversion |
| 7.4 | **Medium** | Web Google sign-in (optional for GA) | | [ ] | [ ] | Eng | |
| 7.5 | **Medium** | Agent production disclaimer resolved | Risk doc or README update | [ ] | [ ] | Eng | `gcp/agents/homecare/README.md` |

---

## 8. Deployment & environment (required for prod)

Consolidates [ENVIRONMENTS.md](./ENVIRONMENTS.md) § Environment Checklist.

### 8.1 Before deploying to staging

| Item | Done | Owner |
|------|------|-------|
| Code reviewed and approved | [ ] | |
| Tests passing locally (agent, proxy, webapp as applicable) | [ ] | Eng |
| GitHub environment variables configured for staging | [ ] | Eng |
| Dependencies updated; lockfiles committed | [ ] | Eng |
| Documentation updated for behavior changes | [ ] | Eng |

### 8.2 Before deploying to production

| Item | Done | Owner |
|------|------|-------|
| Tested thoroughly in staging (smoke + critical paths) | [ ] | Eng |
| Stakeholder approval obtained | [ ] | Product |
| Release notes / changelog prepared | [ ] | Product |
| Rollback plan documented and tested | [ ] | Eng |
| Monitoring & alerts configured (§3) | [ ] | Ops |
| Team notified of deploy window | [ ] | Ops |
| Backup / export taken if schema or data migration | [ ] | Eng |
| GitHub **prod** environment protection + required reviewers | [ ] | Ops |
| All **Critical** rows in §1–4 signed off | [ ] | Launch lead |

### 8.3 Deploy sequence (production)

Manual `workflow_dispatch` to **prod** (recommended order):

1. [ ] [Deploy Homecare Agent](../../.github/workflows/deploy-homecare-agent.yaml) (if agent changed)
2. [ ] [Deploy Agent Proxy](../../.github/workflows/deploy-homecare-agent-proxy.yaml)
3. [ ] [Deploy Workers](../../.github/workflows/) (checkpoint, user-docs, document-analysis, metrics — as needed)
4. [ ] [Deploy Webapp](../../.github/workflows/deploy-webapp-apphosting.yaml)
5. [ ] [Deploy Mapp](../../.github/workflows/deploy-mapp-build.yaml) / OTA only if mobile GA

### 8.4 After production deploy

| Item | Done | Owner |
|------|------|-------|
| Smoke tests passed (see [PRODUCT_HUNT_LAUNCH.md](./PRODUCT_HUNT_LAUNCH.md) §4) | [ ] | Eng |
| Monitoring shows no error spike (30–60 min) | [ ] | Ops |
| Latency / instance count normal | [ ] | Ops |
| Users notified if breaking change | [ ] | Product |
| Post-deployment review scheduled | [ ] | Product |

---

## 9. Documentation accuracy

| # | Item | Done | Owner |
|---|------|------|-------|
| 9.1 | `docs/proxy/API_OVERVIEW.md` matches implementation (rate limits, CORS) | [ ] | Eng |
| 9.2 | Retired `docs/analysis/` tree removed; agent docs point to `property_agent/ARCHITECTURE.md` | [x] | Eng |
| 9.3 | `docs/deployment/ENVIRONMENTS.md` aspirational monitoring flags updated | [ ] | Eng |
| 9.4 | GitHub env vars in `.github/GITHUB_VARIABLES_SETUP.md` — no prod placeholders | [ ] | Eng |

---

## 11. Future infrastructure (post-GA — deferred)

**Does not block Product Hunt or GA.** Track engineering detail in [LAUNCH_PLAN_PROGRESS.md § Phase 4](./LAUNCH_PLAN_PROGRESS.md#phase-4--future-infrastructure-post-ga).

| # | Priority | Item | When to do | Notes |
|---|----------|------|------------|-------|
| 11.1 | **Low** | **Google Cloud API Gateway** in front of Cloud Run proxy | Post-GA / scale | New public API hostname; update `NEXT_PUBLIC_API_BASE_URL` + mapp `PROXY_BASE_URL`; paths can stay `/firebase-agent-stream`, etc. |
| 11.2 | **Low** | Custom API domain on gateway (`api.asset-mem.com`, `api.asset-mem.com`) | With 11.1 | DNS + TLS on gateway; add origin to proxy CORS |
| 11.3 | **Low** | Optional Cloud Run ingress = gateway-only | After 11.1 verified | Retire direct `*.run.app` client access |
| 11.4 | **Low** | Distributed rate limits (Memorystore Redis or Firestore) | If multi-instance abuse | Complements proxy `PROXY_RATE_LIMIT_*`; not required for PH |

**Clarification:** “API gateway” in repo docs often means the **FastAPI proxy** ([`gcp/proxy/`](../../gcp/proxy/)). Section 11.1 is the **GCP managed API Gateway** product in front of that service.

---

## 10. Sign-off summary

### Phase gates

| Gate | Required items | Approved | Date | Approver |
|------|----------------|----------|------|----------|
| **Product Hunt** | PH doc §3 + §8.2 subset; legal links live | [ ] | | |
| **Production GA** | All §1 Critical + §4 Critical + §8.2 + §8.4 | [ ] | | |
| **Post-GA (30 days)** | Remaining Medium items or dated exceptions | [ ] | | |

### Exceptions (if any)

Document deferred items with owner and due date:

| Item ID | Reason deferred | Due date | Approver |
|---------|-----------------|----------|----------|
| | | | |

### Final approval

| Role | Name | Date |
|------|------|------|
| Engineering lead | | |
| Product | | |
| Operations | | |
| Legal / compliance | | |

**Production GA approved:** [ ] Yes  [ ] No

---

## Related documentation

- [Launch Plan Progress](./LAUNCH_PLAN_PROGRESS.md)
- [Product Hunt Launch](./PRODUCT_HUNT_LAUNCH.md)
- [Environments](./ENVIRONMENTS.md)
- [Quick Reference](./QUICK_REFERENCE.md)
- [Checkpoint Scalability Recommendations](../checkpoint/CHECKPOINT_SCALABILITY_RECOMMENDATIONS.md)
- [Architecture](../../gcp/docs/ARCHITECTURE.md)
- [Token quota](../../gcp/common/token/README.md)
