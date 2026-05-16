# GitHub Actions Workflows

This directory contains GitHub Actions workflows for managing GCP infrastructure and deploying applications.

## Overview

All infrastructure and application management is done through GitHub Actions using **gcloud commands only**. No Terraform required.

## Workflows

### Infrastructure Management

#### [create-environment.yaml](create-environment.yaml)
Creates a new environment with all required GCP infrastructure.

**Triggers:**
- **Manual (workflow_dispatch)**: Creates full infrastructure when manually triggered from Actions tab
- **Push to `gcp_project` branch**: Validates workflow syntax only (does NOT create infrastructure)

**What it creates:**
- GCP Project (optional)
- IAM Service Accounts
- Workload Identity Federation
- Storage Buckets (with versioning, lifecycle, CORS)
- Pub/Sub Topics and Subscriptions
- RAG Corpora (2 separate: user-upload and knowledge-base)
- GitHub Environment with all variables

**Usage:**
```bash
# Navigate to Actions → Create New Environment
# Fill in:
#   - environment_name: qa-team-1
#   - gcp_project_id: your-project-id
#   - create_project: true/false
#   - region: us-central1
#   - folder_id: (optional, if organizing by folders)

# Note: BILLING_ACCOUNT_ID and ORGANIZATION_ID come from GitHub secrets
# Note: GitHub repository is automatically detected
```

**Outputs:**
- All GitHub environment variables set automatically
- Configuration file in workflow artifacts
- Environment ready for application deployment

#### [destroy-environment.yaml](destroy-environment.yaml)
Destroys an environment and optionally deletes the GCP project.

**Triggers:**
- **Manual (workflow_dispatch)**: Destroys infrastructure when manually triggered from Actions tab
- **Push to `gcp_project` branch**: Validates workflow syntax only (does NOT destroy resources)

**What it deletes:**
- Cloud Run services
- Cloud Functions
- Pub/Sub topics and subscriptions
- Storage buckets
- RAG corpora
- IAM service accounts
- Workload Identity Pool
- GCP Project (optional)

**Usage:**
```bash
# Navigate to Actions → Destroy Environment
# Fill in:
#   - environment_name: qa-team-1
#   - gcp_project_id: your-project-id
#   - confirm_destroy: DESTROY
#   - destroy_project: true/false
```

### Application Deployment

#### [deploy-homecare-agent-proxy.yaml](deploy-homecare-agent-proxy.yaml)
Deploys the homecare agent proxy to Cloud Run.

See [README-homecare-agent-proxy.md](README-homecare-agent-proxy.md) for details.

#### [test-homecare-agent.yaml](test-homecare-agent.yaml)
Runs fast unit tests for the homecare ADK agent on pull requests (no Vertex / eval cost).

See [README-homecare-agent-test.md](README-homecare-agent-test.md) for details.

#### [deploy-homecare-agent.yaml](deploy-homecare-agent.yaml)
Deploys the homecare reasoning engine.

See [README-homecare-agent.md](README-homecare-agent.md) for details.

#### [deploy-pubsub-user-docs.yaml](deploy-pubsub-user-docs.yaml)
Deploys the PubSub to User Docs Cloud Function.

See [README-pubsub-user-docs.md](README-pubsub-user-docs.md) for details.

#### [deploy-checkpoint-analysis.yaml](deploy-checkpoint-analysis.yaml)
Deploys the Checkpoint Analysis Cloud Function.

See [README-checkpoint-analysis.md](README-checkpoint-analysis.md) for details.

#### [deploy-checkpoint-metrics.yaml](deploy-checkpoint-metrics.yaml)
Deploys the Checkpoint Metrics Cloud Function (aggregates checkpoint analysis into property-level metrics for mobile).

#### [deploy-webapp-apphosting.yaml](deploy-webapp-apphosting.yaml)
Deploys the web application to Firebase App Hosting.

See [README-deploy-webapp-apphosting.md](README-deploy-webapp-apphosting.md) for details.

## Architecture

### Project-per-Environment

Each environment = separate GCP project. This provides:
- Complete isolation between environments
- Independent billing and quotas
- Easy cleanup (delete entire project)
- No naming conflicts

### Infrastructure with gcloud

All infrastructure is created using `gcloud` commands in GitHub Actions:

```bash
# Service Account
gcloud iam service-accounts create githubworkflowdeployment ...

# Workload Identity
gcloud iam workload-identity-pools create github-pool ...

# Storage
gsutil mb -p $PROJECT_ID gs://bucket-name/

# Pub/Sub
gcloud pubsub topics create topic-name ...

# Note: Secrets are managed via GitHub Secrets, not GCP Secret Manager

# RAG Corpora
curl -X POST https://.../ragCorpora ...
```

### Why gcloud instead of Terraform?

**Simpler for this use case:**
- Long-lived environments with infrequent infrastructure changes
- Consistent tooling (gcloud for everything)
- No Terraform state to manage
- Easier to understand and modify
- Direct integration with GitHub Actions

