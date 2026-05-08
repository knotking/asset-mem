# Terraform Infrastructure Summary

## Overview

This Terraform configuration manages the complete GCP infrastructure for the HomeApp project, including:
- Service accounts and IAM permissions
- Workload Identity Federation for GitHub Actions
- Cloud Storage buckets
- Pub/Sub topics and subscriptions
- Secret Manager for API keys
- Cloud Run services
- Cloud Functions

## Directory Structure

```
terraform/
├── README.md                      # Main documentation
├── SETUP_GUIDE.md                 # Detailed setup instructions
├── TERRAFORM_SUMMARY.md           # This file
├── Makefile                       # Convenience commands
├── .gitignore                     # Git ignore rules
│
├── shared/                        # Shared configuration
│   ├── versions.tf                # Provider versions
│   └── backend.tf                 # Backend configuration
│
├── modules/                       # Reusable modules
│   ├── iam/                       # Service accounts & IAM
│   ├── storage/                   # GCS buckets
│   ├── pubsub/                    # Pub/Sub topics
│   ├── secrets/                   # Secret Manager
│   ├── cloud-run/                 # Cloud Run service
│   └── cloud-function/            # Cloud Functions
│
└── environments/                  # Environment-specific configs
    ├── staging/
    │   ├── main.tf
    │   ├── variables.tf
    │   ├── terraform.tfvars.example
    │   └── terraform.tfvars (gitignored)
    └── prod/
        ├── main.tf
        ├── variables.tf
        ├── terraform.tfvars.example
        └── terraform.tfvars (gitignored)
```

## What Terraform Manages

### ✅ Fully Managed Resources
- IAM service accounts
- Workload Identity Federation
- GCS buckets
- Pub/Sub topics and subscriptions
- Secret Manager secrets (structure)
- IAM role bindings
- API enablement

### ⚠️ Partially Managed Resources
- **Cloud Run services**: Infrastructure managed by Terraform, application code deployed by GitHub Actions
- **Cloud Functions**: Infrastructure managed by Terraform, function code deployed by GitHub Actions

### ❌ Not Managed by Terraform (Manual Steps Required)
- **Vertex AI RAG Corpus**: Must be created via `gcp/agents/homecare/rag/`
- **Vertex AI Agent Engine**: Deployed via `gcp/agents/homecare/deployment/deploy.py`
- **Secret Manager values**: Created by Terraform, but values must be added manually via `gcloud` or console
- **GitHub repository secrets**: Must be configured in GitHub settings

## Quick Start

### 1. Initialize (First Time Only)
```bash
cd terraform/environments/staging
terraform init
```

### 2. Create Variables File
```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### 3. Plan Changes
```bash
terraform plan
```

### 4. Apply Configuration
```bash
terraform apply
```

### Using Makefile (Recommended)
```bash
# Initialize
make init-staging

# Plan changes
make plan-staging

# Apply changes
make apply-staging

# View outputs
make output-staging
```

## Resource Naming Convention

All resources follow the pattern: `{base-name}-{environment}`

**Staging Examples:**
- Service: `homecare-agent-proxy-staging`
- Function: `pubsub_to_user_docs-staging`
- Bucket: `homegeek-user-data-staging`
- Topic: `user-upload-topic-staging`

**Production Examples:**
- Service: `homecare-agent-proxy-prod`
- Function: `pubsub_to_user_docs-prod`
- Bucket: `homegeek-user-data-prod`
- Topic: `user-upload-topic-prod`

## Integration with Existing Workflows

### GitHub Actions
Terraform creates the Workload Identity Provider and service accounts. Update your workflows with:

```yaml
- name: Google Auth
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.WIF_PROVIDER }}  # From terraform output
    service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}      # From terraform output
