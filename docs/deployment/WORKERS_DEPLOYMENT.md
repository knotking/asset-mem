# Worker Functions Deployment

This guide covers deploying Cloud Functions for asynchronous processing tasks.

## Overview

Worker functions handle background processing tasks triggered by Pub/Sub events:
- **User Document Upload**: Processes uploaded documents and adds to RAG corpus
- **Checkpoint Analysis**: Analyzes property checkpoints using AI
- **Checkpoint Metrics**: Processes and stores checkpoint metrics
- **Report Generation**: Builds snapshot property reports and renders PDFs

**Deployment Platform**: Google Cloud Functions (2nd Gen)  
**Technology**: Python 3.13, Pub/Sub triggers  
**Location**: `gcp/proxy/workers/function/`

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Pub/Sub Topics                        │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ user-upload-topic│  │checkpoint-analysis│            │
│  └────────┬─────────┘  └────────┬─────────┘            │
│           │                     │                        │
│           ▼                     ▼                        │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ User Doc Upload  │  │  Checkpoint      │            │
│  │    Function      │  │  Analysis Func   │            │
│  │                  │  │                  │            │
│  │ - Parse docs     │  │ - AI analysis    │            │
│  │ - Add to RAG     │  │ - Store results  │            │
│  │ - Publish result │  │ - Publish metrics│            │
│  └──────────────────┘  └──────────────────┘            │
│           │                     │                        │
│           ▼                     ▼                        │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │user-upload-result│  │checkpoint-metrics │            │
│  │      topic       │  │      topic        │            │
│  └──────────────────┘  └──────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

## Worker Functions

### 1. User Document Upload Function

**Purpose**: Process user-uploaded documents and add to RAG corpus

**Trigger**: `user-upload-topic` Pub/Sub topic  
**Location**: `gcp/proxy/workers/function/user_docs/`  
**Entry Point**: `pubsub_to_user_docs`

**Workflow**:
1. Receive Pub/Sub message with document metadata
2. Download document from Cloud Storage
3. Process and chunk document
4. Add to user-specific RAG corpus
5. Publish result to `user-upload-result-topic`

### 2. Checkpoint Analysis Function

**Purpose**: Analyze property checkpoints using AI

**Trigger**: `checkpoint-analysis-topic` Pub/Sub topic  
**Location**: `gcp/proxy/workers/function/checkpoint_analysis/`  
**Entry Point**: `pubsub_checkpoint_analysis`

**Workflow**:
1. Receive checkpoint data via Pub/Sub
2. Call Vertex AI for analysis
3. Process and structure results
4. Store in Firestore
5. Publish metrics to `checkpoint-metrics-topic`

### 3. Checkpoint Metrics Function

**Purpose**: Process and aggregate checkpoint metrics

**Trigger**: `checkpoint-metrics-topic` Pub/Sub topic  
**Location**: `gcp/proxy/workers/function/checkpoint_metrics/`  
**Entry Point**: `pubsub_checkpoint_metrics`

**Workflow**:
1. Receive metrics data via Pub/Sub
2. Aggregate and calculate statistics
3. Store in Firestore
4. Update property metrics

### 4. Report Generation Function

**Purpose**: Generate snapshot property reports (HTML → PDF) asynchronously

**Trigger**: `report-generation-topic` Pub/Sub topic (env-suffixed, e.g. `report-generation-topic-staging`)  
**Location**: `gcp/proxy/workers/function/report_generation/`  
**Entry Point**: `pubsub_to_report_generation`

**Workflow**:
1. Receive report job via Pub/Sub (from proxy `POST /reports/generate`)
2. Load checkpoints and analysis for the snapshot date range
3. Render HTML template and convert to PDF (xhtml2pdf in Phase 1)
4. Upload PDF to GCS and update Firestore `properties/{id}/reports/{reportId}` to `ready`

