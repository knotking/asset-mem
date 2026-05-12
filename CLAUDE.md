# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

HomeApp is a monorepo for an AI-powered property care platform. It contains three TypeScript clients (mobile, web, shared library) and a Python backend (FastAPI proxy + Vertex AI agent + Pub/Sub workers) deployed to Google Cloud Platform.

```
apps/                Frontend (npm workspaces, root package.json declares workspaces: apps/*)
├── common/          @homeapp/common — shared TS types, Firebase init, React contexts
├── mapp/            React Native + Expo SDK 54 mobile app
└── webapp/          Next.js 15 (App Router) web app
gcp/
├── agents/homecare/ Vertex AI ADK multi-agent system (Python, uv)
├── proxy/api/       FastAPI gateway → Cloud Run
├── proxy/workers/   Cloud Functions (Gen2) Pub/Sub workers
├── common/          Shared Python modules imported as `common.*` (token quota, pubsub, storage, gemini helpers)
└── terraform/       IaC (note: deployment is primarily GitHub Actions + gcloud, not Terraform)
```

## Common commands

### Install / bootstrap
```bash
npm install --legacy-peer-deps                         # root install (workspaces)
npm --prefix=apps/webapp install --legacy-peer-deps    # regenerate webapp lockfile
```
The `--legacy-peer-deps` flag is required because of `next-themes` ↔ React 19 peer conflicts.

### Frontend dev servers
```bash
cd apps/webapp && npm run dev          # Next.js on http://localhost:9002
cd apps/webapp && npm run dev:turbo    # Turbopack variant
cd apps/webapp && npm run genkit:dev   # Genkit AI flows (src/ai)

cd apps/mapp && npm run dev            # Expo (clears cache); also: npm run ios|android|web

cd apps/common && npm run build        # Build the shared lib (tsc --build); rerun after editing it
```

### Lint / typecheck / build
```bash
cd apps/webapp && npm run lint
cd apps/webapp && npm run typecheck
cd apps/webapp && npm run build        # next build, then scripts/fix-firebase-standalone.js

cd apps/mapp && npx tsc --noEmit       # mapp has no separate lint script
```

### Backend (Python, uv)
From `gcp/agents/homecare`:
```bash
make setup            # uv sync + .env from .env.example
make run              # adk run property_agent
make test-eval        # uv run pytest eval/
make test-full        # eval/test_eval.py::test_eval_full_conversation
make test-cost        # eval/test_eval.py::test_eval_cost_estimation
make test-products    # eval/test_eval.py::test_eval_product_recommendations
make test-service     # eval/test_eval.py::test_eval_service_provider
make deploy           # uv run python deployment/deploy.py create
make update           # uv run python deployment/deploy.py update
make grant-permissions
make lint             # uv run ruff check .
make format           # uv run ruff format .
make check            # ruff + mypy property_agent --ignore-missing-imports
```

Run a single pytest manually: `cd gcp/agents/homecare && uv run pytest eval/test_eval.py::test_name -v` — unit tests for agent wiring live under `tests/` (e.g. `tests/test_diy_agent.py`, `tests/test_service_agent.py`).

### Proxy API (FastAPI)
```bash
cd gcp/proxy/api
uvicorn main:app --host=0.0.0.0 --port=8080 --env-file=../.env --reload
bash run_tests.sh          # runs the test suite under tests/
```
`main.py` mutates `sys.path` so that `gcp/common` is importable as `common.*` whether running locally (from `gcp/proxy/api`) or in Docker (where GitHub Actions stages a copy of `gcp/common` next to `main.py` as `gcp/proxy/api/common`). For a one-shot local Docker build use `docker build -f gcp/Dockerfile.proxy gcp` from the repo root.

### Manual token-usage smoke test
```bash
cd gcp/proxy
export FIREBASE_WEBHOOK_SECRET=...   # from .env / .env.staging
export TEST_USER_ID=your-firebase-uid
python scripts/test_token_usage_request.py            # buffered POST
python scripts/test_token_usage_request.py --stream-chunks
```

## Architecture — the big picture

### Request flow for AI features
1. **Client** (`apps/mapp` or `apps/webapp`) authenticates via Firebase Auth, then calls the proxy. Mobile sends through `apps/mapp/lib/api.ts`; the web app talks to Firebase directly + uses `apps/webapp/src/lib/api-checkpoint.ts`. The proxy URLs are environment-injected (`apps/mapp/app.config.js` `extra.*`, webapp `apphosting*.yaml`).
2. **Proxy API** (`gcp/proxy/api`, FastAPI on Cloud Run) routes are mounted under `/{FIREBASE_WEBHOOK_SECRET}` so the secret acts as a path prefix bearer. `main.py` only mounts agent/document/checkpoint/service-broker/token-quota routers when `FIREBASE_WEBHOOK_SECRET` is set; `POST /token-quota-status` is also exposed unprefixed for local dev. Routers (`routers/`) → services (`services/`) → either Vertex AI Reasoning Engine (`vertex_service.py`) or Gemini direct (`checkpoint_service.py` for comparisons) or Pub/Sub (`document_service.py` queues doc extraction; worker runs Gemini).
3. **Vertex AI Agent Engine** runs `gcp/agents/homecare/property_agent`, an ADK app whose **root** (`property_agent`) delegates to **`doculink_agent`**, which selects among tools/sub-agents under `property_agent/sub_agents/` (e.g. `user_docs_agent`, `knowledge_base_agent`, `checkpoint_agent`, and—when requested—`checkpoint_analysis_agent` with coverage, diy, service, cost, shopping, etc.). Routing is driven by `prompts.py` (`primary_agent`, `checkpoint_ids`, and legacy rules), not a separate top-level `analysis_agent` package in the current repo layout.
4. **Async workers** (`gcp/proxy/workers/function/`) are Pub/Sub-triggered Cloud Functions:
   - `user_docs` — imports user uploads into the Vertex AI RAG corpus
   - `checkpoint_analysis` — analyzes checkpoint media via Gemini, writes Firestore
   - `checkpoint_metrics` — aggregates per-property metrics
   The proxy publishes to topics on upload and listens to result subscriptions in a background task.
