# GCP Proxy API - Deployment Guide

This document provides comprehensive instructions for deploying the GCP Proxy API to Google Cloud Run.

## Prerequisites

### Required Tools

- **Google Cloud SDK (gcloud)** - Version 400.0.0 or later
- **Docker** (optional, for local container testing)
- **Git** - For source code management

### GCP Project Setup

1. **Google Cloud Project**
   - Active GCP project with billing enabled
   - Project ID (e.g., `homegeek-staging`)

2. **Required APIs**

   ```bash
   gcloud services enable \
     artifactregistry.googleapis.com \
     cloudbuild.googleapis.com \
     run.googleapis.com \
     aiplatform.googleapis.com \
     firestore.googleapis.com \
     pubsub.googleapis.com \
     storage.googleapis.com
   ```

3. **Service Account**
   - Create service account for Cloud Run
   - Grant required roles (see IAM Setup section)

---

## IAM Setup

### Create Service Account

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Create service account
gcloud iam service-accounts create homecare-proxy-sa \
  --display-name="HomeApp Proxy Service Account" \
  --description="Service account for HomeApp proxy API"
```

### Grant Required Roles

```bash
PROJECT_ID="YOUR_PROJECT_ID"
SA_EMAIL="homecare-proxy-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Vertex AI User (for Reasoning Engine and Gemini)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user"

# Firestore User (for database access)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user"

# Pub/Sub Publisher (for async tasks)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/pubsub.publisher"

# Storage Object Viewer (for reading documents/images)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectViewer"

# Logging Writer (for Cloud Logging)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/logging.logWriter"
```

### Verify Permissions

```bash
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --format='table(bindings.role,bindings.members)' \
  --filter="bindings.members:${SA_EMAIL}"
```

---

## Pub/Sub Setup

### Create Topics and Subscriptions

```bash
PROJECT_ID="YOUR_PROJECT_ID"

# Create topics
gcloud pubsub topics create checkpoint-analysis-topic
gcloud pubsub topics create user-upload-result-topic

# Create subscriptions
gcloud pubsub subscriptions create checkpoint-analysis-subscription \
  --topic=checkpoint-analysis-topic

gcloud pubsub subscriptions create user-upload-result-subscription \
  --topic=user-upload-result-topic
```

---

## Cloud Storage Setup

### Create Bucket

```bash
PROJECT_ID="YOUR_PROJECT_ID"
REGION="us-central1"

# Create bucket for user uploads
gcloud storage buckets create gs://homegeek-user-data \
  --project=$PROJECT_ID \
  --location=$REGION \
  --uniform-bucket-level-access

# Set lifecycle rules (optional)
gcloud storage buckets update gs://homegeek-user-data \
  --lifecycle-file=lifecycle.json
```

**lifecycle.json:**

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": { "age": 90 }
      }
    ]
  }
}
```

---

## Environment Variables

### Required Variables

Create a file `env.yaml` with your configuration:

```yaml
GCP_PROJECT_ID: "your-project-id"
GCP_LOCATION: "us-central1"
REASONING_ENGINE_ID: "your-reasoning-engine-id"
FIREBASE_WEBHOOK_SECRET: "your-firebase-secret"
TELEGRAM_WEBHOOK_SECRET: "your-telegram-secret"
TELEGRAM_BOT_TOKEN: "your-telegram-bot-token"
USER_UPLOAD_RESULT_SUBSCRIPTION: "user-upload-result-subscription"
```

### Generate Secrets

```bash
# Generate random webhook secrets
openssl rand -hex 32  # For FIREBASE_WEBHOOK_SECRET
openssl rand -hex 32  # For TELEGRAM_WEBHOOK_SECRET
```

---

## Deployment Methods

### Method 1: Deploy from Source (Recommended)

**Advantages:**

- Simplest method
- Cloud Build handles containerization
- Automatic dependency installation

**Steps:**

```bash
cd gcp/proxy/api

gcloud run deploy homecare-agent-proxy \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --service-account homecare-proxy-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --env-vars-file env.yaml \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0
```

### Method 2: Deploy from Container Image

