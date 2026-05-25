# Proxy API Deployment

This guide covers deploying the FastAPI proxy service to Google Cloud Run.

## Overview

The Proxy API is a FastAPI application that serves as the orchestration layer between clients and backend services:
- Routes requests to AI Agent Engine
- Manages Firebase webhooks
- Handles Telegram bot integration
- Processes async jobs via Pub/Sub
- Manages checkpoint analysis
- Provides REST API endpoints

**Deployment Platform**: Google Cloud Run  
**Technology**: Python 3.13, FastAPI, Uvicorn  
**Location**: `gcp/proxy/api/`

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Cloud Run Service                      │
│                  (Proxy API - FastAPI)                    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │              API Endpoints                       │    │
│  │  - /chat (Firebase webhook)                     │    │
│  │  - /telegram (Telegram webhook)                 │    │
│  │  - /checkpoint/analyze                          │    │
│  │  - /checkpoint/metrics                          │    │
│  │  - /health                                      │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│           ┌──────────────┼──────────────┐               │
│           ▼              ▼              ▼               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  Vertex AI   │ │   Pub/Sub    │ │  Firebase    │   │
│  │  Agent       │ │   Topics     │ │  Firestore   │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
└──────────────────────────────────────────────────────────┘
```

## Environments

### Staging
- **Service Name**: `homecare-agent-proxy-staging`
- **URL**: `https://homecare-agent-proxy-staging-321433914812.us-central1.run.app`
- **Purpose**: Testing and validation
- **Min Instances**: 0 (scale to zero)
- **Max Instances**: 5

### Production
- **Service Name**: `homecare-agent-proxy-prod`
- **URL**: `https://homecare-agent-proxy-prod-686746113874.us-central1.run.app`
- **Purpose**: Live production workloads
- **Min Instances**: 1 (always warm)
- **Max Instances**: 10

## Prerequisites

### Required Tools
```bash
# Install Python 3.13
# Download from https://www.python.org/

# Install Google Cloud SDK
# Download from https://cloud.google.com/sdk/docs/install

# Verify installations
python --version  # Should be 3.13+
gcloud --version
```

### GCP Setup

#### Enable Required APIs
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

#### Service Account Configuration
```bash
# Grant Cloud Run permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.developer"

# Grant Artifact Registry permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Grant AI Platform permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Grant Pub/Sub permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.editor"
```

### Authentication
```bash
# Authenticate with GCP
gcloud auth login
gcloud config set project PROJECT_ID
```

## Configuration

### Environment Variables

The proxy requires these environment variables:

```bash
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
REASONING_ENGINE_ID=your-reasoning-engine-id

# Telegram Integration
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret

# Firebase Integration
FIREBASE_WEBHOOK_SECRET=your-firebase-webhook-secret

# Pub/Sub
USER_UPLOAD_TOPIC=user-upload-topic
USER_UPLOAD_RESULT_SUBSCRIPTION=user-upload-result-subscription
CHECKPOINT_ANALYSIS_TOPIC=checkpoint-analysis-topic
CHECKPOINT_METRICS_TOPIC=checkpoint-metrics-topic

# Storage
GCS_BUCKET=homegeek-user-data
```

### Secrets Management

Store sensitive values in Google Secret Manager:

```bash
# Create secrets
echo -n "your-telegram-bot-token" | \
  gcloud secrets create telegram-bot-token --data-file=-

echo -n "your-telegram-webhook-secret" | \
  gcloud secrets create telegram-webhook-secret --data-file=-

echo -n "your-firebase-webhook-secret" | \
  gcloud secrets create firebase-webhook-secret --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding telegram-bot-token \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Dockerfile

Location: `gcp/proxy/api/Dockerfile`

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

**Workflow File**: `.github/workflows/deploy-homecare-agent-proxy.yaml`

#### Trigger Deployment

**Automatic (on code changes)**:
- Push changes to `main` branch in `gcp/proxy/api/` directory
- Workflow automatically deploys to staging

**Manual Deployment**:
1. Go to GitHub → Actions
2. Select "Deploy Homecare Agent Proxy" workflow
3. Click "Run workflow"
4. Select environment: `staging` or `prod`
5. Click "Run workflow"

**Workflow Features**:
- Validates all required environment variables and secrets
- Authenticates with GCP using Workload Identity
- Deploys to Cloud Run from source
- Sets environment variables
- Configures auto-scaling
- Grants public access (if allowed by org policy)

**Required GitHub Variables**:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `REASONING_ENGINE_ID`
- `USER_UPLOAD_TOPIC`
- `USER_UPLOAD_RESULT_SUBSCRIPTION`
- `GCS_BUCKET`
- `CHECKPOINT_ANALYSIS_TOPIC`
- `CHECKPOINT_METRICS_TOPIC`

**Required GitHub Secrets**:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `FIREBASE_WEBHOOK_SECRET`

### Method 2: Deploy from Source (Local)

**Recommended for quick deployments**:

```bash
cd gcp/proxy/api

