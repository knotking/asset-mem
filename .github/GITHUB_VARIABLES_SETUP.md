# GitHub Variables and Secrets Configuration

This document lists all GitHub Variables and Secrets that need to be configured for the workflows to function properly.

## Setup Instructions

### Repository-Level Configuration

1. Go to your repository: Settings → Secrets and variables → Actions
2. Add **Secrets** under the "Secrets" tab (repository-level secrets)
3. Add **Variables** under the "Variables" tab (common/shared variables)

### Environment-Level Configuration

1. Go to your repository: Settings → Environments
2. Create two environments: `staging` and `prod`
3. For each environment, add environment-specific variables (without STAGING/PROD prefixes)
4. This allows the same variable names to have different values per environment

## GitHub Secrets

Configure these under: **Settings → Secrets and variables → Actions → Secrets**

| Secret Name               | Description                            | Used By               |
| ------------------------- | -------------------------------------- | --------------------- |
| `TELEGRAM_BOT_TOKEN`      | Telegram bot authentication token      | Homecare Agent Proxy  |
| `TELEGRAM_WEBHOOK_SECRET` | Secret for Telegram webhook validation | Homecare Agent Proxy  |
| `FIREBASE_WEBHOOK_SECRET` | Secret for Firebase webhook validation | Homecare Agent Proxy  |
| `SERP_API_KEY`            | SerpAPI key for search functionality   | Homecare Agent Engine |

## GitHub Variables (Repository Level)

Configure these under: **Settings → Secrets and variables → Actions → Variables**

These variables are shared across all environments:

| Variable Name    | Value  | Description                    |
| ---------------- | ------ | ------------------------------ |
| `PYTHON_VERSION` | `3.12` | Python version for deployments |

## Environment-Specific Variables

Configure these under: **Settings → Environments → [staging/prod] → Environment variables**

Create the same variable names in both `staging` and `prod` environments with different values.

### Staging Environment Variables

Configure these in the **staging** environment:

| Variable Name                            | Value (Staging)                                                                                      | Description                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GCP_REGION`                             | `us-central1`                                                                                        | GCP region for all services                                                                                                                                                                                                                                                                                             |
| `WORKLOAD_IDENTITY_PROVIDER`             | `projects/321433914812/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Workload Identity Provider for GitHub Actions                                                                                                                                                                                                                                                                           |
| `GCP_PROJECT_ID`                         | `homegeek-staging`                                                                                   | GCP Project ID                                                                                                                                                                                                                                                                                                          |
| `GCP_PROJECT_NUMBER`                     | `321433914812`                                                                                       | GCP Project Number (numeric ID)                                                                                                                                                                                                                                                                                         |
| `GCP_SERVICE_ACCOUNT_EMAIL`              | `githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com`                                  | Service account for deployments                                                                                                                                                                                                                                                                                         |
| `GCS_BUCKET`                             | `homegeek-user-data`                                                                                 | GCS bucket for user data                                                                                                                                                                                                                                                                                                |
| `USER_UPLOAD_FOLDER`                     | `uploads`                                                                                            | Folder for user uploads                                                                                                                                                                                                                                                                                                 |
| `AGENT_STAGING_BUCKET`                   | `gs://homegeek-catalog`                                                                              | Agent staging bucket                                                                                                                                                                                                                                                                                                    |
| `REASONING_ENGINE_ID`                    | `1582298387439419392`                                                                                | Reasoning Engine ID (used to construct full path)                                                                                                                                                                                                                                                                       |
| `USER_UPLOAD_RAG_CORPUS`                 | `projects/homegeek-staging/locations/us-central1/ragCorpora/1689975760170778624`                     | RAG Corpus for user uploads                                                                                                                                                                                                                                                                                             |
| `KNOWLEDGE_BASE_RAG_CORPUS`              | `projects/homegeek-staging/locations/us-central1/ragCorpora/3419358017081049088`                     | RAG Corpus for knowledge base                                                                                                                                                                                                                                                                                           |
| `USER_UPLOAD_TOPIC`                      | `user-upload-topic`                                                                                  | Pub/Sub topic for user uploads                                                                                                                                                                                                                                                                                          |
| `USER_UPLOAD_RESULT_TOPIC`               | `user-upload-result-topic`                                                                           | Pub/Sub topic for upload results                                                                                                                                                                                                                                                                                        |
| `USER_UPLOAD_RESULT_SUBSCRIPTION`        | `user-upload-result-subscription`                                                                    | Pub/Sub subscription                                                                                                                                                                                                                                                                                                    |
| `TOKEN_QUOTA_PERIOD_MAX_TOKENS`          | `1000000`                                                                                            | Optional. **Default** monthly total-token cap per user (UTC month) for proxy + checkpoint worker when Firestore does not override. Omit or `0` = unlimited. Same value in both deploy workflows. **Per-user cap:** set `monthlyTokenLimit` on `users/{userId}/preferences/user` in Firestore (overrides this variable). |
| `PROXY_CORS_ORIGINS`                     | _(omit)_                                                                                             | Optional. Comma-separated browser origins for proxy CORS. **Unset** = built-in list in `gcp/proxy/api/core/cors.py` (`https://asset-mem.com`, `https://homegeek.ai`, App Hosting URLs, `http://localhost:9002`). Set only to **replace** the entire list.                                                               |
| `PROXY_RATE_LIMIT_AGENT_PER_WINDOW`      | `30`                                                                                                 | Per-UID agent routes per 60s window (`PROXY_RATE_LIMIT_WINDOW_SECONDS`).                                                                                                                                                                                                                                                |
| `PROXY_RATE_LIMIT_CHECKPOINT_PER_WINDOW` | `20`                                                                                                 | Per-UID checkpoint routes per window.                                                                                                                                                                                                                                                                                   |
| `PROXY_OBSERVABILITY_TRACING`            | `false`                                                                                              | Set `true` when OTel GCP trace exporter packages are on the Cloud Run image.                                                                                                                                                                                                                                            |

### Production Environment Variables

Configure these in the **prod** environment:

| Variable Name                     | Value (Production)                                                                                   | Description                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GCP_REGION`                      | `us-central1`                                                                                        | GCP region for all services                                                                                                            |
| `WORKLOAD_IDENTITY_PROVIDER`      | `projects/321433914812/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Workload Identity Provider for GitHub Actions                                                                                          |
| `GCP_PROJECT_ID`                  | `homegeek-staging`                                                                                   | GCP Project ID                                                                                                                         |
| `GCP_PROJECT_NUMBER`              | `321433914812`                                                                                       | GCP Project Number (numeric ID)                                                                                                        |
| `GCP_SERVICE_ACCOUNT_EMAIL`       | `githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com`                                  | Service account for deployments                                                                                                        |
| `GCS_BUCKET`                      | `homegeek-user-data-prod`                                                                            | GCS bucket for user data                                                                                                               |
| `USER_UPLOAD_FOLDER`              | `uploads-prod`                                                                                       | Folder for user uploads                                                                                                                |
| `AGENT_STAGING_BUCKET`            | `gs://homegeek-agent-prod`                                                                           | Agent staging bucket                                                                                                                   |
| `REASONING_ENGINE_ID`             | `new`                                                                                                | Reasoning Engine ID (used to construct full path) - **UPDATE THIS**                                                                    |
| `USER_UPLOAD_RAG_CORPUS`          | `projects/homegeek-staging/locations/us-central1/ragCorpora/new`                                     | RAG Corpus for user uploads - **UPDATE THIS**                                                                                          |
| `KNOWLEDGE_BASE_RAG_CORPUS`       | `projects/homegeek-staging/locations/us-central1/ragCorpora/new`                                     | RAG Corpus for knowledge base - **UPDATE THIS**                                                                                        |
| `USER_UPLOAD_TOPIC`               | `user-upload-topic-prod`                                                                             | Pub/Sub topic for user uploads                                                                                                         |
| `USER_UPLOAD_RESULT_TOPIC`        | `user-upload-result-topic-prod`                                                                      | Pub/Sub topic for upload results                                                                                                       |
| `USER_UPLOAD_RESULT_SUBSCRIPTION` | `user-upload-result-subscription-prod`                                                               | Pub/Sub subscription                                                                                                                   |
| `TOKEN_QUOTA_PERIOD_MAX_TOKENS`   | `1000000`                                                                                            | Same as staging; set per environment if caps differ. Per-user override: Firestore `users/{userId}/preferences/user.monthlyTokenLimit`. |
| `PROXY_CORS_ORIGINS`              | _(omit)_                                                                                             | Same as staging; optional full override of CORS allowlist on Cloud Run proxy.                                                          |