**Advantages:**

- More control over build process
- Can test container locally
- Faster deployments (pre-built image)

**Steps:**

1. **Build Container:**

   ```bash
   cd gcp/proxy/api

   # Build and push to Artifact Registry
   gcloud builds submit \
     --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/cloud-run-source-deploy/homecare-proxy:latest
   ```

2. **Deploy:**
   ```bash
   gcloud run deploy homecare-agent-proxy \
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/cloud-run-source-deploy/homecare-proxy:latest \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --service-account homecare-proxy-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
     --env-vars-file env.yaml \
     --memory 1Gi \
     --cpu 1 \
     --timeout 300 \
     --max-instances 10 \
     --min-instances 0
   ```

### Method 3: Deploy with GitHub Actions (CI/CD)

**Advantages:**

- Automated deployments
- Consistent deployment process
- Integration with version control

**Setup:**

1. **Create GitHub Secrets:**
   - `GCP_PROJECT_ID`
   - `GCP_SA_KEY` (service account JSON key)
   - Environment variables

2. **GitHub Actions Workflow:**

`.github/workflows/deploy-proxy.yml`:

```yaml
name: Deploy Proxy API

on:
  push:
    branches:
      - main
    paths:
      - "gcp/proxy/api/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy homecare-agent-proxy \
            --source gcp/proxy/api \
            --region us-central1 \
            --platform managed \
            --allow-unauthenticated \
            --service-account homecare-proxy-sa@${{ secrets.GCP_PROJECT_ID }}.iam.gserviceaccount.com \
            --set-env-vars="GCP_PROJECT_ID=${{ secrets.GCP_PROJECT_ID }}" \
            --set-env-vars="FIREBASE_WEBHOOK_SECRET=${{ secrets.FIREBASE_WEBHOOK_SECRET }}"
```

---

## Deployment Configuration

### Resource Allocation

**Memory:**

- Minimum: 512MB
- Recommended: 1GB
- Maximum: 2GB (for large document processing)

**CPU:**

- Recommended: 1 vCPU
- For high load: 2 vCPUs

**Timeout:**

- Default: 300s (5 minutes)
- Adjust based on longest operation

### Scaling Configuration

**Auto-scaling:**

```bash
--min-instances 0        # Scale to zero when idle
--max-instances 10       # Maximum concurrent instances
--concurrency 80         # Requests per instance
```

**Cold Start Optimization:**

```bash
--min-instances 1        # Keep 1 instance warm
```

### Networking

**Allow Unauthenticated:**

```bash
--allow-unauthenticated  # Public access (protected by webhook secrets)
```

**VPC Connector (Optional):**

```bash
--vpc-connector your-vpc-connector
--vpc-egress all-traffic
```

---

## Post-Deployment Configuration

### Get Service URL

```bash
gcloud run services describe homecare-agent-proxy \
  --region us-central1 \
  --format 'value(status.url)'
```

Example output:

```
https://homecare-agent-proxy-321433914812.us-central1.run.app
```

### Configure Telegram Webhook

```bash
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_WEBHOOK_SECRET="your-webhook-secret"
SERVICE_URL="your-cloud-run-url"

curl -F "url=${SERVICE_URL}/${TELEGRAM_WEBHOOK_SECRET}" \
     -F "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
     "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"
```

### Update Client Applications

Update the API base URL in your client applications:

**mapp (React Native):**

```typescript
// apps/mapp/lib/config.ts
export const API_BASE_URL =
  "https://homecare-agent-proxy-xxx.us-central1.run.app";
export const FIREBASE_WEBHOOK_SECRET = "your-secret";
```

**webapp (Next.js):**

```typescript
// apps/webapp/src/lib/config.ts
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
```

---

## Verification

### Health Check

```bash
SERVICE_URL="your-cloud-run-url"
curl ${SERVICE_URL}/health
```

Expected response:

```json
{ "status": "ok" }
```

### Test Agent Endpoint

```bash
SECRET="your-firebase-webhook-secret"
curl -X POST "${SERVICE_URL}/${SECRET}/firebase-agent-query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Hello",
    "user_id": "test_user"
  }'
```

