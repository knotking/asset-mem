# Product Hunt Launch Checklist

Operational checklist for launching **AssetMem AI** (web) on Product Hunt. This complements the broader [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md). Engineering work for PH is tracked in phases in the repo launch plan; this doc is for **listing assets, URLs, launch-day ops, and smoke validation**.

**Primary audience:** Web app only for PH (mobile is not public on stores; see [Mobile Deployment](./MOBILE_DEPLOYMENT.md)).

**Related docs:** [Launch Plan Progress](./LAUNCH_PLAN_PROGRESS.md) · [Environments](./ENVIRONMENTS.md) · [Webapp Deployment](./WEBAPP_DEPLOYMENT.md) · [Proxy Deployment](./PROXY_DEPLOYMENT.md) · [Client Logging](../CLIENT_LOGGING.md)

---

## Timeline overview

| When | Focus |
|------|--------|
| **T-7 days** | Staging smoke test, PH assets draft, legal/footer links live |
| **T-3 days** | Prod smoke test, analytics + UTM verified, team roles assigned |
| **T-1 day** | Final gallery/video, maker comment drafted, on-call confirmed |
| **Launch day (T-0)** | Post at 12:01 AM PT, monitor + reply to comments for 8+ hours |
| **T+1 to T+7** | Retrospective, convert PH traffic metrics, triage feedback |

Classic PH window: **Tuesday–Thursday**, **12:01 AM Pacific**.

---

## 1. Product Hunt listing assets

