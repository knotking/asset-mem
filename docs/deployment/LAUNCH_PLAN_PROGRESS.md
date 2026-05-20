# Launch Plan Progress

Tracks **engineering phases** for Product Hunt → production GA. Operational checklists live in [Product Hunt Launch](./PRODUCT_HUNT_LAUNCH.md) and [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md).

**Status:** `[ ]` Not started · `[~]` In progress · `[x]` Done

**Last updated:** 2026-05-19

---

## Phase overview

| Phase | Goal | Target | Status |
|-------|------|--------|--------|
| **1** | Product Hunt readiness (web) | Weeks 1–2 | `[~]` In progress |
| **2** | Security & API hardening | Weeks 2–4 | `[ ]` Not started |
| **3** | Production GA (compliance, ops, CI) | Weeks 4–6 | `[ ]` Not started |

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
| Google sign-in on web | `[ ]` | Parity with `apps/mapp/app/auth/login.tsx` |
| First-run onboarding on `/home` (empty properties) | `[ ]` | Add property → doc/photo → first chat |
| Optional PH promo banner (`utm_source=producthunt`) | `[ ]` | Landing or `/home` |

**Operational TODOs after 1.3:** Re-run PH smoke test §4 in [PRODUCT_HUNT_LAUNCH.md](./PRODUCT_HUNT_LAUNCH.md); confirm Google OAuth client IDs in Firebase console for web.

---

### 1.4 Hide or gate incomplete features

| Task | Status | Artifacts / notes |
|------|--------|-------------------|
| Providers/Services not in prod nav | `[x]` | Commented in `property layout.tsx` — verify no deep links |
| Mobile multi-checkpoint mock hidden | `[ ]` | `mapp/lib/api.ts`, `CheckpointAnalysisModal.tsx` |
| Service broker stub disabled in prod | `[ ]` | `gcp/proxy/api/services/service_broker_service.py` |

**Operational TODOs after 1.4:** Manual browse prod property tabs; confirm no placeholder data pages linked.

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
| Firebase ID token on all proxy routes | `[ ]` | `gcp/proxy/api/core/firebase_auth.py` (new) |
| Client `proxyFetchWithAuth` (web + mapp) | `[ ]` | Strip secret from `NEXT_PUBLIC_API_BASE_URL` |
| Dual-mode migration / secret rotation | `[ ]` | [PRODUCTION_LAUNCH_CHECKLIST §1](./PRODUCTION_LAUNCH_CHECKLIST.md#1-security-critical--high) |
| CORS allowlist | `[ ]` | `main.py` |
| Per-UID rate limiting | `[ ]` | |
| Readiness health (503 if engine down) | `[ ]` | |
| Proxy `initialize_observability()` | `[ ]` | |
| Proxy tests in PR CI | `[ ]` | `run_tests.sh` workflow |

**Operational TODOs after Phase 2:**

- [ ] Deploy **proxy** to staging → prod before or with client releases.
- [ ] Rotate `FIREBASE_WEBHOOK_SECRET`; update GitHub env + apphosting/mapp URLs.
- [ ] Full regression: signup, chat stream, checkpoint, documents.
- [ ] Update [PRODUCTION_LAUNCH_CHECKLIST](./PRODUCTION_LAUNCH_CHECKLIST.md) §1 sign-off.

---

## Phase 3 — Production GA

| Task | Status | Notes |
|------|--------|-------|
| Account deletion + data export | `[ ]` | Settings UI |
| Data retention policy + automation | `[ ]` | |
| Alert policies + runbooks | `[ ]` | |
| Pub/Sub DLQ | `[ ]` | `create-environment.yaml` |
| Webapp lint/typecheck + E2E in CI | `[ ]` | |
| Checkpoint pagination / shared chat hardening | `[ ]` | |
| Agent production disclaimer resolved | `[ ]` | `gcp/agents/homecare/README.md` |

**Operational TODOs after Phase 3:**

- [ ] [PRODUCTION_LAUNCH_CHECKLIST](./PRODUCTION_LAUNCH_CHECKLIST.md) **Critical** + **High** signed off.
- [ ] Post-GA review scheduled; Medium items dated or closed.

---

## Production web env vars (Product Hunt)

Set in [`apps/webapp/apphosting.prod.yaml`](../../apps/webapp/apphosting.prod.yaml) (BUILD + RUNTIME). Local dev: [`apps/webapp/.env.example`](../../apps/webapp/.env.example).

| Variable | Required for PH? | Prod value (default in repo) | Purpose |
|----------|------------------|------------------------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** | Proxy URL + path prefix | API calls |
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

- [Product Hunt Launch](./PRODUCT_HUNT_LAUNCH.md)
- [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md)
- [Webapp Deployment](./WEBAPP_DEPLOYMENT.md)
- [Environments](./ENVIRONMENTS.md)