## Workflow Flow

### Creating a New Environment

```
1. Run: create-environment.yaml
   ↓
2. Creates GCP Project (optional)
   ↓
3. Enables APIs
   ↓
4. Creates IAM resources (SA, WIF)
   ↓
5. Creates Storage buckets
   ↓
6. Creates Pub/Sub resources
   ↓
7. Creates Secret Manager secrets
   ↓
8. Creates RAG corpora
   ↓
9. Sets GitHub environment variables
   ↓
10. Ready for application deployment!
```

### Deploying Applications

```
1. Environment already created ✓
   ↓
2. Run: deploy-homecare-agent-proxy.yaml
   ↓
3. Authenticates via Workload Identity
   ↓
4. Builds Docker image
   ↓
5. Pushes to Artifact Registry
   ↓
6. Deploys to Cloud Run
   ↓
7. Application live! 🎉
```

### Destroying an Environment

```
1. Run: destroy-environment.yaml
   ↓
2. Confirms destruction (type "DESTROY")
   ↓
3. Deletes Cloud Run services
   ↓
4. Deletes Cloud Functions
   ↓
5. Deletes Pub/Sub resources
   ↓
6. Deletes Storage buckets
   ↓
7. Deletes Secrets
   ↓
8. Deletes RAG corpora
   ↓
9. Deletes IAM resources
   ↓
10. Optionally deletes GCP project
    ↓
11. Environment destroyed ✓
```

## GitHub Environment Variables

After running `create-environment.yaml`, these variables are automatically set:

| Variable | Description |
|----------|-------------|
| `GCP_PROJECT_ID` | GCP project ID |
| `GCP_REGION` | GCP region (e.g., us-central1) |
| `WORKLOAD_IDENTITY_PROVIDER` | WIF provider for authentication |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Service account for deployments |
| `GCS_BUCKET` | User data storage bucket |
| `USER_UPLOAD_TOPIC` | Pub/Sub topic for uploads |
| `USER_UPLOAD_RESULT_TOPIC` | Pub/Sub topic for results |
| `USER_UPLOAD_RAG_CORPUS` | RAG corpus for user uploads |
| `KNOWLEDGE_BASE_RAG_CORPUS` | RAG corpus for knowledge base |
| `REASONING_ENGINE_ID` | Set to "new" initially |

## Prerequisites

### Admin/Management Project Setup

To use the project creation feature (`create_project: true`), you need an **admin project** (also called a management or bootstrap project).

**What is an admin project?**
- It's just a regular GCP project that you designate to manage other projects
- It contains the Workload Identity Federation setup for GitHub Actions
- It contains a service account with permissions to create and manage other projects

**Example structure:**
```
homegeek-admin          ← Admin project (you create this once)
  ├── Workload Identity Pool
  └── Service Account (with org-level permissions)

homegeek-staging        ← Created by workflow
homegeek-prod           ← Created by workflow
homegeek-qa-team-1      ← Created by workflow
```

**One-time setup in your admin project:**
1. Create a GCP project (e.g., `homegeek-admin`)
2. Enable required APIs in the admin project:
   ```bash
   # CRITICAL: Enable these APIs in your admin project first
   gcloud services enable \
     cloudresourcemanager.googleapis.com \
     iam.googleapis.com \
     iamcredentials.googleapis.com \
     cloudbilling.googleapis.com \
     serviceusage.googleapis.com \
     --project=your-admin-project-id
   ```
3. Set up Workload Identity Federation (see [README-workflow-identity-provider.md](README-workflow-identity-provider.md))
4. Create a service account with necessary permissions (see below)
5. Grant permissions for Workload Identity Federation to generate tokens:
   ```bash
   # IMPORTANT: Replace 'YOUR_PROJECT_NUMBER' with your admin project number
   # Find it with: gcloud projects describe your-admin-project-id --format='value(projectNumber)'

   # Allow GitHub Actions to generate access tokens for the service account
   gcloud iam service-accounts add-iam-policy-binding \
     your-admin-sa@your-admin-project.iam.gserviceaccount.com \
     --member="principalSet://iam.googleapis.com/projects/YOUR_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_ORG/YOUR_REPO" \
     --role="roles/iam.serviceAccountTokenCreator" \
     --project=your-admin-project-id

   # Also allow the service account to impersonate itself (for certain operations)
   gcloud iam service-accounts add-iam-policy-binding \
     your-admin-sa@your-admin-project.iam.gserviceaccount.com \
     --member="serviceAccount:your-admin-sa@your-admin-project.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountTokenCreator" \
     --project=your-admin-project-id
   ```
6. Add these as GitHub repository secrets:
   - `ORG_WIF_PROVIDER`: Workload Identity Provider path from admin project
   - `ORG_ADMIN_SERVICE_ACCOUNT`: Service account email from admin project
   - `BILLING_ACCOUNT_ID`: Your GCP billing account ID (format: `XXXXXX-XXXXXX-XXXXXX`)
   - `ORGANIZATION_ID`: Your GCP organization ID (required for proper project governance)

