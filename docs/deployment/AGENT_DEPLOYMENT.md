# AI Agent Engine Deployment

This guide covers deploying the Vertex AI Reasoning Engine (AI Agent) for property management intelligence.

## Overview

The AI Agent is a sophisticated reasoning engine built on Google's Vertex AI platform that provides:
- Property management assistance
- Document analysis and RAG (Retrieval-Augmented Generation)
- Service recommendations (SerpAPI, YouTube)
- Location-based services
- Checkpoint analysis
- Multi-modal interactions

**Deployment Platform**: Google Vertex AI Agent Engine  
**Technology**: Python 3.9+, Vertex AI SDK, LangChain  
**Location**: `gcp/agents/homecare/`

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Vertex AI Reasoning Engine                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Property Agent (Main Orchestrator)       │  │
│  │                                                   │  │
│  │  - Query routing                                 │  │
│  │  - Context management                            │  │
│  │  - Response generation                           │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│           ┌──────────────┼──────────────┐              │
│           ▼              ▼              ▼              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│  │   RAG       │ │  External   │ │  Location   │     │
│  │   Search    │ │  APIs       │ │  Services   │     │
│  │             │ │             │ │             │     │
│  │ - Knowledge │ │ - SerpAPI   │ │ - Geocoding │     │
│  │ - User Docs │ │ - YouTube   │ │ - Maps      │     │
│  └─────────────┘ └─────────────┘ └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Environments

### Staging
- **Reasoning Engine ID**: Stored in `REASONING_ENGINE_ID` variable
- **RAG Corpus**: Staging corpus
- **GCS Bucket**: `homegeek-user-data` (staging prefix)
- **Purpose**: Testing and validation

### Production
- **Reasoning Engine ID**: Separate production engine
- **RAG Corpus**: Production corpus
- **GCS Bucket**: `homegeek-user-data` (prod prefix)
- **Purpose**: Live production workloads

## Prerequisites

### Required Tools
```bash
# Install Python 3.9+
# Download from https://www.python.org/

# Install UV (fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via pip
pip install uv

# Verify installations
python --version  # Should be 3.9+
uv --version
```

### GCP Setup

#### Enable Required APIs
```bash
gcloud services enable \
  aiplatform.googleapis.com \
  storage-api.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com
```

#### Service Account Configuration
```bash
# Create service account (if not exists)
gcloud iam service-accounts create githubworkflowdeployment \
  --display-name="GitHub Workflow Deployment"

# Grant required roles
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.editor"
```

#### Grant RAG Corpus Permissions
```bash
# Grant AI Platform Reasoning Engine Service Agent permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-aiplatform-re.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### Authentication
```bash
# Authenticate with GCP
gcloud auth login
gcloud config set project PROJECT_ID

# For application default credentials
gcloud auth application-default login
```

## Configuration

### Environment Variables

Create `.env` file in `gcp/agents/homecare/`:

```bash
# GCP Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=1

# RAG Corpus
USER_UPLOAD_RAG_CORPUS=projects/PROJECT_NUMBER/locations/us-central1/ragCorpora/USER_CORPUS_ID

# Storage
GOOGLE_CLOUD_BUCKET=homegeek-user-data
USER_UPLOAD_FOLDER=uploads

# Pub/Sub
USER_UPLOAD_TOPIC=user-upload-topic

# External APIs
SERP_API_KEY=your-serp-api-key

# Agent Configuration
STAGING_BUCKET=your-staging-bucket
AGENT_ENGINE_ID=projects/PROJECT_NUMBER/locations/us-central1/reasoningEngines/ENGINE_ID
```

### Dependencies

**pyproject.toml** (managed by UV):
```toml
[project]
name = "homecare-agent"
version = "0.1.0"
requires-python = ">=3.9"