**GitHub variable**: `REPORT_GENERATION_TOPIC` — must match on both the worker deploy and the proxy (`deploy-homecare-agent-proxy.yaml`).

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
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  pubsub.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  storage-api.googleapis.com
```

#### Create Pub/Sub Topics and Subscriptions

```bash
# User upload topics
gcloud pubsub topics create user-upload-topic
gcloud pubsub topics create user-upload-result-topic
gcloud pubsub subscriptions create user-upload-topic-subscription \
  --topic=user-upload-topic
gcloud pubsub subscriptions create user-upload-result-subscription \
  --topic=user-upload-result-topic

# Checkpoint topics
gcloud pubsub topics create checkpoint-analysis-topic
gcloud pubsub topics create checkpoint-metrics-topic
gcloud pubsub subscriptions create checkpoint-analysis-subscription \
  --topic=checkpoint-analysis-topic
gcloud pubsub subscriptions create checkpoint-metrics-subscription \
  --topic=checkpoint-metrics-topic

# Report generation topic
gcloud pubsub topics create report-generation-topic-staging
```

Set `REPORT_GENERATION_TOPIC=report-generation-topic-staging` on the GitHub environment before deploying the proxy and worker.

#### Service Account Configuration
```bash
# Grant Cloud Functions permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.developer"

# Grant Pub/Sub permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.editor"

# Grant AI Platform permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

## Configuration

### Environment Variables

Each function requires specific environment variables:

#### User Document Upload Function
```bash
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
RAG_CORPUS=projects/PROJECT_NUMBER/locations/us-central1/ragCorpora/CORPUS_ID
USER_UPLOAD_RESULT_TOPIC=user-upload-result-topic
GCS_BUCKET=homegeek-user-data
```

#### Checkpoint Analysis Function
```bash
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
CHECKPOINT_METRICS_TOPIC=checkpoint-metrics-topic
```

#### Checkpoint Metrics Function
```bash
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
```

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

#### User Document Upload Function

**Workflow File**: `.github/workflows/deploy-pubsub-user-docs.yaml`

**Trigger**:
- Push to `main` in `gcp/proxy/workers/function/user_docs/`
- Manual workflow_dispatch

**Deploy**:
1. Go to GitHub → Actions
2. Select "Deploy User Docs Function" workflow
3. Click "Run workflow"
4. Select environment: `staging` or `prod`
5. Click "Run workflow"

#### Checkpoint Analysis Function

**Workflow File**: `.github/workflows/deploy-checkpoint-analysis.yaml`

**Trigger**:
- Push to `main` in `gcp/proxy/workers/function/checkpoint_analysis/`
- Manual workflow_dispatch

**Deploy**:
1. Go to GitHub → Actions
2. Select "Deploy Checkpoint Analysis Function" workflow
3. Click "Run workflow"
4. Select environment: `staging` or `prod`
5. Click "Run workflow"

#### Checkpoint Metrics Function

**Workflow File**: `.github/workflows/deploy-checkpoint-metrics.yaml`

**Trigger**:
- Push to `main` in `gcp/proxy/workers/function/checkpoint_metrics/`
- Manual workflow_dispatch

**Deploy**:
1. Go to GitHub → Actions
2. Select "Deploy Checkpoint Metrics Function" workflow
3. Click "Run workflow"
4. Select environment: `staging` or `prod`
5. Click "Run workflow"

#### Report Generation Function

**Workflow File**: `.github/workflows/deploy-report-generation.yaml`

**Trigger**:
- Push to `main` in `gcp/proxy/workers/function/report_generation/`
- Manual workflow_dispatch

**Deploy**:
1. Ensure `REPORT_GENERATION_TOPIC` is set on the target GitHub environment (see `.github/workflows/README-report-generation.md`)
2. Go to GitHub → Actions → "Deploy Report Generation Function"
3. Run workflow for `staging` or `prod`
4. Redeploy the proxy so it publishes to the same topic

**Workflow Features** (all Pub/Sub worker deploy workflows):
- Validates environment variables
- Syncs shared modules (`gcp/common` where needed)
- Deploys Cloud Function via `deploy-cloud-functions@v3`
- Configures Pub/Sub trigger
- Sets resource limits
- Post-deploy: `run.googleapis.com/invoker-iam-disabled=true` on the underlying Cloud Run service so Eventarc deliveries are not rejected with HTTP 403 (see `.github/workflows/README-report-generation.md` troubleshooting)