**Alternative without admin project:**
If you don't want to use project creation:
- Manually create GCP projects first
- Set `create_project: false` in the workflow
- The workflow will only set up infrastructure in existing projects

### Permissions Required

The `ORG_ADMIN_SERVICE_ACCOUNT` needs these roles. Grant them using the commands below:

**If you have a GCP Organization:**
```bash
# Set your values
ORGANIZATION_ID="your-org-id"
SERVICE_ACCOUNT_EMAIL="your-admin-sa@your-admin-project.iam.gserviceaccount.com"

# Grant roles at organization level
gcloud organizations add-iam-policy-binding $ORGANIZATION_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/resourcemanager.projectCreator"

gcloud organizations add-iam-policy-binding $ORGANIZATION_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/billing.user"
```

**For each new project created (the workflow needs these to set up resources):**
```bash
# Set your values
PROJECT_ID="your-new-project-id"
SERVICE_ACCOUNT_EMAIL="your-admin-sa@your-admin-project.iam.gserviceaccount.com"

# Grant roles at project level
for role in \
  "roles/iam.serviceAccountAdmin" \
  "roles/iam.workloadIdentityPoolAdmin" \
  "roles/storage.admin" \
  "roles/pubsub.admin" \
  "roles/aiplatform.admin"; do

  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="$role"
done
```

**Note:** The workflow automatically grants these project-level roles when creating infrastructure, but the service account needs organization-level permissions first to create projects.

## Best Practices

### Environment Naming

Use descriptive names that indicate purpose:
- `qa-team-1` - QA environment for team 1
- `demo-customer-x` - Demo for specific customer
- `staging` - Staging environment
- `prod` - Production environment

### Secret Management

All secrets are managed via GitHub Secrets. Configure secrets at the repository or environment level:
- Repository secrets: Available to all workflows
- Environment secrets: Scoped to specific environments (recommended)

Common secrets needed:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `FIREBASE_WEBHOOK_SECRET`
- `SERP_API_KEY`

### Idempotency

All workflows are idempotent. Running them multiple times:
- Won't fail if resources exist
- Won't overwrite existing GitHub variables
- Safe to re-run

### Cleanup

Always destroy environments when done:
1. Run `destroy-environment.yaml`
2. Type "DESTROY" to confirm
3. Choose whether to delete the project

## Troubleshooting

### Authentication Error: `iam.serviceAccounts.getAccessToken` denied

**Symptom:** Workflow fails with error:
```
Permission 'iam.serviceAccounts.getAccessToken' denied on resource
```

**Cause:** The service account or Workload Identity Federation principal lacks permission to generate access tokens.

**Solution:**
```bash
# Get your admin project number
PROJECT_NUMBER=$(gcloud projects describe your-admin-project-id --format='value(projectNumber)')

# Grant token creator permission to the Workload Identity principal
gcloud iam service-accounts add-iam-policy-binding \
  your-admin-sa@your-admin-project.iam.gserviceaccount.com \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_ORG/YOUR_REPO" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=your-admin-project-id

# Also grant self-impersonation permission
gcloud iam service-accounts add-iam-policy-binding \
  your-admin-sa@your-admin-project.iam.gserviceaccount.com \
  --member="serviceAccount:your-admin-sa@your-admin-project.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=your-admin-project-id
```

### API Not Enabled Error: `cloudresourcemanager.googleapis.com` not enabled

**Symptom:** Workflow fails with error:
```
Cloud Resource Manager API has not been used in project [PROJECT_NUMBER] before or it is disabled
```

**Cause:** Required APIs are not enabled in the admin project.

**Solution:**
```bash
# Enable all required APIs in your admin project
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudbilling.googleapis.com \
  serviceusage.googleapis.com \
  --project=your-admin-project-id

# Wait for APIs to propagate
sleep 30
```

### API Enablement Issues

If APIs fail to enable, wait 30 seconds and retry:
```bash
gcloud services enable <api-name> --project=<project-id>
```

### Workload Identity Issues

Verify the binding:
```bash
gcloud iam service-accounts get-iam-policy <sa-email> \
  --project=<project-id>
```

### RAG Corpus Creation Failures

RAG corpus creation uses REST API and may fail if:
- API not enabled yet (wait and retry)
- Permissions missing
- Region not supported

Check workflow logs for detailed error messages.

## Additional Documentation

- [GitHub Variables Setup](../GITHUB_VARIABLES_SETUP.md)
- [Workload Identity Provider Setup](README-workflow-identity-provider.md)
- [Homecare Agent Proxy Deployment](README-homecare-agent-proxy.md)
- [Homecare Agent Deployment](README-homecare-agent.md)
- [PubSub User Docs Deployment](README-pubsub-user-docs.md)
- [Checkpoint Analysis Deployment](README-checkpoint-analysis.md)
- [Webapp Deployment](README-deploy-webapp-apphosting.md)