dependencies = [
    "google-cloud-aiplatform",
    "langchain",
    "langchain-google-vertexai",
    "google-cloud-storage",
    "google-cloud-pubsub",
    "pydantic",
    "python-dotenv",
]
```

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

**Workflow File**: `.github/workflows/deploy-homecare-agent.yaml`

#### Trigger Deployment

**Automatic (on code changes)**:
- Push changes to `main` branch in `gcp/agents/homecare/` directory
- Workflow automatically deploys to staging

**Manual Deployment**:
1. Go to GitHub → Actions
2. Select "Deploy Homecare Agent Engine" workflow
3. Click "Run workflow"
4. Select:
   - Environment: `staging` or `prod`
   - Action: `create` or `update`
5. Click "Run workflow"

**Workflow Features**:
- Validates all required environment variables
- Sets up Python and UV
- Installs dependencies
- Deploys or updates Reasoning Engine
- Outputs Reasoning Engine ID

**Required GitHub Variables**:
- `GCP_PROJECT_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_REGION`
- `PYTHON_VERSION`
- `AGENT_STAGING_BUCKET`
- `REASONING_ENGINE_ID`
- `GCS_BUCKET`
- `USER_UPLOAD_FOLDER`
- `USER_UPLOAD_RAG_CORPUS`
- `USER_UPLOAD_TOPIC`
- `WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`

**Required GitHub Secrets**:
- `SERP_API_KEY`

### Method 2: Local Deployment Script

**Prerequisites**:
```bash
cd gcp/agents/homecare

# Install dependencies
uv sync

# Activate virtual environment
source .venv/bin/activate

# Or use uv run for commands
```

#### Deploy New Agent (Create)
```bash
cd gcp/agents/homecare

# Deploy to staging
uv run python deployment/deploy.py create staging

# Deploy to production
uv run python deployment/deploy.py create prod
```

#### Update Existing Agent
```bash
cd gcp/agents/homecare

# Update staging
uv run python deployment/deploy.py update staging

# Update production
uv run python deployment/deploy.py update prod
```

**Script Features**:
- Validates environment variables
- Packages agent code
- Uploads to staging bucket
- Creates or updates Reasoning Engine
- Outputs Reasoning Engine ID
- **CI deploy:** `AGENT_MIN_INSTANCES`, `AGENT_MAX_INSTANCES`, `AGENT_RESOURCE_CPU`, `AGENT_RESOURCE_MEMORY`, and `AGENT_CONTAINER_CONCURRENCY` are set from [hardware-expectations.yaml](../../docs/deployment/hardware-expectations.yaml) via `resolve-hardware-env.sh` (default tier **idle**). See [PRODUCTION_HARDWARE_ALLOCATIONS.md](../../docs/deployment/PRODUCTION_HARDWARE_ALLOCATIONS.md#how-deploy-workflows-pick-a-tier).
- **Local deploy:** scaling kwargs apply only when those `AGENT_*` vars are set in the shell or `gcp/agents/homecare/.env`; otherwise Vertex platform defaults apply.

#### Grant Permissions (First-Time Setup)
```bash
cd gcp/agents/homecare

# Make script executable
chmod +x deployment/grant_permissions.sh

# Run permissions script
./deployment/grant_permissions.sh
```

This script:
- Creates custom IAM role for RAG access
- Grants permissions to AI Platform service agent
- Configures necessary bindings

### Method 3: Manual gcloud Commands

#### Package and Upload Agent
```bash
cd gcp/agents/homecare

# Create staging bucket (if not exists)
gsutil mb -p PROJECT_ID -l us-central1 gs://your-staging-bucket

# Package agent code
tar -czf agent.tar.gz property_agent/ deployment/

# Upload to staging bucket
gsutil cp agent.tar.gz gs://your-staging-bucket/
```

#### Create Reasoning Engine
```bash
# Using gcloud (if available)
gcloud ai reasoning-engines create \
  --display-name="homecare-agent-staging" \
  --region=us-central1 \
  --staging-bucket=gs://your-staging-bucket \
  --requirements-file=requirements.txt \
  --entry-point=property_agent.agent:PropertyAgent
```

#### Update Reasoning Engine
```bash
gcloud ai reasoning-engines update REASONING_ENGINE_ID \
  --region=us-central1 \
  --staging-bucket=gs://your-staging-bucket
