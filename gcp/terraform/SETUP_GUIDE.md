# Terraform Setup Guide for HomeApp GCP Infrastructure

This guide walks you through setting up and using Terraform to manage your GCP infrastructure.

## Prerequisites

1. **Install Terraform**

   ```bash
   # macOS
   brew tap hashicorp/tap
   brew install hashicorp/tap/terraform

   # Linux
   wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
   echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
   sudo apt update && sudo apt install terraform

   # Verify installation
   terraform version
   ```

2. **Install Google Cloud SDK**

   ```bash
   # macOS
   brew install --cask google-cloud-sdk

   # Linux
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL

   # Verify installation
   gcloud version
   ```

3. **Authenticate with GCP**

   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

4. **Set Default Project**
   ```bash
   gcloud config set project homegeek-staging-staging  # or homegeek-staging for prod
   ```

## Initial Setup

### Step 1: Enable Required APIs

Before running Terraform, enable the essential APIs:

```bash
# Set your project
export PROJECT_ID=homegeek-staging-staging  # or homegeek-staging for prod

# Enable APIs
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  --project=$PROJECT_ID
```

### Step 2: Create Terraform Variables File

For **Staging**:

```bash
cd terraform/environments/staging
cp terraform.tfvars.example terraform.tfvars
```

For **Production**:

```bash
cd terraform/environments/prod
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your actual values:

```hcl
project_id        = "your-project-id"
environment       = "staging"  # or "prod"
region            = "us-central1"
github_repository = "your-github-org/HomeApp"

# These must be created manually before running Terraform
reasoning_engine_id        = "projects/.../locations/.../reasoningEngines/..."
rag_corpus                 = "projects/.../locations/.../ragCorpora/..."
user_upload_rag_corpus     = "projects/.../locations/.../ragCorpora/..."
knowledge_base_rag_corpus  = "projects/.../locations/.../ragCorpora/..."
```

### Step 3: Manual Resource Creation

Some resources must be created manually before Terraform:

#### 1. Create RAG Corpora

Follow the instructions in `gcp/agents/homecare/rag/` to create RAG corpora:

```bash
cd gcp/agents/homecare/rag
# Follow README instructions to create corpora
# Note the corpus IDs for use in terraform.tfvars
```

#### 2. Deploy Agent Engine (Optional)

If you want to deploy the agent engine first:

```bash
cd gcp/agents/homecare
make deploy
# Note the reasoning engine ID for use in terraform.tfvars
```

## Running Terraform

### Initialize Terraform

```bash
cd terraform/environments/staging  # or prod
terraform init
```

This will:

- Download required providers
- Initialize the backend
- Prepare the working directory

### Plan Infrastructure Changes

```bash
terraform plan
```

Review the plan carefully to ensure:

- Resources to be created are correct
- No unexpected changes
- All variables are properly set

### Apply Infrastructure

```bash
terraform apply
```

Type `yes` when prompted to confirm.

This will create:

- ✅ Service accounts
- ✅ Workload Identity Federation for GitHub Actions
- ✅ GCS buckets
- ✅ Pub/Sub topics and subscriptions
- ✅ Secret Manager secrets (structure only, values added separately)
- ✅ Cloud Run service (infrastructure, code deployed via GitHub Actions)
- ✅ Cloud Function (infrastructure, code deployed via GitHub Actions)
- ✅ IAM bindings

### View Outputs

```bash
terraform output
```

Important outputs:

- `workload_identity_provider` - Use in GitHub Actions workflows
- `deployment_service_account` - Service account email
- `cloud_run_url` - URL of deployed service

## Managing Secrets

Terraform creates the Secret Manager structure, but you must add the actual secret values:

```bash
# Set environment
export PROJECT_ID=homegeek-staging-staging
export ENV=staging