### Test Document Analysis

```bash
curl -X POST "${SERVICE_URL}/${SECRET}/extract-doc-info" \
  -H "Content-Type: application/json" \
  -d '{
    "docUrl": "https://storage.googleapis.com/test/sample.pdf",
    "contentType": "application/pdf"
  }'
```

### View Logs

```bash
gcloud run services logs read homecare-agent-proxy \
  --region us-central1 \
  --limit 50
```

---

## Monitoring

### Cloud Console

1. Navigate to Cloud Run in GCP Console
2. Select `homecare-agent-proxy` service
3. View metrics:
   - Request count
   - Request latency
   - Error rate
   - Instance count

### Cloud Logging

**View logs:**

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=homecare-agent-proxy" \
  --limit 50 \
  --format json
```

**Create log-based metric:**

```bash
gcloud logging metrics create proxy_errors \
  --description="Count of proxy API errors" \
  --log-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="homecare-agent-proxy"
    AND severity>=ERROR'
```

### Alerting

**Create alert policy:**

```bash
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Proxy API High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

---

## Rollback

### Rollback to Previous Revision

```bash
# List revisions
gcloud run revisions list \
  --service homecare-agent-proxy \
  --region us-central1

# Rollback to specific revision
gcloud run services update-traffic homecare-agent-proxy \
  --region us-central1 \
  --to-revisions REVISION_NAME=100
```

---

## Troubleshooting

### Common Issues

**1. Service Account Permissions**

```
Error: Permission denied
Solution: Verify service account has required roles
```

**2. Environment Variables**

```
Error: FIREBASE_WEBHOOK_SECRET not set
Solution: Check env.yaml or --set-env-vars
```

**3. Cold Start Timeout**

```
Error: Request timeout
Solution: Increase --timeout or set --min-instances 1
```

**4. Memory Exceeded**

```
Error: Memory limit exceeded
Solution: Increase --memory to 1Gi or 2Gi
```

### Debug Mode

Enable verbose logging:

```bash
# Add to env.yaml
LOG_LEVEL: "DEBUG"

# Redeploy
gcloud run deploy homecare-agent-proxy --env-vars-file env.yaml
```

---

## Security Best Practices

### Secrets Management

**Use Secret Manager (Recommended):**

```bash
# Create secret
echo -n "your-secret-value" | gcloud secrets create firebase-webhook-secret --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding firebase-webhook-secret \
  --member="serviceAccount:homecare-proxy-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Deploy with secret
gcloud run deploy homecare-agent-proxy \
  --update-secrets=FIREBASE_WEBHOOK_SECRET=firebase-webhook-secret:latest
```

### Network Security

**HTTPS Only:**

- Cloud Run enforces HTTPS by default
- No HTTP access allowed

**CORS Configuration:**

- Restrict origins in production
- Update `main.py` CORS settings

### Regular Updates

```bash
# Update dependencies
cd gcp/proxy/api
pip install --upgrade -r requirements.txt
pip freeze > requirements.txt

# Redeploy
gcloud run deploy homecare-agent-proxy --source .
```

---

## Cost Optimization

### Pricing Factors

- **Requests:** $0.40 per million requests
- **Compute:** $0.00002400 per vCPU-second
- **Memory:** $0.00000250 per GiB-second
- **Free tier:** 2 million requests/month

### Optimization Tips

1. **Scale to zero:** Use `--min-instances 0`
2. **Right-size resources:** Start with 512MB, scale if needed
3. **Optimize cold starts:** Use lighter dependencies
4. **Use async processing:** Offload to workers for long tasks

---

## Stripe B2C billing (local development)

**Full setup (Dashboard, staging/prod env, checklists):** [docs/billing/B2C_STRIPE_CONFIGURATION.md](../billing/B2C_STRIPE_CONFIGURATION.md).

Use this section to exercise **Checkout**, **Customer Portal**, and **webhooks** against a locally running proxy. Firestore writes use **Application Default Credentials** (e.g. `gcloud auth application-default login`) or `GOOGLE_APPLICATION_CREDENTIALS`.