### Method 2: Manual gcloud Commands

#### User Document Upload Function

```bash
cd gcp/proxy/workers/function/user_docs

gcloud functions deploy pubsub-to-user-docs-staging \
  --gen2 \
  --runtime python313 \
  --region us-central1 \
  --entry-point pubsub_to_user_docs \
  --trigger-topic user-upload-topic \
  --service-account githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com \
  --memory 512Mi \
  --max-instances 10 \
  --set-env-vars="GCP_PROJECT_ID=PROJECT_ID" \
  --set-env-vars="GCP_REGION=us-central1" \
  --set-env-vars="RAG_CORPUS=projects/PROJECT_NUMBER/locations/us-central1/ragCorpora/CORPUS_ID" \
  --set-env-vars="USER_UPLOAD_RESULT_TOPIC=user-upload-result-topic" \
  --set-env-vars="GCS_BUCKET=homegeek-user-data"
```

#### Checkpoint Analysis Function

```bash
cd gcp/proxy/workers/function/checkpoint_analysis

# Sync shared modules first
rsync -a --delete ../../../common/observability/ ./common/observability/

gcloud functions deploy pubsub-checkpoint-analysis-staging \
  --gen2 \
  --runtime python313 \
  --region us-central1 \
  --entry-point pubsub_checkpoint_analysis \
  --trigger-topic checkpoint-analysis-topic \
  --service-account githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com \
  --memory 512Mi \
  --max-instances 10 \
  --max-instance-request-concurrency 1 \
  --set-env-vars="GCP_PROJECT_ID=PROJECT_ID" \
  --set-env-vars="GCP_LOCATION=us-central1" \
  --set-env-vars="CHECKPOINT_METRICS_TOPIC=checkpoint-metrics-topic"
```

#### Checkpoint Metrics Function

```bash
cd gcp/proxy/workers/function/checkpoint_metrics

gcloud functions deploy pubsub-checkpoint-metrics-staging \
  --gen2 \
  --runtime python313 \
  --region us-central1 \
  --entry-point pubsub_checkpoint_metrics \
  --trigger-topic checkpoint-metrics-topic \
  --service-account githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com \
  --memory 256Mi \
  --max-instances 10 \
  --set-env-vars="GCP_PROJECT_ID=PROJECT_ID" \
  --set-env-vars="GCP_LOCATION=us-central1"
```

### Method 3: Using YAML Configuration

Create `function.yaml`:

```yaml
name: pubsub-to-user-docs-staging
runtime: python313
entryPoint: pubsub_to_user_docs
eventTrigger:
  eventType: google.cloud.pubsub.topic.v1.messagePublished
  pubsubTopic: projects/PROJECT_ID/topics/user-upload-topic
serviceConfig:
  serviceAccount: githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com
  memory: 512Mi
  maxInstanceCount: 10
  environmentVariables:
    GCP_PROJECT_ID: PROJECT_ID
    GCP_REGION: us-central1
    RAG_CORPUS: projects/PROJECT_NUMBER/locations/us-central1/ragCorpora/CORPUS_ID
    USER_UPLOAD_RESULT_TOPIC: user-upload-result-topic
    GCS_BUCKET: homegeek-user-data
```

Deploy:
```bash
gcloud functions deploy --config function.yaml
```

## Shared Modules

Worker functions use shared modules from `gcp/common/`:

### Observability Module

**Location**: `gcp/common/observability/`

**Features**:
- Structured logging
- Error tracking
- Performance monitoring
- Trace context propagation

**Sync Process**:
GitHub Actions workflows automatically sync shared modules to function directories before deployment:

```bash
# Sync observability module
rsync -a --delete gcp/common/observability/ \
  gcp/proxy/workers/function/checkpoint_analysis/common/observability/
```

