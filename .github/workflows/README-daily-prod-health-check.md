# Daily Prod Health Check

Scheduled GitHub Actions workflow that checks **homegeek-prod** using **Workload Identity Federation** (no service account JSON keys), summarizes results with **Vertex AI**, and logs **LLM token usage**.

Uses a **dedicated read-only service account** — not the deployment SA.

## Schedule

| Cron (UTC)   | Local time |
|--------------|------------|
| `30 3 * * *` | 9:00 AM IST |

Manual run: **Actions → Daily Prod Health Check → Run workflow**.

Also runs on **push** to `ops/daily-prod-health-check-gha` (for testing before merge).

## What it does

1. Authenticates via WIF as `github-health-check@…` (read-only observability SA).
2. Collects metrics (last 24h by default):
   - Cloud Run service readiness
   - HTTP probes (webapp + agent proxy `/health`)
   - HTTP 5xx and ERROR log counts
   - Agent proxy usage (users, sessions, streams)
   - Firestore `support_requests` new messages (read-only)
   - Failed GitHub Actions runs in the window
3. Calls **Vertex AI** (`HEALTH_CHECK_LLM_MODEL`, default `gemini-3.1-flash-lite`) for a concise markdown summary.
4. Emails the summary via **Resend** (default: `prakashbask@buildgeek.ai`).
5. Persists:
   - **Cloud Logging** `homeapp-daily-health-check` — summary, token usage, key counters
   - **GitHub Actions step summary** — human-readable report
   - **Artifact** — full JSON per run
   - **Firestore** `ops_daily_health_checks/{runId}` — optional (off by default; needs write role)

## One-time setup

### 1. Provision read-only SA + IAM + WIF

```bash
chmod +x .github/scripts/grant-health-check-iam.sh
./.github/scripts/grant-health-check-iam.sh homegeek-prod BuildGeekAI/HomeApp
```

Creates `github-health-check@homegeek-prod.iam.gserviceaccount.com` with:

| Role | Purpose |
|------|---------|
| `roles/run.viewer` | Cloud Run status |
| `roles/logging.viewer` | Read logs |
| `roles/logging.logWriter` | Write token audit log entries |
| `roles/datastore.viewer` | Read `support_requests` |
| `roles/aiplatform.user` | Vertex summary (only non-read API) |

### 2. GitHub environment (`prod`)

| Variable | Example (prod) |
|----------|----------------|
| `GCP_PROJECT_ID` | `homegeek-prod` |
| `GCP_REGION` | `us-central1` |
| `WORKLOAD_IDENTITY_PROVIDER` | `projects/686746113874/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_HEALTH_CHECK_SERVICE_ACCOUNT_EMAIL` | `github-health-check@homegeek-prod.iam.gserviceaccount.com` _(default if unset)_ |
| `HEALTH_CHECK_LLM_MODEL` | _(optional)_ `gemini-3.1-flash-lite` _(script default if unset)_ |
| `HEALTH_CHECK_VERTEX_LOCATION` | _(optional)_ `global` _(required for `gemini-3.1-flash-lite`; do not use `us-central1`)_ |
| `HEALTH_CHECK_EMAIL_TO` | _(optional)_ `prakashbask@buildgeek.ai` _(comma-separated)_ |
| `HEALTH_CHECK_EMAIL_FROM` | _(optional)_ `AssetMem Ops <ops@buildgeek.ai>` _(must be a verified Resend sender)_ |

**Secret** (prod environment or repository):

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Resend API key (`re_…`) |

Do **not** use `GCP_SERVICE_ACCOUNT_EMAIL` (deployment SA) for this workflow.

### 3. Resend setup

1. Create a [Resend](https://resend.com) account and add/verify the **buildgeek.ai** domain.
2. Create an API key and add `RESEND_API_KEY` to GitHub **prod** secrets.
3. Ensure `HEALTH_CHECK_EMAIL_FROM` uses an address on the verified domain (default `ops@buildgeek.ai`).

If email fails with Resend **403 / error code 1010**, the HTTP client is missing a `User-Agent` header (fixed in `prod-daily-health-check.py`). Other 403s usually mean an unverified `from` domain.

Local runs skip email unless you export `RESEND_API_KEY`, or pass `--skip-email`.

### 4. Optional Firestore history

Default: **disabled** (read-only SA). To also write `ops_daily_health_checks/{runId}`:

```bash
gcloud projects add-iam-policy-binding homegeek-prod \
  --member="serviceAccount:github-health-check@homegeek-prod.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

Then set on the workflow job env: `HEALTH_CHECK_PERSIST_FIRESTORE=true`.

## Token usage

| Location | Field |
|----------|--------|
| Cloud Logging `homeapp-daily-health-check` | `llm.promptTokenCount`, `llm.candidatesTokenCount`, `llm.totalTokenCount` |
| GitHub run **Summary** tab | LLM token usage section |
| **Resend email** | HTML summary + token usage + link to Actions run |
| Firestore (optional) | same `llm` object on run doc |

This is **ops telemetry**, not user billing (`llm_token_usage`).

## Local dry run

```bash
gcloud auth application-default login
gcloud config set project homegeek-prod
export GCP_PROJECT_ID=homegeek-prod
pip install google-genai google-cloud-firestore
python .github/scripts/prod-daily-health-check.py --window-hours 24 --skip-email
```

## Files

| File | Purpose |
|------|---------|
| [daily-prod-health-check.yaml](./daily-prod-health-check.yaml) | Workflow |
| [../scripts/prod-daily-health-check.py](../scripts/prod-daily-health-check.py) | Collector + Vertex summary |
| [../scripts/grant-health-check-iam.sh](../scripts/grant-health-check-iam.sh) | Create SA + read-only IAM + WIF |