```

## RAG Corpus Setup

### Create RAG Corpus

```bash
# Create user upload corpus
gcloud ai rag-corpora create \
  --display-name="homecare-user-uploads" \
  --region=us-central1
```

### Import Documents

```bash
# Import documents to corpus
gcloud ai rag-corpora import-files CORPUS_ID \
  --region=us-central1 \
  --source=gs://your-bucket/documents/
```

### Manage RAG Files

**Python Script** (recommended):
```python
from google.cloud import aiplatform

aiplatform.init(project=PROJECT_ID, location="us-central1")

# Import files
corpus = aiplatform.RagCorpus(CORPUS_ID)
corpus.import_files(
    source_uris=["gs://bucket/file1.pdf", "gs://bucket/file2.pdf"],
    chunk_size=512,
    chunk_overlap=100
)

# List files
files = corpus.list_files()
for file in files:
    print(f"File: {file.display_name}, ID: {file.name}")

# Delete file
corpus.delete_file(file_id=FILE_ID)
```

## Testing Deployed Agent

### Test Script

**Location**: `gcp/agents/homecare/deployment/run.py`

```bash
cd gcp/agents/homecare

# Test deployed agent
uv run python deployment/run.py
```

**Script Features**:
- Connects to deployed Reasoning Engine
- Sends test queries
- Displays responses
- Validates functionality

### Manual Testing

```python
from google.cloud import aiplatform
from vertexai.preview import reasoning_engines

# Initialize
aiplatform.init(project=PROJECT_ID, location="us-central1")

# Get agent
agent = reasoning_engines.ReasoningEngine(REASONING_ENGINE_ID)

# Query agent
response = agent.query(
    user_id="test-user",
    property_id="test-property",
    session_id="test-session",
    query="What are the maintenance tasks for this month?"
)

print(response)
```

### Test Queries

```python
# Property management query
response = agent.query(
    query="What maintenance should I do this month?",
    user_id="user123",
    property_id="prop456"
)

# Service recommendation
response = agent.query(
    query="Find plumbers near me",
    user_id="user123",
    property_id="prop456"
)

# Document analysis
response = agent.query(
    query="Summarize my property documents",
    user_id="user123",
    property_id="prop456"
)
```

## Monitoring and Logging

### View Logs

```bash
# View Reasoning Engine logs
gcloud logging read "resource.type=aiplatform.googleapis.com/ReasoningEngine AND resource.labels.reasoning_engine_id=REASONING_ENGINE_ID" \
  --limit=50 \
  --format=json

# Or in Cloud Console
# https://console.cloud.google.com/logs
```

### Monitor Performance

**Cloud Console**:
1. Navigate to Vertex AI → Reasoning Engines
2. Select your engine
3. View metrics:
   - Request count
   - Latency
   - Error rate
   - Token usage

**Custom Monitoring**:
```python
from google.cloud import monitoring_v3

client = monitoring_v3.MetricServiceClient()
project_name = f"projects/{PROJECT_ID}"

# Query metrics
interval = monitoring_v3.TimeInterval(
    end_time={"seconds": int(time.time())},
    start_time={"seconds": int(time.time() - 3600)},
)

results = client.list_time_series(
    request={
        "name": project_name,
        "filter": 'resource.type = "aiplatform.googleapis.com/ReasoningEngine"',
        "interval": interval,
    }
)
```

### Error Tracking

Enable Cloud Error Reporting:
```bash
gcloud services enable clouderrorreporting.googleapis.com
```

View errors in Cloud Console:
- Navigate to Error Reporting
- Filter by Reasoning Engine resource

## Troubleshooting

### Deployment Failures

#### Permission Errors
```bash
# Verify service account has required roles
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com"

# Grant missing roles
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

#### Staging Bucket Errors
```bash
# Verify bucket exists
gsutil ls gs://your-staging-bucket

# Create if missing
gsutil mb -p PROJECT_ID -l us-central1 gs://your-staging-bucket

# Grant access
gsutil iam ch serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com:objectAdmin gs://your-staging-bucket
```

