# GitHub Actions Workflows

This directory contains GitHub Actions workflows for managing GCP infrastructure and deploying applications.

## Overview

All infrastructure and application management is done through GitHub Actions using **gcloud commands only**. No Terraform required.

## Workflows

### Infrastructure Management

#### [create-environment.yaml](create-environment.yaml)
Creates a new environment with all required GCP infrastructure.

**What it creates:**
- GCP Project (optional)
- IAM Service Accounts
- Workload Identity Federation
- Storage Buckets (with versioning, lifecycle, CORS)
- Pub/Sub Topics and Subscriptions
- Secret Manager Secrets (empty, to be populated)
- RAG Corpora (2 separate: user-upload and knowledge-base)
- GitHub Environment with all variables

**Usage:**
```bash
# Navigate to Actions → Create New Environment
# Fill in:
#   - environment_name: qa-team-1
#   - gcp_project_id: your-project-id
#   - create_project: true/false
#   - billing_account_id: (if creating project)
#   - region: us-central1
#   - github_repository: owner/repo
```

**Outputs:**
- All GitHub environment variables set automatically
- Configuration file in workflow artifacts
- Environment ready for application deployment

#### [destroy-environment.yaml](destroy-environment.yaml)
Destroys an environment and optionally deletes the GCP project.

**What it deletes:**
- Cloud Run services
- Cloud Functions
- Pub/Sub topics and subscriptions
- Storage buckets
- Secret Manager secrets
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

#### [deploy-homecare-agent.yaml](deploy-homecare-agent.yaml)
Deploys the homecare reasoning engine.

See [README-homecare-agent.md](README-homecare-agent.md) for details.

#### [deploy-pubsub-user-docs.yaml](deploy-pubsub-user-docs.yaml)
Deploys the PubSub to User Docs Cloud Function.

See [README-pubsub-user-docs.md](README-pubsub-user-docs.md) for details.

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

# Secrets
gcloud secrets create secret-name ...

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

### Organization-Level Setup

These secrets must be configured at the organization or repository level:

- `ORG_WIF_PROVIDER`: Organization-level Workload Identity Provider
- `ORG_ADMIN_SERVICE_ACCOUNT`: Service account with permissions to create projects and resources

See [README-workflow-identity-provider.md](README-workflow-identity-provider.md) for setup instructions.

### Permissions Required

The `ORG_ADMIN_SERVICE_ACCOUNT` needs:
- `roles/resourcemanager.projectCreator` (if creating projects)
- `roles/billing.user` (if creating projects)
- `roles/iam.serviceAccountAdmin`
- `roles/iam.workloadIdentityPoolAdmin`
- `roles/storage.admin`
- `roles/pubsub.admin`
- `roles/secretmanager.admin`
- `roles/aiplatform.admin`

## Best Practices

### Environment Naming

Use descriptive names that indicate purpose:
- `qa-team-1` - QA environment for team 1
- `demo-customer-x` - Demo for specific customer
- `staging` - Staging environment
- `prod` - Production environment

### Secret Management

Secrets are created empty. Add values manually:

```bash
# Add secret value
echo -n "your-secret-value" | gcloud secrets versions add TELEGRAM_BOT_TOKEN-qa-team-1 \
  --project=your-project-id \
  --data-file=-
```

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
- [Webapp Deployment](README-deploy-webapp-apphosting.md)