### Environment variables

Set these in the shell or put a **`.env` file in `gcp/proxy/api`** (same directory you run `uvicorn` from; [`core/config.py`](../../gcp/proxy/api/core/config.py) calls `load_dotenv()`).

| Variable | Required for billing | Description |
| -------- | -------------------- | ----------- |
| `STRIPE_SECRET_KEY` | Yes | Stripe **secret** key (`sk_test_…` or `sk_live_…`). |
| `STRIPE_WEBHOOK_SIGNING_SECRET` | Yes | Webhook **signing secret** (`whsec_…`) from the Stripe Dashboard or from `stripe listen` (see below). |
| `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` | Yes | JSON map: reserved **`free`** key + Stripe **Price ids**. Extended: `{"free":{"monthlyTokenLimit":1000000,"monthlyDocumentLimit":2,"monthlyCheckpointLimit":5,"monthlyReportGenerationsLimit":2},"price_abc":{...}}`. Legacy integer values = token cap only. `0` = unlimited for that field. Unknown Price ids are rejected at Checkout. |
| `BILLING_PUBLIC_APP_BASE_URL` | Yes | Public web origin **without** trailing slash used for Checkout success/cancel and Portal `return_url` (e.g. `http://localhost:9002` for the Next.js webapp). |
| `GCP_PROJECT_ID` | Yes (Firestore) | Same as other proxy features using Firestore. |

GitHub Actions / Cloud Run: see [`deploy-homecare-agent-proxy.yaml`](../../.github/workflows/deploy-homecare-agent-proxy.yaml) for `STRIPE_*` and `BILLING_PUBLIC_APP_BASE_URL` wiring.

### Run the proxy

From the repo (see also [Development Guide](./DEVELOPMENT.md)):

```bash
cd gcp/proxy/api
uvicorn main:app --host=0.0.0.0 --port=8080 --reload
```

Do not commit real Stripe keys; keep `.env` out of git (see `.gitignore`).

### Forward Stripe webhooks to localhost

In a **second** terminal (with [Stripe CLI](https://stripe.com/docs/stripe-cli) installed and logged in):

```bash
stripe listen --forward-to localhost:8080/stripe/webhook
```

The CLI prints a **Signing secret** (`whsec_…`). Set `STRIPE_WEBHOOK_SIGNING_SECRET` to that value (restart `uvicorn` if you change env).

The proxy exposes **`POST /stripe/webhook`** on the **host root** (no `FIREBASE_WEBHOOK_SECRET` path prefix), because Stripe Dashboard must target a fixed URL.

### B2C API routes (Firebase Bearer token)

These are also mounted under `/{FIREBASE_WEBHOOK_SECRET}/…` when the secret is set, so the same `NEXT_PUBLIC_API_BASE_URL` pattern as other proxy calls works.

| Method | Path | Auth |
| ------ | ---- | ---- |
| `POST` | `/billing/b2c/checkout-session` | `Authorization: Bearer <Firebase ID token>`; JSON body `{ "tier": "plus" }` or `{ "tier": "pro" }`. |
| `POST` | `/billing/b2c/portal-session` | Same header; JSON body `{ "returnPath": "/home/settings" }` (path only). |

Successful Checkout returns `{ "url": "https://checkout.stripe.com/..." }` — redirect the browser there. After payment, webhooks update Firestore `users/{uid}/billing/summary` (server writes only; clients may **read** per [`apps/webapp/firestore.rules`](../../apps/webapp/firestore.rules)).

### Optional: trigger test events

```bash
stripe trigger checkout.session.completed
```

Test fixtures may not include your `metadata.firebaseUid`; use the **webapp Settings → Plan & billing** flow or the Stripe Dashboard to create sessions that match your app’s Checkout metadata for full end-to-end verification.

---

## Related Documentation

- [API Overview](./API_OVERVIEW.md)
- [Architecture](./ARCHITECTURE.md)
- [Configuration](./CONFIGURATION.md)
- [Development Guide](./DEVELOPMENT.md)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
