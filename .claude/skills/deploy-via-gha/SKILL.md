---
name: deploy-via-gha
description: Map of which GitHub Actions workflow deploys which HomeApp surface (webapp, mapp, proxy, agent, workers, environments) and how to invoke them. Use whenever the user asks how to deploy, ship, release, or roll out anything in this repo. Reinforces that GitHub Actions is the canonical path — not raw gcloud snippets and not Terraform.
---

# Deploying HomeApp via GitHub Actions

The canonical deployment path for **everything** in this repo is the workflows under `.github/workflows/`. They use `gcloud` directly (not Terraform — `gcp/terraform/` exists but is not the live source of truth) and are wired up to Workload Identity Federation with the `githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com` service account.

There is also `.github/workflows/README.md` and `.github/GITHUB_VARIABLES_SETUP.md` for environment + variable plumbing.

## Workflow → surface map

| Surface                                     | Workflow                           | What it does                                                                                                                                      |
| ------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertex AI Agent Engine (homecare ADK agent) | `deploy-homecare-agent.yaml`       | `uv run python deployment/deploy.py create/update` from `gcp/agents/homecare/`. Updates `AGENT_ENGINE_ID` env var on the proxy.                   |
| FastAPI proxy → Cloud Run                   | `deploy-homecare-agent-proxy.yaml` | Stages `gcp/common` into `gcp/proxy/api/common`, then `gcloud run deploy --source=gcp/proxy/api`. Image is built from `gcp/proxy/api/Dockerfile`. |
| Checkpoint analysis Cloud Function          | `deploy-checkpoint-analysis.yaml`  | Deploys `gcp/proxy/workers/function/checkpoint_analysis/` (Pub/Sub trigger).                                                                      |
| Document analysis Cloud Function            | `deploy-document-analysis.yaml`    | Deploys `gcp/proxy/workers/function/document_analysis/` (Pub/Sub trigger for async doc extraction).                                               |
| Checkpoint metrics Cloud Function           | `deploy-checkpoint-metrics.yaml`   | Deploys `gcp/proxy/workers/function/checkpoint_metrics/`.                                                                                         |
| User docs RAG Cloud Function                | `deploy-pubsub-user-docs.yaml`     | Deploys `gcp/proxy/workers/function/user_docs/` (uploads → RAG corpus).                                                                           |
| Webapp → Firebase App Hosting               | `deploy-webapp-apphosting.yaml`    | Builds and ships `apps/webapp` via App Hosting (`apphosting.yaml` / `apphosting.staging.yaml` / `apphosting.prod.yaml`).                          |
| Mobile native build                         | `deploy-mapp-build.yaml`           | EAS build of `apps/mapp` (iOS / Android binaries).                                                                                                |
| Mobile OTA update                           | `deploy-mapp-update.yaml`          | EAS Update — pushes a JS-only update to existing builds. Faster, no app-store roundtrip.                                                          |
| Provision a new GCP env                     | `create-environment.yaml`          | Project, IAM, WIF, buckets, Pub/Sub, RAG corpora, GitHub env vars.                                                                                |
| Tear down a GCP env                         | `destroy-environment.yaml`         | Inverse of the above.                                                                                                                             |

Each workflow has a companion README in `.github/workflows/README-<workflow>.md` with inputs, secrets, and gotchas.

## How to trigger

All deploy workflows are `workflow_dispatch`-triggered from the GitHub Actions UI. Pick **environment** (e.g. `staging`, `prod`) when prompted. Some are also wired to push triggers on the relevant paths — check the `on:` block of the workflow file before assuming a push will deploy.

```bash
# From the CLI, with gh installed
gh workflow run deploy-homecare-agent-proxy.yaml -f environment=staging
gh workflow run deploy-webapp-apphosting.yaml -f environment=staging
gh workflow run deploy-mapp-update.yaml -f environment=staging
```

Use `gh run watch` after to follow logs.

## Order of operations for a coordinated release

If a change touches both the agent and the proxy:

1. **Agent first** — `deploy-homecare-agent.yaml`. Note the new `AGENT_ENGINE_ID` from the run logs.
2. **Update GitHub env var** for the target environment so the proxy picks up the new engine ID.
3. **Proxy** — `deploy-homecare-agent-proxy.yaml`.
4. **Webapp + Mapp** if their callers need updating.

If a change touches `gcp/common/`, **every consumer** (proxy + all three workers) needs redeploying. There's no shared deploy — run each workflow.

## Environment variables and secrets

Per-environment values come from GitHub Environments (created by `create-environment.yaml` or by hand per `.github/GITHUB_VARIABLES_SETUP.md`). Pulled into workflows via `${{ vars.* }}` and `${{ secrets.* }}`. Do **not** hardcode env-specific values in workflow files.

The two webhook secrets — `FIREBASE_WEBHOOK_SECRET` and `TELEGRAM_WEBHOOK_SECRET` — must be the same value baked into the proxy and into the clients (mapp `PROXY_TOKEN`, webapp App Hosting yaml). If they drift, the proxy returns 404 because the URL prefix won't match the mounted routers.

## When NOT to use the workflows

- **Local iteration on the agent**: use `make run` / `make deploy` from `gcp/agents/homecare/` (the **run-homecare-agent** skill covers this). That deploys to the dev project under your own gcloud auth.
- **Local proxy run**: use uvicorn directly (the **run-proxy-local** skill).
- **One-shot manual gcloud deploys**: avoid. The `gcloud run deploy …` snippets in `gcp/proxy/README.md` are historical scratch notes — they're not gated, not environment-aware, and they bypass IAM bindings the workflow sets up. Only resort to them if Actions is broken and you need a hotfix, and reconcile via the workflow afterward.

## Checking what's currently deployed

```bash
gcloud run services list --region=us-central1
gcloud functions list --region=us-central1
gcloud ai reasoning-engines list --region=us-central1
gh run list --workflow=deploy-homecare-agent-proxy.yaml --limit 5
```

## Common gotchas

- **Proxy 500 after a redeploy** — check the run logs. If the staged `gcp/common` copy was missing files, the workflow's `cp -R gcp/common gcp/proxy/api/common` step needs review (or `.gcloudignore` was changed and is now excluding `common/`).
- **Mapp OTA pushes nothing** — `deploy-mapp-update.yaml` only updates existing native builds with a matching `runtimeVersion`. If you bumped native deps or `expo` SDK, you need a fresh build via `deploy-mapp-build.yaml` first.
- **App Hosting build fails on `fix-firebase-standalone.js`** — that script is required; don't remove it from `apps/webapp/package.json` `build`.
