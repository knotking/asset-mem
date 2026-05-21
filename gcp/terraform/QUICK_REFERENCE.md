# Terraform Quick Reference

## Common Commands

### Initial Setup

```bash
cd terraform/environments/staging  # or prod
terraform init
```

### Daily Operations

```bash
terraform plan                    # Preview changes
terraform apply                   # Apply changes
terraform destroy                 # Destroy resources
terraform output                  # Show outputs
```

### Using Makefile

```bash
make init-staging                 # Initialize staging
make plan-staging                 # Plan staging changes
make apply-staging                # Apply staging changes
make output-staging               # Show staging outputs
```

## Environment Locations

- **Staging**: `terraform/environments/staging/`
- **Production**: `terraform/environments/prod/`

## Configuration Files

- `main.tf` - Main infrastructure definition
- `variables.tf` - Variable declarations
- `terraform.tfvars` - Variable values (gitignored)
- `terraform.tfvars.example` - Example values (committed)

## Resources Created

| Resource        | Naming Pattern                                               |
| --------------- | ------------------------------------------------------------ |
| Service Account | `githubworkflowdeployment@{project}.iam.gserviceaccount.com` |
| Cloud Run       | `homecare-agent-proxy-{env}`                                 |
| Cloud Function  | `pubsub_to_user_docs-{env}`                                  |
| Storage Bucket  | `homegeek-user-data-{env}`                                   |
| Pub/Sub Topic   | `user-upload-topic-{env}`                                    |
| Secrets         | `{SECRET_NAME}-{env}`                                        |

## Key Outputs

```bash
terraform output workload_identity_provider     # For GitHub Actions
terraform output deployment_service_account     # Service account email
terraform output cloud_run_url                  # Cloud Run service URL
terraform output user_data_bucket               # Storage bucket name
```

## Adding Secret Values

```bash
# Set environment
export ENV=staging  # or prod
export PROJECT_ID=homegeek-staging-staging

# Add secrets
echo -n "your-value" | gcloud secrets versions add TELEGRAM_BOT_TOKEN-$ENV \
  --data-file=- --project=$PROJECT_ID
```

## Importing Existing Resources

```bash
# Pub/Sub Topic
terraform import module.pubsub.google_pubsub_topic.user_upload \
  projects/PROJECT_ID/topics/TOPIC_NAME

# Storage Bucket
terraform import module.storage.google_storage_bucket.user_data \
  BUCKET_NAME

# Cloud Run Service
terraform import module.cloud_run.google_cloud_run_service.proxy \
  projects/PROJECT_ID/locations/REGION/services/SERVICE_NAME
```

## State Management

```bash
terraform state list              # List all resources
terraform state show RESOURCE     # Show resource details
terraform state pull              # Download state
terraform state rm RESOURCE       # Remove from state (doesn't delete resource)
```

## Troubleshooting

### Force unlock state

```bash
terraform force-unlock LOCK_ID
```

### Refresh state

```bash
terraform refresh
```

### Validate configuration

```bash
terraform validate
```

### Format code

```bash
terraform fmt -recursive
```

### Debug mode

```bash
TF_LOG=DEBUG terraform apply
```

## Workflow Integration

After Terraform creates resources, update GitHub Actions workflows:

```yaml
- name: Google Auth
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
    service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
```

Get these values:

```bash
terraform output workload_identity_provider
terraform output deployment_service_account
```

## Variables Reference

### Required Variables

- `project_id` - GCP project ID
- `environment` - staging or prod
- `github_repository` - GitHub repo (owner/repo)
- `rag_corpus` - RAG corpus resource name
- `user_upload_rag_corpus` - User upload corpus
- `knowledge_base_rag_corpus` - Knowledge base corpus

### Optional Variables (have defaults)

- `region` - Default: us-central1
- `bucket_name` - Default: homegeek-user-data
- `service_name` - Default: homecare-agent-proxy
- `function_name` - Default: pubsub_to_user_docs
- `reasoning_engine_id` - Default: new

## Manual Steps Required

1. ✅ Create RAG corpora (via `gcp/agents/homecare/rag/`)
2. ✅ Deploy agent engine (via `gcp/agents/homecare/deployment/`)
3. ✅ Add secret values (via `gcloud secrets versions add`)
4. ✅ Update GitHub repository secrets with Terraform outputs
5. ✅ Update `terraform.tfvars` with RAG corpus IDs

## Cost-Saving Tips

- Cloud Run scales to zero automatically
- Cloud Functions scale to zero automatically
- Set appropriate lifecycle rules on storage buckets
- Monitor billing dashboard regularly
- Use `terraform destroy` for temporary environments

## Safety Checklist

Before `terraform apply`:

- [ ] Run `terraform plan` and review changes
- [ ] Check you're in the correct environment directory
- [ ] Verify variables in `terraform.tfvars`
- [ ] Ensure secrets are backed up
- [ ] Have rollback plan ready

Before `terraform destroy`:

- [ ] Double-check you're in the correct environment
- [ ] Back up any data from storage buckets
- [ ] Export any important configurations
- [ ] Verify no production dependencies

## Getting Help

- 📖 Read `SETUP_GUIDE.md` for detailed instructions
- 📋 Check `TERRAFORM_SUMMARY.md` for architecture overview
- 🔧 Use `make help` for available commands
- 🌐 Visit [Terraform Google Provider Docs](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- ☁️ Check [GCP Documentation](https://cloud.google.com/docs)