**Usage in Functions**:
```python
from common.observability import get_logger, log_error

logger = get_logger(__name__)

def pubsub_checkpoint_analysis(cloud_event):
    logger.info("Processing checkpoint analysis")
    try:
        # Process event
        pass
    except Exception as e:
        log_error(logger, e, {"event_id": cloud_event.id})
```

## Monitoring and Logging

### View Function Details

```bash
# List functions
gcloud functions list --region us-central1

# Describe specific function
gcloud functions describe pubsub-to-user-docs-staging \
  --region us-central1 \
  --gen2
```

### View Logs

```bash
# Stream logs
gcloud functions logs read pubsub-to-user-docs-staging \
  --region us-central1 \
  --gen2 \
  --limit 50

# Filter by severity
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=pubsub-to-user-docs-staging AND severity>=ERROR" \
  --limit 50

# View in Cloud Console
# https://console.cloud.google.com/logs
```

### Monitor Metrics

**Cloud Console**:
1. Navigate to Cloud Functions
2. Select function
3. View metrics:
   - Invocations
   - Execution time
   - Memory usage
   - Error rate

**CLI**:
```bash
gcloud monitoring time-series list \
  --filter='resource.type="cloud_function" AND resource.labels.function_name="pubsub-to-user-docs-staging"' \
  --format=json
```

### Test Functions

#### Publish Test Message

```bash
# User upload test
gcloud pubsub topics publish user-upload-topic \
  --message='{"userId":"test-user","propertyId":"test-property","documentId":"test-doc","gcsPath":"gs://bucket/file.pdf"}'

# Checkpoint analysis test
gcloud pubsub topics publish checkpoint-analysis-topic \
  --message='{"checkpointId":"test-checkpoint","propertyId":"test-property","data":{}}'

# Checkpoint metrics test
gcloud pubsub topics publish checkpoint-metrics-topic \
  --message='{"checkpointId":"test-checkpoint","metrics":{}}'
```

#### View Function Invocations

```bash
# Check function was triggered
gcloud functions logs read pubsub-to-user-docs-staging \
  --region us-central1 \
  --gen2 \
  --limit 10
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
  --role="roles/cloudfunctions.developer"
```

#### Build Failures
```bash
# Check Cloud Build logs
gcloud builds list --limit 5

# View specific build
gcloud builds log BUILD_ID

# Common issues:
# - Missing dependencies in requirements.txt
# - Import errors
# - Syntax errors
```

#### Trigger Configuration Errors
```bash
# Verify topic exists
gcloud pubsub topics describe user-upload-topic

# Create if missing
gcloud pubsub topics create user-upload-topic

# Verify function trigger
gcloud functions describe pubsub-to-user-docs-staging \
  --region us-central1 \
  --gen2 \
  --format="value(eventTrigger.pubsubTopic)"
```

### Runtime Errors

#### Function Not Triggered
```bash
# Check if topic has messages
gcloud pubsub topics list-subscriptions user-upload-topic

# Check subscription backlog
gcloud pubsub subscriptions describe user-upload-topic-subscription

# Verify function is active
gcloud functions describe pubsub-to-user-docs-staging \
  --region us-central1 \
  --gen2 \
  --format="value(state)"
```

#### Function Timeouts
```bash
# Increase timeout (max 540s for 2nd gen)
gcloud functions deploy pubsub-to-user-docs-staging \
  --region us-central1 \
  --gen2 \
  --timeout 540s

# Or optimize function code
```

#### Memory Errors
```bash
# Increase memory
gcloud functions deploy pubsub-to-user-docs-staging \
  --region us-central1 \
  --gen2 \
  --memory 1Gi  # Options: 128Mi, 256Mi, 512Mi, 1Gi, 2Gi, 4Gi, 8Gi
```

#### Import Errors
```bash
# Ensure shared modules are synced
cd gcp/proxy/workers/function/checkpoint_analysis
rsync -a --delete ../../../common/observability/ ./common/observability/

# Verify __init__.py exists
ls -la common/__init__.py
ls -la common/observability/__init__.py

# Redeploy
gcloud functions deploy pubsub-checkpoint-analysis-staging \
  --region us-central1 \
  --gen2
```

