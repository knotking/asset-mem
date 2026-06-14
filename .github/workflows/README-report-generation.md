# Deploy Report Generation Function

Deploys `gcp/proxy/workers/function/report_generation/` — Pub/Sub-triggered snapshot PDF generation for property reports.

## Prerequisites

GitHub environment variables (set by `create-environment.yaml` or manually):

| Variable | Example |
|----------|---------|
| `REPORT_GENERATION_TOPIC` | `report-generation-topic-staging` |
| `USER_UPLOAD_TOPIC` | `user-upload-topic-staging` (re-import `.md` when `includeInDocsChat` on regenerate) |
| `GCS_BUCKET` | `homegeek-user-data-staging` |
| `REPORT_PDF_RENDERER` | Set to `playwright` in deploy env (falls back to xhtml2pdf if Chromium unavailable) |
| `PLAYWRIGHT_BROWSERS_PATH` | Set to `/workspace/ms-playwright` by deploy workflow (Chromium bundled at build time) |
| `REPORT_DOCS_CHAT_RAG_ENABLED` | Optional `true` to allow report `.md` RAG indexing (default off; must match proxy + client flags) |
| `GCP_PROJECT_ID`, `GCP_REGION`, `WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL` | (shared with other workers) |

**Proxy** must also have `REPORT_GENERATION_TOPIC` (deploy `deploy-homecare-agent-proxy.yaml` after setting the var).

## Manual topic (existing environments)

```bash
gcloud pubsub topics create report-generation-topic-staging --project=PROJECT_ID
```

Set `REPORT_GENERATION_TOPIC=report-generation-topic-staging` on the GitHub `staging` environment.

## Invoke

```bash
gh workflow run deploy-report-generation.yaml -f environment=staging
gh workflow run deploy-homecare-agent-proxy.yaml -f environment=staging
```

## Orchestrator

Included as **deploy_report_generation** in [deploy-orchestrator.yaml](deploy-orchestrator.yaml) (Workers group). Enable it alongside proxy deploy when shipping report PDF changes.

## Troubleshooting

**Pub/Sub deliveries return 403 / reports stuck on `generating`:** The underlying Cloud Run service needs `run.googleapis.com/invoker-iam-disabled=true` (same as checkpoint analysis). The deploy workflow sets this post-deploy. Manual fix:

```bash
gcloud run services update pubsub-report-generation-staging \
  --project=homegeek-staging --region=us-central1 \
  --update-annotations=run.googleapis.com/invoker-iam-disabled=true
```

Check logs:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="pubsub-report-generation-staging"' \
  --project=homegeek-staging --limit=20 --freshness=1h
```

**Container healthcheck failed / `ModuleNotFoundError: No module named 'common.report'`:** The deploy job rsyncs `gcp/common/token` and `gcp/common/report` into `report_generation/common/` before upload. PDF rendering imports `common.report.renderer`; omitting `report` causes import failure at cold start.

**Playwright falls back to xhtml2pdf (`Executable doesn't exist at .../ms-playwright/...`):** The deploy workflow runs `scripts/install-playwright-browsers.sh` (`playwright install --only-shell chromium`) before upload. Confirm `PLAYWRIGHT_BROWSERS_PATH=/workspace/ms-playwright` and log lines `Report PDF rendered with playwright` (WARNING level — visible in Cloud Logging).

**Fast PDF / unsure which renderer:** Search logs for `Report PDF render start` and `Report PDF rendered with playwright|xhtml2pdf` on `pubsub-report-generation-ENV`.