#### Dependency Errors
```bash
# Clear cache and reinstall
cd gcp/agents/homecare
rm -rf .venv
uv sync --frozen
```

### Runtime Errors

#### RAG Corpus Access Denied
```bash
# Grant AI Platform service agent access
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-aiplatform-re.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Or run grant permissions script
cd gcp/agents/homecare
./deployment/grant_permissions.sh
```

#### External API Errors
```bash
# Verify API keys are set
echo $SERP_API_KEY

# Update secrets in Secret Manager
gcloud secrets versions add serp-api-key --data-file=-
# Paste key and press Ctrl+D
```

#### Timeout Errors
- Increase timeout in agent configuration
- Optimize RAG queries
- Reduce chunk size
- Implement caching

### Query Issues

#### Poor Response Quality
1. **Improve RAG corpus**:
   - Add more relevant documents
   - Improve document quality
   - Adjust chunk size and overlap

2. **Tune prompts**:
   - Refine system prompts
   - Add examples
   - Improve context formatting

3. **Adjust model parameters**:
   - Temperature
   - Top-k, top-p
   - Max tokens

#### Slow Response Times
1. **Optimize RAG retrieval**:
   - Reduce number of retrieved chunks
   - Use semantic caching
   - Pre-filter documents

2. **Reduce external API calls**:
   - Cache API responses
   - Batch requests
   - Use async calls

3. **Use faster models**:
   - Switch to Gemini Flash for speed
   - Use smaller context windows

## Best Practices

### 1. Version Control
- Tag agent versions in Git
- Document changes in CHANGELOG
- Test before deploying to production
- Keep staging and prod in sync

### 2. RAG Management
- Remove outdated user-upload documents
- Monitor RAG performance
- Optimize chunk parameters

### 3. Monitoring
- Set up alerts for errors
- Monitor latency and costs
- Track token usage
- Review logs regularly

### 4. Security
- Rotate API keys regularly
- Use Secret Manager for secrets
- Implement rate limiting
- Audit access logs

### 5. Cost Optimization
- Use appropriate model sizes
- Implement caching
- Optimize prompt length
- Monitor token usage

## Rollback Procedures

### Rollback to Previous Version

```bash
# 1. List previous deployments (if tracked)
# Note the previous REASONING_ENGINE_ID

# 2. Update environment to use previous engine
# In GitHub variables or .env file
REASONING_ENGINE_ID=PREVIOUS_ENGINE_ID

# 3. Update proxy service to use previous engine
# Redeploy proxy with updated REASONING_ENGINE_ID

# 4. Verify rollback
uv run python deployment/run.py
```

### Emergency Rollback

If agent is completely broken:

```bash
# Deploy last known good version
cd gcp/agents/homecare
git checkout LAST_GOOD_COMMIT
uv run python deployment/deploy.py update prod

# Or create new engine from scratch
uv run python deployment/deploy.py create prod
```

## CI/CD Integration

### GitHub Actions Workflow

**Triggers**:
- Push to `main` in `gcp/agents/homecare/` → Auto-deploy staging
- Manual workflow_dispatch → Deploy to prod

**Workflow Steps**:
1. Checkout code
2. Validate environment variables
3. Set up Python and UV
4. Install dependencies
5. Authenticate with GCP
6. Run deployment script
7. Output Reasoning Engine ID

### Local Development Workflow

1. **Make changes** in `gcp/agents/homecare/`
2. **Test locally** with development RAG corpus
3. **Deploy to staging** via GitHub Actions or script
4. **Test in staging** environment
5. **Deploy to production** after validation

## Related Documentation

- [Vertex AI Reasoning Engine Docs](https://cloud.google.com/vertex-ai/docs/reasoning-engine)
- [RAG in Vertex AI](https://cloud.google.com/vertex-ai/docs/generative-ai/rag-overview)
- [LangChain Documentation](https://python.langchain.com/)
- [Proxy API Deployment](./PROXY_DEPLOYMENT.md)
- [CI/CD Pipeline Documentation](./CICD.md)