# Add secret values
echo -n "your-telegram-bot-token" | gcloud secrets versions add TELEGRAM_BOT_TOKEN-$ENV --data-file=- --project=$PROJECT_ID
echo -n "your-webhook-secret" | gcloud secrets versions add TELEGRAM_WEBHOOK_SECRET-$ENV --data-file=- --project=$PROJECT_ID
echo -n "your-firebase-secret" | gcloud secrets versions add FIREBASE_WEBHOOK_SECRET-$ENV --data-file=- --project=$PROJECT_ID
echo -n "your-serp-api-key" | gcloud secrets versions add SERP_API_KEY-$ENV --data-file=- --project=$PROJECT_ID
echo -n "your-yelp-api-key" | gcloud secrets versions add -$ENV --data-file=- --project=$PROJECT_ID
```

## Importing Existing Resources

If you already have resources created manually, you can import them into Terraform:

### Import Cloud Run Service

```bash
terraform import module.cloud_run.google_cloud_run_service.proxy \
  projects/homegeek-staging-staging/locations/us-central1/services/homecare-agent-proxy-staging
```

### Import Cloud Function

```bash
terraform import module.cloud_function.google_cloudfunctions2_function.worker \
  projects/homegeek-staging-staging/locations/us-central1/functions/pubsub_to_user_docs-staging
```

### Import Pub/Sub Topics

```bash
terraform import module.pubsub.google_pubsub_topic.user_upload \
  projects/homegeek-staging-staging/topics/user-upload-topic-staging

terraform import module.pubsub.google_pubsub_topic.user_upload_result \
  projects/homegeek-staging-staging/topics/user-upload-result-topic-staging
```

## Using Remote State (Recommended)

For team collaboration, use GCS backend for state storage:

1. Create state bucket:

   ```bash
   gsutil mb gs://${PROJECT_ID}-terraform-state
   gsutil versioning set on gs://${PROJECT_ID}-terraform-state
   ```

2. Uncomment backend configuration in `main.tf`:

   ```hcl
   backend "gcs" {
     bucket = "homegeek-staging-staging-terraform-state"
     prefix = "terraform/staging/state"
   }
   ```

3. Re-initialize:
   ```bash
   terraform init -migrate-state
   ```

## Updating Infrastructure

1. Make changes to `.tf` files or `terraform.tfvars`
2. Plan changes: `terraform plan`
3. Review the plan
4. Apply changes: `terraform apply`

## Destroying Resources

⚠️ **Warning**: This will delete all managed resources!

```bash
terraform destroy
```

For selective destruction:

```bash
terraform destroy -target=module.cloud_function
```

## GitHub Actions Integration

After Terraform creates the Workload Identity Provider, update your GitHub Actions workflows:

1. Get the workload identity provider:

   ```bash
   terraform output workload_identity_provider
   ```

2. Update `.github/workflows/*.yaml`:
   ```yaml
   - name: Google Auth
     uses: google-github-actions/auth@v2
     with:
       workload_identity_provider: "<output-from-above>"
       service_account: "<deployment-service-account-email>"
   ```

## Troubleshooting

### API Not Enabled Error

```bash
gcloud services enable <api-name> --project=$PROJECT_ID
```

### Permission Denied

Ensure you have the required roles:

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:your-email@domain.com" \
  --role="roles/owner"
```

### State Lock

If Terraform state is locked:

```bash
terraform force-unlock <lock-id>
```

### Resource Already Exists

Import the existing resource:

```bash
terraform import <resource-type>.<resource-name> <resource-id>
```

## Best Practices

1. ✅ Always run `terraform plan` before `apply`
2. ✅ Use workspaces or separate directories for environments
3. ✅ Store state remotely in GCS
4. ✅ Version control all `.tf` files
5. ✅ Never commit `.tfvars` files with secrets
6. ✅ Use Secret Manager for sensitive data
7. ✅ Document manual steps outside Terraform
8. ✅ Review and approve plans in team settings
9. ✅ Use `terraform fmt` to format code
10. ✅ Use `terraform validate` to check syntax

## Maintenance

### Update Providers

```bash
terraform init -upgrade
```

### Format Code

```bash
terraform fmt -recursive
```

### Validate Configuration

```bash
terraform validate
```

### View State

```bash
terraform show
terraform state list
```

## Next Steps

1. ✅ Set up Terraform for staging environment
2. ✅ Import existing resources (if any)
3. ✅ Apply configuration
4. ✅ Add secret values to Secret Manager
5. ✅ Update GitHub Actions workflows with new service account
6. ✅ Test deployments
7. ✅ Repeat for production environment

## Support

For issues or questions:

- Check Terraform documentation: https://registry.terraform.io/providers/hashicorp/google/latest/docs
- Review GCP documentation: https://cloud.google.com/docs
- Check project README files in `gcp/` folder