# Deploy to staging
gcloud run deploy homecare-agent-proxy-staging \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --service-account githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="GCP_PROJECT_ID=PROJECT_ID" \
  --set-env-vars="GCP_REGION=us-central1" \
  --set-env-vars="REASONING_ENGINE_ID=your-reasoning-engine-id" \
  --set-env-vars="TELEGRAM_BOT_TOKEN=your-bot-token" \
  --set-env-vars="TELEGRAM_WEBHOOK_SECRET=your-webhook-secret" \
  --set-env-vars="FIREBASE_WEBHOOK_SECRET=your-firebase-webhook-secret" \
  --set-env-vars="USER_UPLOAD_TOPIC=user-upload-topic" \
  --set-env-vars="USER_UPLOAD_RESULT_SUBSCRIPTION=user-upload-result-subscription" \
  --set-env-vars="GCS_BUCKET=homegeek-user-data" \
  --set-env-vars="CHECKPOINT_ANALYSIS_TOPIC=checkpoint-analysis-topic" \
  --set-env-vars="CHECKPOINT_METRICS_TOPIC=checkpoint-metrics-topic" \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0
```

**Advantages**:
- Simplest method
- Cloud Build handles containerization
- Automatic dependency installation

### Method 3: Deploy from Container Image

**For more control over build process**:

```bash
cd gcp/proxy/api

# 1. Build container image
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/homecare-proxy:latest

# 2. Deploy from image
gcloud run deploy homecare-agent-proxy-staging \
  --image us-central1-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/homecare-proxy:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --service-account githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="GCP_PROJECT_ID=PROJECT_ID,GCP_REGION=us-central1,..." \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0
```

**Advantages**:
- More control over build process
- Can test container locally
- Faster deployments (pre-built image)

### Method 4: Using env.yaml File

Create `env.yaml`:

```yaml
GCP_PROJECT_ID: "your-project-id"
GCP_REGION: "us-central1"
REASONING_ENGINE_ID: "your-reasoning-engine-id"
TELEGRAM_BOT_TOKEN: "your-bot-token"
TELEGRAM_WEBHOOK_SECRET: "your-webhook-secret"
FIREBASE_WEBHOOK_SECRET: "your-firebase-webhook-secret"
USER_UPLOAD_TOPIC: "user-upload-topic"
USER_UPLOAD_RESULT_SUBSCRIPTION: "user-upload-result-subscription"
GCS_BUCKET: "homegeek-user-data"
CHECKPOINT_ANALYSIS_TOPIC: "checkpoint-analysis-topic"
CHECKPOINT_METRICS_TOPIC: "checkpoint-metrics-topic"
```

Deploy:
```bash
cd gcp/proxy/api

gcloud run deploy homecare-agent-proxy-staging \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --service-account githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com \
  --env-vars-file env.yaml \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0
```

## Webhook Configuration

### Telegram Webhook

After deploying, set the Telegram webhook:

```bash
# Get Cloud Run service URL
SERVICE_URL=$(gcloud run services describe homecare-agent-proxy-staging \
  --region us-central1 \
  --format 'value(status.url)')

# Construct webhook URL
WEBHOOK_URL="${SERVICE_URL}/${TELEGRAM_WEBHOOK_SECRET}"

# Set webhook
curl -F "url=${WEBHOOK_URL}" \
     -F "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
     "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"

# Verify webhook
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