Complete on [producthunt.com](https://www.producthunt.com) (not in repo). Use consistent branding: **AssetMem AI** (matches web landing).

### Required fields

| Field | Guidance | Owner | Done |
|-------|----------|-------|------|
| **Name** | AssetMem AI (or final public name) | Marketing | [ ] |
| **Tagline** | ≤60 chars; one clear outcome, e.g. “AI home diagnostics from photos and documents” | Marketing | [ ] |
| **Description** | Problem → solution → who it’s for → how to try (3 short paragraphs) | Marketing | [ ] |
| **Primary link** | Production web URL with UTM (see §2) | Eng | [ ] |
| **Gallery** | 4–6 images or GIFs (see shot list below) | Design | [ ] |
| **Video** | 60–90s demo (optional but strongly recommended) | Design | [ ] |
| **Topics** | AI, Productivity, Home, etc. (pick 3–5) | Marketing | [ ] |
| **Maker(s)** | Founders / core team profiles linked | Team | [ ] |

### Gallery shot list (recommended order)

1. Hero — landing value prop
2. Property dashboard — multiple homes
3. AI chat — structured answer (DIY / cost / coverage accordion)
4. Checkpoint timeline — photo + analysis
5. Document upload — RAG / doc chat context
6. (Optional) Mobile screenshot only if store link is live

### Maker comment (draft template)

Post immediately after launch as the **first comment**:

```text
Hey Product Hunt! 👋

We built AssetMem AI because home maintenance is scattered across manuals, photos, and guesswork.

Try it in 3 steps:
1. Sign up at [URL]
2. Add a property and upload a photo or document
3. Ask anything — “What’s wrong with this?” or “Is this covered?”

We’re live on web today. Would love feedback on [specific area: checkpoints / chat / docs].

[Name] — happy to answer every question today.
```

### First comment (team / supporters)

Prepare 2–3 authentic comments from team (not copy-paste spam). PH rewards genuine engagement.

---

## 2. URLs and tracking

### Primary link (Product Hunt)

Use production origin + UTM parameters:

```text
https://asset-mem.com/?utm_source=producthunt&utm_medium=referral&utm_campaign=launch
```

Adjust domain if production differs (see `apps/webapp/apphosting.prod.yaml` and DNS docs). Must match `NEXT_PUBLIC_SITE_URL` (see §2.1).

### 2.1 Environment variables (production web)

Configure in [`apps/webapp/apphosting.prod.yaml`](../../apps/webapp/apphosting.prod.yaml) before the prod deploy used for Product Hunt. Full table and phase status: [LAUNCH_PLAN_PROGRESS.md — Production web env vars](./LAUNCH_PLAN_PROGRESS.md#production-web-env-vars-product-hunt).

| Variable | Required for PH? | Action |
|----------|------------------|--------|
| `NEXT_PUBLIC_SITE_URL` | **Yes** | Set to canonical origin, e.g. `https://asset-mem.com` (no trailing slash) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | **Yes** | Monitored inbox, e.g. `support@asset-mem.com` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | **Recommended** | GA4 ID `G-XXXXXXXX` — **add to yaml before PH**; if omitted, analytics is disabled |
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** | Already in yaml — proxy base URL |
| `NEXT_PUBLIC_ENV` | **Yes** | `prod` |
| `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` (proxy) | **Yes** | Include `free` + Stripe Price ids; webapp reads limits via `/token-quota-status` |

**Deploy steps:**

1. Update `apphosting.prod.yaml` (and `apphosting.staging.yaml` for pre-PH smoke on staging).
2. Run GitHub Actions → **Deploy Webapp - AppHosting** → environment **prod**.
3. Firebase Console → App Hosting → **prod** backend → confirm env vars on the active rollout.
4. Local reference: [`apps/webapp/.env.example`](../../apps/webapp/.env.example).

| Step | Owner | Done |
|------|-------|------|
| `NEXT_PUBLIC_SITE_URL` matches live DNS / App Hosting URL | Eng | [ ] |
| `NEXT_PUBLIC_SUPPORT_EMAIL` monitored | Ops | [ ] |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` added to prod yaml (if using GA) | Eng | [ ] |
| Prod webapp redeployed after yaml change | Eng | [ ] |
| Vars verified on active rollout in Firebase Console | Eng | [ ] |

### UTM convention

| Parameter | Value |
|-----------|--------|
| `utm_source` | `producthunt` |
| `utm_medium` | `referral` |
| `utm_campaign` | `launch` (or `launch_YYYY_MM`) |

### Analytics events to verify (before PH)

Requires `NEXT_PUBLIC_GA_MEASUREMENT_ID` (§2.1). Implementation: `apps/webapp/src/lib/analytics.ts`, `GoogleAnalytics` + `UtmCapture` in `apps/webapp/src/app/layout.tsx`.

| Event | When |
|-------|------|
| `page_view` | Automatic via gtag config on load |
| `landing_cta_click` | “Get Started”, “Dashboard”, header CTAs (`trackLandingCta`) |
| `sign_up` | Successful signup — email or Google (`signup/page.tsx`, `method`: `email` \| `google`) |
| `onboarding_step_click` | Onboarding checklist step buttons (`home-onboarding-checklist.tsx`) |
| `first_property_created` | First property created via upload flow (`upload-documents-dialog.tsx`) |
| `first_chat_message` | First user message sent in property chat |

UTM params (`utm_source`, etc.) are stored in `sessionStorage` and attached to custom events.

| Verification | Done |
|--------------|------|
| GA4 DebugView shows events on staging/prod | [ ] |
| PH URL with `?utm_source=producthunt` → events include UTM in DebugView | [ ] |

### Social preview (Open Graph)

When hunters share the homepage on X/LinkedIn, verify preview shows title, description, and image (`apps/webapp/src/app/opengraph-image.tsx`, `lib/metadata-shared.ts`). Requires `NEXT_PUBLIC_SITE_URL` (§2.1). Test with [opengraph.xyz](https://www.opengraph.xyz) on prod URL.

---

## 3. Pre-launch engineering gates (PH minimum)

These are **required before posting on PH** (full production hardening is in [PRODUCTION_LAUNCH_CHECKLIST.md](./PRODUCTION_LAUNCH_CHECKLIST.md)).

| # | Gate | How to verify | Owner | Done |
|---|------|---------------|-------|------|
| 1 | Landing footer links work (Privacy, Terms, Contact) | Click every footer link on prod | Eng | [ ] |
| 2 | Signup → login → `/home` works | New test account on prod | Eng | [ ] |
| 3 | Add property → chat → one AI response | End-to-end on prod | Eng | [ ] |
| 4 | Optional: upload doc or checkpoint photo → analysis completes | Firestore + UI update | Eng | [ ] |
| ~~5~~ | ~~No placeholder nav (Providers/Services) exposed~~ | — | — | **N/A** — [plan §1.4 cancelled](./LAUNCH_PLAN_PROGRESS.md#14-cancelled) |
| 5 | Token quota UX clear when limit hit | Lower test user limit or simulate | Eng | [ ] |
| 6 | `maxInstances` / proxy scale reviewed for traffic spike | See `apphosting.prod.yaml`, Cloud Run console | Eng | [ ] |
| 7 | On-call person named for launch day | See §5 | Ops | [ ] |
| 8 | Production web env vars set and deployed (§2.1) | Firebase Console rollout + OG/analytics check | Eng | [ ] |

**Phase 1 engineering status:** [LAUNCH_PLAN_PROGRESS.md](./LAUNCH_PLAN_PROGRESS.md) (§1.1–1.3, §1.5–1.6; ~~§1.4 cancelled~~).

**Not required for PH day 1 (before GA):** Firebase ID token on proxy, API rate limiting, full alerting-as-code — see production checklist Phase 2.

---

## 4. Smoke test script (staging then prod)

Run **48 hours before** PH on **staging**, then repeat on **prod** after final deploy.

### 4.1 Web signup and property

```text
[ ] Open landing (logged out)
[ ] Click Get Started → signup with new email
[ ] Redirected to /home
[ ] Create property (name + address)
[ ] Property card appears
```

### 4.2 AI chat

```text
[ ] Open property → AI Chat
[ ] Send: "What maintenance should I do this season?"
[ ] Stream completes; no TOKEN_QUOTA_EXCEEDED (unless testing quota)
[ ] Session persists on refresh
```

### 4.3 Checkpoint (optional wow moment)

```text
[ ] Open Timeline / Checkpoints
[ ] Create checkpoint with photo
[ ] Analysis moves pending → completed (or clear error state)
[ ] Metrics / summary visible in UI
```

### 4.4 Documents (optional)

```text
[ ] Upload PDF or image to property
[ ] Doc appears in library
[ ] Ask chat question referencing uploaded doc
```

### 4.5 Failure paths

```text
[ ] Wrong password → clear error on login
[ ] Logout → /login; cannot access /home
[ ] Shared chat link /share/[id] loads for public read (if promoting shares)
```

Record results in a thread or doc: date, environment, tester, pass/fail notes.

---

## 5. Launch day operations

### Roles

| Role | Responsibility |
|------|----------------|
| **Launch lead** | Posts PH listing, coordinates timing |
| **Comment responder** | Replies to PH comments within ~1 hour (first 8h critical) |
| **On-call eng** | Cloud Run, Vertex, Firestore, proxy errors |
| **Support** | Email/DM for broken signup or billing questions |

### Hour-by-hour (launch day)

| Time (PT) | Action |
|-----------|--------|
| 12:00 AM | Final smoke on prod (signup + one chat) |
| 12:01 AM | Publish PH listing + maker comment |
| 12:15 AM | Team upvote/comment (authentic, not brigading) |
| 1–8 AM | Monitor errors; reply to every PH comment |
| 9 AM–6 PM | Peak traffic — watch Cloud Run, token quota, signup rate |
| EOD | Snapshot metrics; thank top commenters |

### Dashboards to watch

- Firebase App Hosting / Cloud Run: 5xx, latency, instance count
- Cloud Run proxy: request count, errors
- Firestore: write rates
- `llm_token_usage` / `TOKEN_QUOTA_EXCEEDED` rate in logs
- Firebase Auth: signup count spike

### Rollback triggers

| Symptom | Action |
|---------|--------|
| Proxy 5xx &gt; 5% for 10 min | Roll back proxy via [Proxy Deployment](./PROXY_DEPLOYMENT.md) workflow |
| Webapp broken | Roll back App Hosting rollout |
| Runaway Vertex cost | Enable stricter quota; post PH comment with status |
| Auth broken | Pause PH promotion; fix Firebase config |

### Rollback commands (reference)

- Webapp: GitHub Actions → **Deploy Webapp** → previous rollout, or Firebase console rollouts
- Proxy: GitHub Actions → **Deploy Homecare Agent Proxy** → redeploy previous revision
- Do **not** force-push `main`; use workflow dispatch to `staging`/`prod` per [CICD](./CICD.md)

---

## 6. FAQ for PH comments

Copy/adapt for quick replies.

| Question | Suggested answer |
|----------|------------------|
| **How is this different from ChatGPT?** | We’re built for homes: property context, document RAG, checkpoint photos over time, and structured DIY/cost/coverage outputs tied to your property. |
| **Is it free?** | [State current pricing / free tier / token limits.] |
| **Mobile app?** | Web is live for PH; iOS/Android [in TestFlight / coming soon / store link]. |
| **Privacy / data?** | We store property data you upload (photos, docs, addresses) to provide the service. See our Privacy Policy at [URL]. |
| **What countries?** | [State supported regions / English only / etc.] |
| **Can I delete my account?** | [State self-serve status; if not yet, provide support email.] |

---

## 7. Post-launch (T+1 to T+7)

| Task | Owner | Done |
|------|-------|------|
| Export PH traffic: signups, UTMs, conversion to first chat | Marketing | [ ] |
| Triage top UX bugs from comments | Product | [ ] |
| Retrospective: what broke, what to fix before GA | Eng | [ ] |
| Thank-you post or changelog | Marketing | [ ] |
| Optional: PH badge on site footer | Marketing | [ ] |

---

## 8. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Launch lead | | | |
| Engineering | | | |
| Product / marketing | | | |

**Launch approved for Product Hunt:** [ ] Yes  [ ] No — blockers: _______________

---

## Related checklists

- [Launch Plan Progress](./LAUNCH_PLAN_PROGRESS.md) — phase tasks, completion status, env TODOs
- [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md) — security, compliance, ops for GA
- [Environment Configuration](./ENVIRONMENTS.md) — env matrix and deploy triggers