## Webapp marketing variables (App Hosting, not GitHub)

These are **not** GitHub Actions variables. Set them in Firebase App Hosting config files:

| Variable                        | File                                                          |
| ------------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | `apps/webapp/apphosting.prod.yaml`, `apphosting.staging.yaml` |
| `NEXT_PUBLIC_SUPPORT_EMAIL`     | same                                                          |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | same (optional; required for Product Hunt analytics)          |

See [docs/deployment/PRODUCT_HUNT_LAUNCH.md §2.1](../docs/deployment/PRODUCT_HUNT_LAUNCH.md#21-environment-variables-production-web) and [LAUNCH_PLAN_PROGRESS.md](../docs/deployment/LAUNCH_PLAN_PROGRESS.md).

## Notes

- Variables marked with "**UPDATE THIS**" contain placeholder values (`new`) and must be updated with actual resource IDs
- Environment-specific variables use the **same names** in both staging and prod environments - GitHub automatically provides the correct values based on the workflow's environment context
- `GCP_REGION` and `WORKLOAD_IDENTITY_PROVIDER` are now environment-specific, allowing different values per environment if needed (though they typically remain the same)
- Repository-level variables (like `PYTHON_VERSION`) are shared across all environments
- All secrets should be rotated periodically following security best practices
- Service accounts require appropriate IAM permissions for deployments

### Constructed Variables

Some variables are automatically constructed from other variables in the workflows:

- **`AGENT_ENGINE_ID`**: Constructed as `projects/{GCP_PROJECT_NUMBER}/locations/{GCP_REGION}/reasoningEngines/{REASONING_ENGINE_ID}`
  - This eliminates the need to manually maintain the full path
  - The workflow automatically builds this from `GCP_PROJECT_NUMBER`, `GCP_REGION`, and `REASONING_ENGINE_ID`

## How Environment Variables Work in Workflows

When a workflow specifies `environment: staging` or `environment: prod`, GitHub Actions automatically:

1. Loads repository-level variables (accessible via `${{ vars.VARIABLE_NAME }}`)
2. Overrides with environment-specific variables if they exist
3. Makes secrets available via `${{ secrets.SECRET_NAME }}`

Example:

```yaml
environment: staging # or prod
steps:
  - run: echo ${{ vars.GCP_PROJECT_ID }} # Returns staging or prod value automatically
```

## Migration Checklist

- [ ] Create `staging` and `prod` environments in GitHub
- [ ] Add all secrets to GitHub repository (repository level)
- [ ] Add repository-level variables (PYTHON_VERSION)
- [ ] Add environment-specific variables to both staging and prod environments (including GCP_REGION, WORKLOAD_IDENTITY_PROVIDER, etc.)
- [ ] Update production placeholder values (marked with `new`)
- [ ] Update workflow files to reference variables without STAGING/PROD prefixes
- [ ] Test staging deployment
- [ ] Test production deployment