### Firebase Webhook

Configure in your web/mobile app:

```typescript
const WEBHOOK_URL = `${PROXY_BASE_URL}/${FIREBASE_WEBHOOK_SECRET}`;

// Use this URL for Firebase function calls or direct API calls
```

## Monitoring and Logging

### View Service Details

```bash
# Get service information
gcloud run services describe homecare-agent-proxy-staging \
  --region us-central1

# Get service URL
gcloud run services describe homecare-agent-proxy-staging \
  --region us-central1 \
  --format 'value(status.url)'
```

### View Logs

```bash
# Stream logs
gcloud run services logs tail homecare-agent-proxy-staging \
  --region us-central1

# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=homecare-agent-proxy-staging" \
  --limit 50 \
  --format json

# Filter by severity
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=homecare-agent-proxy-staging AND severity>=ERROR" \
  --limit 50
```

### Monitor Metrics

**Cloud Console**:
1. Navigate to Cloud Run → Services
2. Select `homecare-agent-proxy-staging`
3. View metrics:
   - Request count
   - Request latency
   - Container CPU utilization
   - Container memory utilization
   - Billable container instance time

**CLI**:
```bash
# Get metrics
gcloud monitoring time-series list \
  --filter='resource.type="cloud_run_revision" AND resource.labels.service_name="homecare-agent-proxy-staging"' \
  --format=json
```

### Health Check

```bash
# Check health endpoint
curl https://homecare-agent-proxy-staging-321433914812.us-central1.run.app/health

# Expected response
{"status": "healthy", "version": "1.0.0"}
```

## Scaling Configuration

### Auto-Scaling Settings

```bash
# Update scaling settings
gcloud run services update homecare-agent-proxy-staging \
  --region us-central1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80
```

**Scaling Parameters**:
- `min-instances`: Minimum number of instances (0 = scale to zero)
- `max-instances`: Maximum number of instances
- `concurrency`: Maximum concurrent requests per instance

### Cold Start Optimization

For production, keep instances warm:

```bash
gcloud run services update homecare-agent-proxy-prod \
  --region us-central1 \
  --min-instances 1  # Keep one instance always running
```

### Resource Allocation

```bash
# Update memory and CPU
gcloud run services update homecare-agent-proxy-staging \
  --region us-central1 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300
```

**Resource Guidelines**:
- **Memory**: 512MB-2GB (1GB recommended)
- **CPU**: 1-2 vCPUs (1 recommended)
- **Timeout**: 300s (5 minutes)

## Traffic Management

### Gradual Rollout

```bash
# Deploy new revision without traffic
gcloud run deploy homecare-agent-proxy-staging \
  --source . \
  --region us-central1 \
  --no-traffic

# Get revision name
REVISION=$(gcloud run revisions list \
  --service homecare-agent-proxy-staging \
  --region us-central1 \
  --format 'value(name)' \
  --limit 1)

# Route 10% traffic to new revision
gcloud run services update-traffic homecare-agent-proxy-staging \
  --region us-central1 \
  --to-revisions ${REVISION}=10

# Route 100% traffic after validation
gcloud run services update-traffic homecare-agent-proxy-staging \
  --region us-central1 \
  --to-latest
```

### Rollback

```bash
# List revisions
gcloud run revisions list \
  --service homecare-agent-proxy-staging \
  --region us-central1

# Route traffic to previous revision
gcloud run services update-traffic homecare-agent-proxy-staging \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION=100
```

## Troubleshooting

### Deployment Failures

#### Permission Errors
```bash
# Verify service account has required roles
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:githubworkflowdeployment@*"

# Grant missing permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.developer"
```

#### Build Failures
```bash
# Check Cloud Build logs
gcloud builds list --limit 5

# View specific build
gcloud builds log BUILD_ID

# Common issues:
# - Missing dependencies in requirements.txt
# - Syntax errors in Python code
# - Dockerfile errors
```

#### Container Startup Failures
```bash
# Check logs for startup errors
gcloud run services logs tail homecare-agent-proxy-staging \
  --region us-central1

# Common issues:
# - Missing environment variables
# - Port binding issues (must use port 8080)
# - Import errors
```

### Runtime Errors