5. **Firebase** (Auth, Firestore, Storage) is the system of record. Both clients listen to Firestore for live updates (sessions, messages, checkpoint analysis results, token usage). Storage rules / Firestore rules / indexes live in `apps/webapp/`.

### Token quota system (cross-cutting)
Every Reasoning Engine `stream_query`, every Gemini `generate_content`/`embed_content` call in the checkpoint worker, and every document-analysis worker job (queued via `extract-doc-info`) increments counters in Firestore `llm_token_usage/{userId}` (root doc + `periods/{YYYY-MM}` subcollection). Schema is in `gcp/common/token/README.md`.

Quota resolution order, enforced by `gcp/common/token/quota.py`:
1. Per-user override: `users/{userId}/preferences/user.monthlyTokenLimit` (positive number wins)
2. Env default: `TOKEN_QUOTA_PERIOD_MAX_TOKENS` (unset/`0` ⇒ unlimited)

Over-limit responses use `code: TOKEN_QUOTA_EXCEEDED`. The webapp queries `POST /token-quota-status` to render the AI usage bar — do not duplicate `TOKEN_QUOTA_PERIOD_MAX_TOKENS` into webapp build env.

### Shared frontend package (`apps/common`)
`@homeapp/common` is the seam between mapp and webapp. It exports per-context entry points (see `apps/common/package.json` `exports`) and uses **conditional exports** for Firebase: `./firebase` resolves to `firebase-native.ts` for React Native and `firebase-web.ts` elsewhere. After editing anything under `apps/common/src`, run `npm run build` in that package and the consumers will pick it up via the workspace symlink. Firebase project config is hardcoded per environment (`dev`/`staging`/`prod`) in `apps/common/src/firebase/firebase-config.ts` and selected via `Constants.expoConfig.extra.appEnv`.

React contexts are the main state-management mechanism in both clients (auth, session, property, properties-list, checkpoint, document upload, llm token usage, preferences). When you add a new context, add an entry to the `exports` map in `apps/common/package.json`.

### Shared backend package (`gcp/common`)
Imported as `common.*` from both `gcp/proxy/api/` and `gcp/proxy/workers/function/*`. Includes: `token/` (quota + Firestore counters), `pubsub/`, `storage/`, `geocoding/`, `observability/`, and several `gemini_*` helpers (`gemini_file_search`, `gemini_google_search`, `gemini_maps_grounding`, `gemini_robotics`, `gemini_url_context`), plus `cpaas/` and `conv_ai/`. The same code is shipped into worker deployments and into the proxy Docker image — keep it import-clean (no top-level side effects that depend on FastAPI / functions runtime).

### Deployment
GitHub Actions in `.github/workflows/` deploys everything via `gcloud` (Terraform exists in `gcp/terraform/` but the canonical path is gcloud-based workflows):
- `deploy-homecare-agent.yaml` — Vertex AI Agent Engine
- `deploy-homecare-agent-proxy.yaml` — Cloud Run for `gcp/proxy/api`
- `deploy-checkpoint-analysis.yaml`, `deploy-checkpoint-metrics.yaml`, `deploy-pubsub-user-docs.yaml` — Cloud Functions workers
- `deploy-webapp-apphosting.yaml` — Firebase App Hosting (Next.js)
- `deploy-mapp-build.yaml`, `deploy-mapp-update.yaml` — EAS builds / OTA updates
- `create-environment.yaml` / `destroy-environment.yaml` — provisions a full GCP environment (project, IAM, WIF, buckets, Pub/Sub, RAG corpora, GitHub env vars)

Docs in `gcp/docs/SETUP_AND_DEPLOYMENT.md` and `gcp/docs/ARCHITECTURE.md` go deeper. The proxy README contains deployment notes but many of the gcloud snippets are historical scratch-pad — prefer the workflow files as the source of truth.

## Notes that will save you time

- **Workspaces are flat** (`apps/*`); there's no top-level lint/test script, run commands inside each app dir.
- The webapp build runs `node scripts/fix-firebase-standalone.js` after `next build` to patch Firebase for Next standalone output — don't remove that step.
- Webapp dev port is **9002**, not 3000.
- Mobile app reads runtime config from `app.config.js` → `Constants.expoConfig.extra.*` (e.g. `agentSessionUrl`, `agentSseUrl`, `ragFileUploadUrl`, `checkpointAnalysisUrl`, `webAppUrl`); these come from EAS build profiles in `eas.json`.
- The `gcp/proxy/api/.gcloudignore` is intentional: it forces a staged copy of `gcp/common` (which is git-ignored at that location) into the Cloud Run upload.
- Python tests in `gcp/agents/homecare/eval/` are evaluation tests against the agent — they hit Vertex AI and need credentials + a deployed/reachable corpus.
