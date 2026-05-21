# Launch Plan Progress

Tracks **engineering phases** for Product Hunt → production GA. Operational checklists live in [Product Hunt Launch](./PRODUCT_HUNT_LAUNCH.md) and [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md).

**Status:** `[ ]` Not started · `[~]` In progress · `[x]` Done

**Last updated:** 2026-05-21

---

## Phase overview

| Phase | Goal | Target | Status |
|-------|------|--------|--------|
| **1** | Product Hunt readiness (web) | Weeks 1–2 | `[~]` In progress (1.1–1.3 done; ~~1.4 cancelled~~) |
| **2** | Security & API hardening | Weeks 2–4 | `[~]` In progress (2.1–2.3 done; CI + secret rotation pending) |
| **3** | Production GA (compliance, ops, CI) | Weeks 4–6 | `[ ]` Not started |
| **4** | Future infrastructure (post-GA) | After GA | `[ ]` Planned — see [§ Phase 4](#phase-4--future-infrastructure-post-ga) |

---

## Phase 1 — Product Hunt readiness

### 1.1 Launch documentation

| Task | Status | Artifacts / notes |
|------|--------|-------------------|
| Product Hunt launch checklist | `[x]` | [PRODUCT_HUNT_LAUNCH.md](./PRODUCT_HUNT_LAUNCH.md) |
| Production GA checklist | `[x]` | [PRODUCTION_LAUNCH_CHECKLIST.md](./PRODUCTION_LAUNCH_CHECKLIST.md) |
| Phase progress tracker (this doc) | `[x]` | [LAUNCH_PLAN_PROGRESS.md](./LAUNCH_PLAN_PROGRESS.md) |
| Cross-links from deployment README / ENVIRONMENTS | `[x]` | [README.md](./README.md), [ENVIRONMENTS.md](./ENVIRONMENTS.md) |

**Operational TODOs after 1.1:** None (docs only).

---

### 1.2 Landing, trust, and social previews

| Task | Status | Artifacts / notes |
|------|--------|-------------------|
| Privacy, Terms, About pages | `[x]` | `apps/webapp/src/app/privacy/`, `terms/`, `about/` |
| Landing footer → real routes + `#contact` section | `[x]` | `landing-client.tsx` |
| Open Graph / Twitter metadata | `[x]` | `lib/metadata-shared.ts`, `landing/layout.tsx`, `app/opengraph-image.tsx` |
| Brand constants (`AssetMem AI`) | `[x]` | `lib/site.ts` |
| Google Analytics + UTM capture | `[x]` | `lib/analytics.ts`, `components/analytics/*`, root `layout.tsx` |
| Signup/login legal links + `sign_up` event | `[x]` | `signup/page.tsx`, `login/page.tsx` |
| `first_property_created` / `first_chat_message` events | `[x]` | `upload-documents-dialog.tsx`, chat `[sessionId]/page.tsx` |
| `.env.example` marketing vars | `[x]` | `apps/webapp/.env.example` |

**Operational TODOs after 1.2 (required before PH):**

- [ ] Set production env vars (see [§ Production web env vars](#production-web-env-vars-product-hunt) below).
- [ ] Deploy webapp to **prod** after updating `apphosting.prod.yaml` (or confirm vars in Firebase console).
- [ ] Verify OG preview: [opengraph.xyz](https://www.opengraph.xyz) on prod homepage.
- [ ] Verify analytics in GA4 DebugView (only if `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set).
- [ ] Click-test footer: Privacy, Terms, About, Contact mailto.

---

### 1.3 Conversion — signup and onboarding

| Task | Status | Artifacts / notes |
|------|--------|-------------------|
| Google sign-in on web | `[x]` | `auth-context.tsx` (`signInWithPopup`), `google-sign-in-button.tsx`, login + signup pages |
| First-run onboarding on `/home` (empty properties) | `[x]` | `home-onboarding-checklist.tsx` — 3 steps; hides after first upload |
| Optional PH promo banner (`utm_source=producthunt`) | `[x]` | `product-hunt-welcome-banner.tsx` on `/home` |
| Auth error messages (popup blocked, etc.) | `[x]` | `lib/auth-errors.ts` |

**Operational TODOs after 1.3:**

- [ ] Firebase Console → Authentication → Sign-in method → **Google** enabled for staging + prod projects.
- [ ] Firebase Console → Authentication → Settings → **Authorized domains** includes prod/staging App Hosting domains and `localhost`.
- [ ] Re-run PH smoke test §4 in [PRODUCT_HUNT_LAUNCH.md](./PRODUCT_HUNT_LAUNCH.md) including **Continue with Google** on signup.
- [ ] Verify onboarding checklist on new account; PH banner with `?utm_source=producthunt` on `/home`.

---

### ~~1.4 Hide or gate incomplete features~~ (cancelled — will not be done) {#14-cancelled}

**Status:** Cancelled. This phase is removed from the launch plan; no further work to hide Services, multi-checkpoint Analyze, or service-broker routes for Product Hunt.

| ~~Task~~ | ~~Status~~ | Notes |
|----------|------------|--------|
| ~~Gate placeholder / stub UI for PH~~ | — | Not pursuing |
| ~~`LAUNCH_FEATURES` hide list maintenance~~ | — | Optional flags in `apps/common/src/launch-features.ts` may remain in repo but are **not** a launch requirement |

**What still applies without §1.4:** Providers tab stays enabled (`webProvidersTab` / `mobileProvidersTab` = `true`). Other incomplete surfaces (e.g. Services placeholder page, multi-checkpoint mock analyze) may still be visible — address individually in Phase 2/3 or product backlog, not via this section.

---

### 1.5 PH-day scale prep

| Task | Status | Artifacts / notes |
|------|--------|-------------------|
| Raise `maxInstances` on prod App Hosting | `[ ]` | `apphosting.prod.yaml` (currently `1`) |
| Staging + prod smoke test | `[ ]` | [PRODUCT_HUNT_LAUNCH.md §4](./PRODUCT_HUNT_LAUNCH.md#4-smoke-test-script-staging-then-prod) |
| Launch-day on-call named | `[ ]` | [PRODUCT_HUNT_LAUNCH.md §5](./PRODUCT_HUNT_LAUNCH.md#5-launch-day-operations) |
| Monitor dashboards identified | `[ ]` | Cloud Run, Vertex, Firestore, token quota |

**Operational TODOs after 1.5:** Document on-call name in PH sign-off table; optional load test notes.

---

### 1.6 Product Hunt listing assets (non-repo)

| Task | Status | Owner |
|------|--------|-------|
| Tagline, gallery, video | `[ ]` | Marketing |
| Maker + first comment | `[ ]` | Team |
| Primary URL with UTM | `[ ]` | Marketing |

See [PRODUCT_HUNT_LAUNCH.md §1](./PRODUCT_HUNT_LAUNCH.md#1-product-hunt-listing-assets).

---

## Phase 2 — Security & API hardening

| Task | Status | Notes |
|------|--------|-------|
| Firebase ID token on all proxy routes | `[x]` | `gcp/proxy/api/core/firebase_auth.py`, `firebase_auth_middleware.py` |
| Client `proxyFetchWithAuth` (web + mapp) | `[x]` | `apps/common/src/lib/correlation-id.ts`, `proxy-auth.ts`, apphosting base URL without secret |
| Dual-mode migration / secret rotation | `[ ]` | [PRODUCTION_LAUNCH_CHECKLIST §1](./PRODUCTION_LAUNCH_CHECKLIST.md#1-security-critical--high) |
| CORS allowlist | `[x]` | `core/cors.py`, `PROXY_CORS_ORIGINS` env (defaults include `https://asset-mem.com`) |
| Per-UID rate limiting | `[x]` | `core/rate_limit.py`, `core/auth_deps.py`, `PROXY_RATE_LIMIT_*` env |
| Readiness health (503 if engine down) | `[x]` | `GET /health` returns 503 when Reasoning Engine unavailable |
| Proxy `initialize_observability()` | `[x]` | `core/observability_startup.py` (opt-in via `PROXY_OBSERVABILITY_*`) |
| Graceful Pub/Sub shutdown | `[x]` | `core/events.py` cancels streaming pull on shutdown |
| Proxy tests in PR CI | `[ ]` | `run_tests.sh` workflow |

**Operational TODOs after Phase 2:**

- [ ] Deploy **proxy** to staging → prod before or with client releases.
- [ ] Rotate `FIREBASE_WEBHOOK_SECRET`; update GitHub env + apphosting/mapp URLs.
- [ ] Full regression: signup, chat stream, checkpoint, documents.
- [ ] Update [PRODUCTION_LAUNCH_CHECKLIST](./PRODUCTION_LAUNCH_CHECKLIST.md) §1 sign-off.

---

## Phase 3 — Production GA

**Infra:** GCP provisioning and deploys via **GitHub Actions + `gcloud`** ([`create-environment.yaml`](../../.github/workflows/create-environment.yaml), `deploy-*.yaml`). Alert policies and DLQ: workflows or [`docs/deployment/`](./) scripts.

| Task | Status | Notes |
|------|--------|-------|
| Account deletion + data export | `[ ]` | Settings UI |
| Data retention policy + automation | `[ ]` | |
| Alert policies + runbooks | `[x]` | [OPERATIONS.md](./OPERATIONS.md), `.github/scripts/apply-monitoring-alerts.sh`, [apply-operations-config.yaml](../../.github/workflows/apply-operations-config.yaml) |
| Pub/Sub DLQ | `[x]` | `create-environment.yaml` + `.github/scripts/apply-pubsub-dlq.sh` |
| Graceful Pub/Sub shutdown (proxy) | `[x]` | `gcp/proxy/api/core/events.py` |
| Webapp lint/typecheck + E2E in CI | `[ ]` | |
| Checkpoint pagination / shared chat hardening | `[x]` | Cursor pagination in `@homeapp/common` + webapp context; share `expiresAt` + `noindex` + rules |
| Agent production disclaimer resolved | `[ ]` | `gcp/agents/homecare/README.md` |

**Operational TODOs after Phase 3:**

- [ ] [PRODUCTION_LAUNCH_CHECKLIST](./PRODUCTION_LAUNCH_CHECKLIST.md) **Critical** + **High** signed off.
- [ ] Post-GA review scheduled; Medium items dated or closed.

---

## Phase 4 — Future infrastructure (post-GA)

**Not required for Product Hunt or initial GA.** The FastAPI proxy on Cloud Run remains the public API surface until this phase.

### 4.1 Google Cloud API Gateway (optional front door)

| Task | Status | Notes |
|------|--------|-------|
| Provision API Gateway + API config (OpenAPI) per environment | `[ ]` | Staging first, then prod |
| Backend: existing `homecare-agent-proxy-{env}` Cloud Run service | `[ ]` | Same route paths (`/firebase-agent-stream`, etc.) |
| Public hostname (gateway default or custom domain, e.g. `api.homegeek.ai`) | `[ ]` | **Client URLs change** at cutover — update env below |
| Update `NEXT_PUBLIC_API_BASE_URL` (web) | `[ ]` | [`apphosting.*.yaml`](../../apps/webapp/apphosting.prod.yaml) — gateway origin, no path secret |
| Update `PROXY_BASE_URL` (mapp / EAS) | `[ ]` | [`apps/mapp/app.config.js`](../../apps/mapp/app.config.js), `eas.json` |
| Extend proxy CORS allowlist if gateway host differs | `[ ]` | `PROXY_CORS_ORIGINS` or `gcp/proxy/api/core/cors.py` defaults |
| Firebase Auth authorized domains (if using custom API domain) | `[ ]` | Firebase Console — only if browser calls that host |
| Optional: restrict Cloud Run ingress to gateway only | `[ ]` | Hides raw `*.run.app` URL after migration verified |
| Smoke test + rollback plan (keep `*.run.app` until stable) | `[ ]` | [PRODUCT_HUNT_LAUNCH.md §4](./PRODUCT_HUNT_LAUNCH.md#4-smoke-test-script-staging-then-prod) |

**What stays the same when gateway is added:**

- Firebase **ID token** auth on the proxy (`Authorization: Bearer`) — gateway does not replace Phase 2.1 unless you add separate edge policies.
- Per-UID **rate limits** and **token quota** on the proxy — still enforced in `gcp/proxy/api`.
- **Vertex / Pub/Sub / Firestore** — unchanged.

**What API Gateway can add later (why consider it):**

- Stable **custom API domain** instead of exposing `*.run.app`.
- Edge **quotas / API keys** for partners or abuse at the front door.
- Central place for **WAF / Cloud Armor** integration (with additional setup).

**What it does not solve alone:**

- **Global per-UID rate limits** across many Cloud Run instances — still in-memory today; use Firestore counters, Memorystore (Redis), or gateway + Redis if needed later.
- Replacing the FastAPI “gateway” in docs — today that term means this proxy service ([`gcp/proxy/README.md`](../../gcp/proxy/README.md)), not the GCP product.

**References:** [Cloud API Gateway overview](https://cloud.google.com/api-gateway/docs/about-api-gateway) · [PROXY_DEPLOYMENT.md — Future API Gateway](./PROXY_DEPLOYMENT.md#future-google-cloud-api-gateway) · [PRODUCTION_LAUNCH_CHECKLIST §11](./PRODUCTION_LAUNCH_CHECKLIST.md#11-future-infrastructure-post-ga--deferred)

**Operational TODOs when starting Phase 4:**

- [ ] Decide hostname: `*.gateway.dev` vs `api.homegeek.ai` / `api.asset-mem.com`.
- [ ] Document cutover: dual-run (Cloud Run + gateway) vs hard switch.
- [ ] Update [ENVIRONMENTS.md](./ENVIRONMENTS.md) proxy URL table after gateway is live.

---

## Production web env vars (Product Hunt)

Set in [`apps/webapp/apphosting.prod.yaml`](../../apps/webapp/apphosting.prod.yaml) (BUILD + RUNTIME). Local dev: [`apps/webapp/.env.example`](../../apps/webapp/.env.example).

| Variable | Required for PH? | Prod value (default in repo) | Purpose |
|----------|------------------|------------------------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** | Cloud Run proxy origin (no path secret) | API calls; Phase 4 may switch to API Gateway host |
| `NEXT_PUBLIC_ENV` | **Yes** | `prod` | Environment flag |
| `NEXT_PUBLIC_TOKEN_QUOTA_PERIOD_MAX_TOKENS` | **Yes** | `1000000` | AI usage UI fallback |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | `https://homegeek.ai` | OG canonical URLs, metadata |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | **Yes** | `support@homegeek.ai` | Contact section, legal pages |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | **Recommended** | *Not in yaml — add before PH* | GA4; omit = analytics off |
| `GOOGLE_BUILDABLE` | **Yes** | `apps/webapp` | Monorepo App Hosting build |

### Before Product Hunt — env checklist

| Step | Done |
|------|------|
| `NEXT_PUBLIC_SITE_URL` matches live domain (DNS / App Hosting) | [ ] |
| `NEXT_PUBLIC_SUPPORT_EMAIL` is monitored | [ ] |
| Add `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXX` to `apphosting.prod.yaml`, then deploy | [ ] |
| Redeploy prod webapp via [Deploy Webapp workflow](../../.github/workflows/deploy-webapp-apphosting.yaml) | [ ] |
| Confirm vars on rollout in Firebase Console → App Hosting → prod → Environment | [ ] |

**Staging:** Same vars in [`apphosting.staging.yaml`](../../apps/webapp/apphosting.staging.yaml) with staging site URL for pre-PH smoke tests.

Details: [WEBAPP_DEPLOYMENT.md — Marketing & analytics env vars](./WEBAPP_DEPLOYMENT.md#marketing--analytics-environment-variables).

---

## Related documents

- **Canonical infra:** [`.github/workflows/README.md`](../../.github/workflows/README.md)
- [Product Hunt Launch](./PRODUCT_HUNT_LAUNCH.md)
- [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md)
- [Webapp Deployment](./WEBAPP_DEPLOYMENT.md)
- [Proxy Deployment — Future API Gateway](./PROXY_DEPLOYMENT.md#future-google-cloud-api-gateway)
- [Environments](./ENVIRONMENTS.md)