#### 503 Service Unavailable
- Check if service is deployed
- Verify min instances > 0 or wait for cold start
- Check container health

#### 500 Internal Server Error
```bash
# Check application logs
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit 50

# Common issues:
# - Uncaught exceptions
# - Missing environment variables
# - External service failures
```

#### Timeout Errors
```bash
# Increase timeout
gcloud run services update homecare-agent-proxy-staging \
  --region us-central1 \
  --timeout 600  # 10 minutes

# Or optimize code to reduce execution time
```

### Webhook Issues

#### Telegram Webhook Not Working
```bash
# Check webhook status
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"

# Reset webhook
curl -F "url=" "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"
curl -F "url=${WEBHOOK_URL}" \
     -F "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
     "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"
```

#### Firebase Webhook Failing
- Verify webhook secret matches
- Check request payload format
- Review application logs

## Best Practices

### 1. Security
- Use webhook secrets for all webhooks
- Never commit secrets to repository
- Use Secret Manager for sensitive values
- Implement rate limiting
- Enable Cloud Armor for DDoS protection (production)

### 2. Performance
- Set appropriate concurrency limits
- Use connection pooling
- Implement caching where appropriate
- Optimize database queries
- Use async operations

### 3. Reliability
- Keep min instances > 0 for production
- Implement health checks
- Set appropriate timeouts
- Handle errors gracefully
- Implement retry logic

### 4. Monitoring
- Set up Cloud Monitoring alerts
- Monitor error rates
- Track latency metrics
- Review logs regularly
- Set up uptime checks

### 5. Cost Optimization
- Use scale-to-zero for non-critical services
- Right-size memory and CPU
- Implement request caching
- Optimize cold start time
- Monitor billable instance time

## CI/CD Integration

### GitHub Actions Workflow

**Triggers**:
- Push to `main` in `gcp/proxy/api/` → Auto-deploy staging
- Manual workflow_dispatch → Deploy to prod

**Workflow Steps**:
1. Checkout code
2. Validate environment variables and secrets
3. Authenticate with GCP
4. Deploy to Cloud Run
5. Set IAM policy for public access
6. Output service URL

## Local Development

### Running Locally

```bash
cd gcp/proxy/api

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1
# ... other variables

# Run with uvicorn
uvicorn main:app --reload --port 8080

# Or with Docker
docker build -t proxy-api .
docker run -p 8080:8080 --env-file .env proxy-api
```

### Testing Endpoints

```bash
# Health check
curl http://localhost:8080/health

# Test chat endpoint (requires auth)
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "userId": "test-user"}'
```

## Future: Google Cloud API Gateway

**Status:** Planned post-GA ([LAUNCH_PLAN_PROGRESS.md § Phase 4](./LAUNCH_PLAN_PROGRESS.md#phase-4--future-infrastructure-post-ga)). **Not** part of current deploy workflows.

Today clients call **Cloud Run directly**:

```text
https://homecare-agent-proxy-{env}-….run.app/firebase-agent-stream
```

With **Google Cloud API Gateway** (managed product, distinct from this FastAPI service):

```text
https://<gateway-host-or-api.asset-mem.com>/firebase-agent-stream
        → API Gateway → same Cloud Run backend
```

| Topic | Impact |
|-------|--------|
| **Client URLs** | Change when you cut over — update `NEXT_PUBLIC_API_BASE_URL` (web) and mapp `PROXY_BASE_URL` |
| **Paths** | Can stay the same on the OpenAPI spec / gateway config |
| **Phase 2 auth** | Firebase Bearer on proxy remains unless you add gateway-level auth |
| **CORS** | Add the gateway public origin to `PROXY_CORS_ORIGINS` / `core/cors.py` defaults |
| **Cloud Run URL** | Keeps working until you restrict ingress to gateway-only |

See also [PRODUCTION_LAUNCH_CHECKLIST.md §11](./PRODUCTION_LAUNCH_CHECKLIST.md#11-future-infrastructure-post-ga--deferred).

---

## Related Documentation

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Agent Deployment](./AGENT_DEPLOYMENT.md)
- [Worker Functions Deployment](./WORKERS_DEPLOYMENT.md)
- [CI/CD Pipeline Documentation](./CICD.md)