### Message Processing Issues

#### Messages Not Processing
1. Check function logs for errors
2. Verify Pub/Sub topic has messages
3. Check subscription configuration
4. Verify function is deployed and active

#### Duplicate Processing
- Cloud Functions at-least-once delivery guarantee
- Implement idempotency in function code
- Use message deduplication logic

#### Dead Letter Queue

Use the repo script (wired into `create-environment.yaml` and re-run after worker deploy):

```bash
./.github/scripts/apply-pubsub-dlq.sh PROJECT_ID ENV
```

Creates `worker-dlq-{ENV}` and applies dead-letter policy to manual subscriptions and all subscriptions on worker topics. See [OPERATIONS.md](./OPERATIONS.md).

## Scaling Configuration

### Concurrency Settings

```bash
# Set max concurrent instances
gcloud functions deploy pubsub-to-user-docs-staging \
  --region us-central1 \
  --gen2 \
  --max-instances 10

# Set min instances (keep warm)
gcloud functions deploy pubsub-to-user-docs-staging \
  --region us-central1 \
  --gen2 \
  --min-instances 1

# Set concurrent requests per instance
gcloud functions deploy pubsub-checkpoint-analysis-staging \
  --region us-central1 \
  --gen2 \
  --max-instance-request-concurrency 1  # Process one message at a time
```

### Resource Allocation

**Memory Guidelines**:
- **User Doc Upload**: 512Mi-1Gi (document processing)
- **Checkpoint Analysis**: 512Mi (AI calls)
- **Checkpoint Metrics**: 256Mi (simple processing)

**Timeout Guidelines**:
- **User Doc Upload**: 300s (document processing can be slow)
- **Checkpoint Analysis**: 300s (AI calls can be slow)
- **Checkpoint Metrics**: 60s (quick processing)

## Best Practices

### 1. Idempotency
- Implement idempotent message processing
- Use message IDs for deduplication
- Handle duplicate messages gracefully

### 2. Error Handling
- Catch and log all exceptions
- Return appropriate status codes
- Use dead letter queues for failed messages
- Implement retry logic with exponential backoff

### 3. Performance
- Minimize cold start time
- Use connection pooling
- Implement caching where appropriate
- Optimize dependencies

### 4. Monitoring
- Log all important events
- Track processing time
- Monitor error rates
- Set up alerts for failures

### 5. Security
- Use service accounts with minimal permissions
- Validate message payloads
- Sanitize inputs
- Use Secret Manager for sensitive values

## CI/CD Integration

### GitHub Actions Workflows

**Triggers**:
- Push to `main` in function directory → Auto-deploy staging
- Manual workflow_dispatch → Deploy to prod

**Workflow Steps**:
1. Checkout code
2. Validate environment variables
3. Sync shared modules
4. Authenticate with GCP
5. Deploy Cloud Function
6. Output function details

**Required GitHub Variables**:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- Function-specific variables

## Local Development

### Running Locally

```bash
cd gcp/proxy/workers/function/checkpoint_analysis

# Install dependencies
pip install -r requirements.txt

# Install Functions Framework
pip install functions-framework

# Run function locally
functions-framework --target=pubsub_checkpoint_analysis --debug

# In another terminal, send test event
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "data": "base64-encoded-data",
      "attributes": {}
    }
  }'
```

### Testing with Pub/Sub Emulator

```bash
# Install emulator
gcloud components install pubsub-emulator

# Start emulator
gcloud beta emulators pubsub start --project=test-project

# Set environment variable
export PUBSUB_EMULATOR_HOST=localhost:8085

# Publish test message
gcloud pubsub topics publish test-topic --message="test"
```

## Related Documentation

- [Cloud Functions Documentation](https://cloud.google.com/functions/docs)
- [Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Proxy API Deployment](./PROXY_DEPLOYMENT.md)
- [Agent Deployment](./AGENT_DEPLOYMENT.md)
- [CI/CD Pipeline Documentation](./CICD.md)