```

### Application Deployment
The GitHub Actions workflows continue to handle application deployments:
- `deploy-homecare-agent.yaml` - Deploys agent to Vertex AI
- `deploy-homecare-agent-proxy.yaml` - Deploys API to Cloud Run
- `deploy-cloud-function.yaml` - Deploys worker to Cloud Functions

Terraform manages the infrastructure these deployments use.

## Module Details

### IAM Module (`modules/iam/`)
**Creates:**
- Service account: `githubworkflowdeployment@{project}.iam.gserviceaccount.com`
- Workload Identity Pool and Provider for GitHub Actions
- IAM role bindings for deployment operations

**Outputs:**
- `deployment_service_account_email`
- `workload_identity_provider`

### Storage Module (`modules/storage/`)
**Creates:**
- User data bucket: `homegeek-user-data-{env}`
- Agent catalog bucket: `homegeek-catalog`
- Terraform state bucket: `{project}-terraform-state`

**Outputs:**
- `user_data_bucket_name`
- `user_data_bucket_url`
- `agent_catalog_bucket_name`

### Pub/Sub Module (`modules/pubsub/`)
**Creates:**
- Topic: `user-upload-topic-{env}`
- Subscription: `user-upload-subscription-{env}`
- Topic: `user-upload-result-topic-{env}`
- Subscription: `user-upload-result-subscription-{env}`

**Outputs:**
- `user_upload_topic_name`
- `user_upload_topic_id`
- `user_upload_result_topic_name`
- `user_upload_result_topic_id`

### Secrets Module (`modules/secrets/`)
**Creates secrets for:**
- `TELEGRAM_BOT_TOKEN-{env}`
- `TELEGRAM_WEBHOOK_SECRET-{env}`
- `FIREBASE_WEBHOOK_SECRET-{env}`
- `SERP_API_KEY-{env}`
- `-{env}`

**Note:** Secret structure is created, but values must be added separately.

**Outputs:**
- `secret_ids`
- `secret_names`

### Cloud Run Module (`modules/cloud-run/`)
**Creates:**
- Cloud Run service: `homecare-agent-proxy-{env}`
- Public access IAM binding
- Environment variable configuration

**Lifecycle:**
- Infrastructure managed by Terraform
- Container images deployed by GitHub Actions
- Uses `ignore_changes` to prevent Terraform from reverting deployments

**Outputs:**
- `service_url`
- `service_name`

### Cloud Function Module (`modules/cloud-function/`)
**Creates:**
- Cloud Function Gen2: `pubsub_to_user_docs-{env}`
- Pub/Sub trigger configuration
- Environment variable configuration

**Lifecycle:**
- Infrastructure managed by Terraform
- Function code deployed by GitHub Actions
- Uses `ignore_changes` to prevent Terraform from reverting deployments

**Outputs:**
- `function_name`
- `function_uri`

## Post-Terraform Manual Steps

After applying Terraform, you must:

1. **Add Secret Values**
   ```bash
   echo -n "value" | gcloud secrets versions add SECRET_NAME-staging --data-file=-
   ```

2. **Create RAG Corpora**
   ```bash
   cd gcp/agents/homecare/rag
   # Follow README instructions
   ```

3. **Deploy Agent Engine**
   ```bash
   cd gcp/agents/homecare
   make deploy
   ```

4. **Update GitHub Secrets**
   - Add `WIF_PROVIDER` (from terraform output)
   - Add `WIF_SERVICE_ACCOUNT` (from terraform output)

5. **Update terraform.tfvars**
   - Add `reasoning_engine_id` from agent deployment
   - Add `rag_corpus` IDs from RAG corpus creation

6. **Re-run Terraform**
   ```bash
   terraform apply
   ```

## Important Notes

### State Management
- Local state by default
- For teams, use GCS backend (see SETUP_GUIDE.md)
- State includes sensitive information - protect it!

### Resource Lifecycle
- Cloud Run and Cloud Functions use `ignore_changes` for code deployments
- Terraform manages infrastructure, GitHub Actions manages code
- Both can coexist without conflicts

### Dependencies
- Some resources depend on manual creation (RAG corpora, Agent Engine)
- Add these resource IDs to `terraform.tfvars` after creation
- Terraform will use them as configuration, not manage them

### Cost Management
- Resources are created in us-central1 by default
- Cloud Run/Functions scale to zero when not in use
- Storage and Pub/Sub have ongoing costs
- Review GCP billing regularly

## Troubleshooting

### Common Issues

1. **API Not Enabled**
   - Solution: `gcloud services enable <api>.googleapis.com`

2. **Permission Denied**
   - Solution: Check IAM roles, ensure authentication is correct

3. **Resource Already Exists**
   - Solution: Import existing resource or remove from Terraform

4. **State Lock**
   - Solution: `terraform force-unlock <lock-id>`

### Getting Help

1. Check `SETUP_GUIDE.md` for detailed instructions
2. Review module-specific error messages
3. Check Terraform logs: `TF_LOG=DEBUG terraform apply`
4. Consult GCP documentation for specific resource issues

## Maintenance

### Regular Tasks
- Update provider versions: `terraform init -upgrade`
- Format code: `make fmt`
- Validate configs: `make validate`
- Review and clean up old resources

### Before Major Changes
1. Create a plan: `terraform plan -out=tfplan`
2. Review the plan carefully
3. Back up state: `terraform state pull > backup.tfstate`
4. Apply: `terraform apply tfplan`

### Rolling Back
If something goes wrong:
1. Revert Terraform code changes
2. Run `terraform plan` to see what will revert
3. Run `terraform apply` to revert infrastructure
4. For application code, use GitHub Actions to redeploy previous version

## Security Best Practices

✅ **Do:**
- Use Workload Identity Federation (no service account keys)
- Store secrets in Secret Manager
- Use least-privilege IAM roles
- Enable audit logging
- Version control all `.tf` files
- Use remote state with encryption

❌ **Don't:**
- Commit `.tfvars` files with secrets
- Store service account keys in code
- Grant overly broad IAM roles
- Disable audit logs
- Store state files in public locations

## Next Steps

1. ✅ Review `SETUP_GUIDE.md` for detailed setup instructions
2. ✅ Set up staging environment first
3. ✅ Test all workflows with staging
4. ✅ Replicate to production when stable
5. ✅ Set up remote state backend for team collaboration
6. ✅ Document any project-specific customizations

## Support Resources

- [Terraform Google Provider Docs](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [GCP Documentation](https://cloud.google.com/docs)
- [Project README files](../README.md)
- [GitHub Actions Workflows](../../.github/workflows/)
