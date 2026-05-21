# Terraform Infrastructure for HomeApp

This directory contains Terraform configurations for managing all GCP resources used by the HomeApp project.
This is a WORK IN PROGRESS

## Overview

The infrastructure is organized into modules for managing:

- Vertex AI (Agent Engine, RAG Corpus)
- Cloud Run services
- Cloud Functions
- Cloud Storage buckets
- Pub/Sub topics and subscriptions
- IAM service accounts and permissions
- Secrets Manager for API keys

## Structure

```
terraform/
├── README.md
├── environments/
│   ├── staging/
│   │   ├── main.tf           # Staging environment config
│   │   ├── variables.tf      # Staging-specific variables
│   │   └── terraform.tfvars  # Staging values
│   └── prod/
│       ├── main.tf           # Production environment config
│       ├── variables.tf      # Production-specific variables
│       └── terraform.tfvars  # Production values
├── modules/
│   ├── vertex-ai/            # Vertex AI RAG corpus
│   ├── cloud-run/            # Cloud Run services
│   ├── cloud-function/       # Cloud Functions
│   ├── storage/              # GCS buckets
│   ├── pubsub/               # Pub/Sub topics/subscriptions
│   ├── iam/                  # Service accounts & IAM
│   └── secrets/              # Secret Manager
└── shared/
    ├── backend.tf            # Terraform backend config
    └── versions.tf           # Provider versions
```

## Prerequisites

1. **Install Terraform**: https://developer.hashicorp.com/terraform/downloads
2. **Authenticate with GCP**:
   ```bash
   gcloud auth application-default login
   ```
3. **Set your GCP project**:
   ```bash
   export GOOGLE_CLOUD_PROJECT=<your-project-id>
   ```

## Usage

### Initialize Terraform

```bash
cd terraform/environments/staging  # or prod
terraform init
```

### Plan Changes

```bash
terraform plan
```

### Apply Changes

```bash
terraform apply
```

### Destroy Resources

```bash
terraform destroy
```

## Environment Management

### Staging Environment

- Location: `terraform/environments/staging/`
- GCP Project: `homegeek-staging-staging`
- Region: `us-central1`
- Branch: `deploy`

### Production Environment

- Location: `terraform/environments/prod/`
- GCP Project: `homegeek-staging`
- Region: `us-central1`
- Branch: `main`

## Important Notes

1. **State Management**: Terraform state is stored in GCS bucket (configured in `backend.tf`)
2. **Secrets**: API keys and tokens are managed via Secret Manager (not in code)
3. **Manual Steps**: Some resources like Vertex AI Agent Engine and RAG corpus may need manual deployment first
4. **Dependencies**: Ensure all required GCP APIs are enabled before running Terraform

## Managed Resources

### Core Services

- Cloud Run: `homecare-agent-proxy-{env}`
- Cloud Function: `pubsub_to_user_docs-{env}`
- Cloud Storage: `homegeek-user-data-{env}`

### Messaging

- Pub/Sub Topic: `user-upload-topic-{env}`
- Pub/Sub Topic: `user-upload-result-topic-{env}`
- Subscriptions for both topics

### IAM

- Service Account: `githubworkflowdeployment@{project}.iam.gserviceaccount.com`
- Workload Identity Pool for GitHub Actions
- Role bindings for all services

### Secrets

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `FIREBASE_WEBHOOK_SECRET`
- `SERP_API_KEY`
- ``

## Workflow Integration

The Terraform configuration is designed to work alongside GitHub Actions workflows:

- Workflows deploy application code
- Terraform manages infrastructure resources
- Both use the same service account for authentication

## Troubleshooting

### Common Issues

1. **API not enabled**: Enable required APIs via console or:

   ```bash
   gcloud services enable <api-name>.googleapis.com
   ```

2. **Permission denied**: Ensure your service account has necessary roles

3. **State lock**: If state is locked, you can force unlock:
   ```bash
   terraform force-unlock <lock-id>
   ```

## Best Practices

1. Always run `terraform plan` before `apply`
2. Use separate workspaces/directories for staging and production
3. Store sensitive values in Secret Manager, not in `.tfvars` files
4. Review and version control all `.tf` files
5. Document any manual steps required outside Terraform
