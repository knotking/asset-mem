# Infrastructure Setup and Management

This guide covers the infrastructure setup, configuration, and management for HomeApp on Google Cloud Platform.

## Overview

HomeApp infrastructure is built on Google Cloud Platform (GCP) with:

- Firebase App Hosting for web application
- Cloud Run for API services
- Cloud Functions for async processing
- Vertex AI for AI/ML capabilities
- Firestore for database
- Cloud Storage for file storage
- Pub/Sub for messaging
- Secret Manager for secrets

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Frontend Layer                           │  │
│  │  ┌────────────────────┐  ┌────────────────────────┐  │  │
│  │  │ Firebase App       │  │ Cloud CDN              │  │  │
│  │  │ Hosting            │  │ (Image Optimization)   │  │  │
│  │  │ (Next.js WebApp)   │  │                        │  │  │
│  │  └────────────────────┘  └────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Layer                                │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ Cloud Run Services                             │  │  │
│  │  │  - homecare-agent-proxy-staging                │  │  │
│  │  │  - homecare-agent-proxy-prod                   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│           ┌──────────────┼──────────────┐                  │
│           ▼              ▼              ▼                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │  AI/ML       │ │  Processing  │ │  Data        │      │
│  │              │ │              │ │              │      │
│  │ - Vertex AI  │ │ - Cloud      │ │ - Firestore  │      │
│  │   Agent      │ │   Functions  │ │ - Cloud      │      │
│  │ - RAG Corpus │ │ - Pub/Sub    │ │   Storage    │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Supporting Services                      │  │
│  │  - Secret Manager                                     │  │
│  │  - Cloud Logging                                      │  │
│  │  - Cloud Monitoring                                   │  │
│  │  - IAM & Service Accounts                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Tools

```bash
# Install Google Cloud SDK
# Download from https://cloud.google.com/sdk/docs/install

# Install Terraform (optional, for IaC)
# Download from https://www.terraform.io/downloads

# Verify installations
gcloud --version
terraform --version  # if using Terraform
```

### GCP Project Setup

```bash
# Create new project (if needed)
gcloud projects create PROJECT_ID --name="HomeApp"

# Set default project
gcloud config set project PROJECT_ID

# Enable billing
# Do this in Cloud Console: https://console.cloud.google.com/billing
```

## Initial Setup

### 1. Enable Required APIs

```bash
# Enable all required APIs
gcloud services enable \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  firestore.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  pubsub.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  storage-api.googleapis.com \
  storage-component.googleapis.com \
  sts.googleapis.com
```

### 2. Create Service Accounts

#### Deployment Service Account

```bash
# Create service account
gcloud iam service-accounts create githubworkflowdeployment \
  --display-name="GitHub Workflow Deployment" \
  --description="Service account for GitHub Actions deployments"

# Grant required roles
ROLES=(
  "roles/run.developer"
  "roles/cloudfunctions.developer"
  "roles/artifactregistry.writer"
  "roles/cloudbuild.builds.editor"
  "roles/iam.serviceAccountUser"
  "roles/storage.admin"
  "roles/pubsub.editor"
  "roles/aiplatform.user"
  "roles/secretmanager.secretAccessor"
  "roles/firebase.admin"
)

for role in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
    --role="$role"
done
```

#### AI Platform Service Agent

```bash
# Grant AI Platform service agent permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-aiplatform-re.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### 3. Setup Workload Identity Federation

```bash
# Create workload identity pool
gcloud iam workload-identity-pools create github-actions-pool \
  --project=PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"

# Create workload identity provider
gcloud iam workload-identity-pools providers create-oidc github-actions-provider \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --display-name="GitHub Actions Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Grant service account access
gcloud iam service-accounts add-iam-policy-binding \
  githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com \
  --project=PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/YOUR_ORG/HomeApp"

# Get workload identity provider name (save this)
gcloud iam workload-identity-pools providers describe github-actions-provider \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --format="value(name)"
```

## Resource Setup

### 1. Cloud Storage

```bash
# Create main bucket
gsutil mb -p PROJECT_ID -l us-central1 gs://homegeek-user-data

# Create staging bucket for agent
gsutil mb -p PROJECT_ID -l us-central1 gs://homegeek-agent-staging

# Set lifecycle policy (optional)
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 90,
          "matchesPrefix": ["temp/"]
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://homegeek-user-data

# Set CORS policy (if needed)
cat > cors.json << EOF
[
  {
    "origin": ["https://staging--homegeek-staging.us-central1.hosted.app", "https://prod--homegeek-prod.us-central1.hosted.app"],
    "method": ["GET", "PUT", "POST"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://homegeek-user-data
```

### 2. Pub/Sub Topics and Subscriptions

```bash
# User upload topics
gcloud pubsub topics create user-upload-topic
gcloud pubsub topics create user-upload-result-topic

gcloud pubsub subscriptions create user-upload-topic-subscription \
  --topic=user-upload-topic \
  --ack-deadline=600

gcloud pubsub subscriptions create user-upload-result-subscription \
  --topic=user-upload-result-topic \
  --ack-deadline=60

# Checkpoint topics
gcloud pubsub topics create checkpoint-analysis-topic
gcloud pubsub topics create checkpoint-metrics-topic

gcloud pubsub subscriptions create checkpoint-analysis-subscription \
  --topic=checkpoint-analysis-topic \
  --ack-deadline=600

gcloud pubsub subscriptions create checkpoint-metrics-subscription \
  --topic=checkpoint-metrics-topic \
  --ack-deadline=60

# Configure dead letter queues (optional)
gcloud pubsub topics create user-upload-dlq
gcloud pubsub subscriptions update user-upload-topic-subscription \
  --dead-letter-topic=user-upload-dlq \
  --max-delivery-attempts=5
```

### 3. Firestore Database

```bash
# Create Firestore database (do this in Console)
# https://console.firebase.google.com/project/PROJECT_ID/firestore

# Or via gcloud (if available)
gcloud firestore databases create --region=us-central1

# Deploy Firestore rules
cd apps/webapp
firebase deploy --only firestore:rules,firestore:indexes --project PROJECT_ID
```

### 4. Secret Manager

```bash
# Create secrets
echo -n "your-telegram-bot-token" | \
  gcloud secrets create telegram-bot-token --data-file=-

echo -n "your-telegram-webhook-secret" | \
  gcloud secrets create telegram-webhook-secret --data-file=-

echo -n "your-firebase-webhook-secret" | \
  gcloud secrets create firebase-webhook-secret --data-file=-

echo -n "your-serp-api-key" | \
  gcloud secrets create serp-api-key --data-file=-

echo -n "your-yelp-api-key" | \
  gcloud secrets create yelp-api-key --data-file=-

# Grant access to service account
SECRETS=(
  "telegram-bot-token"
  "telegram-webhook-secret"
  "firebase-webhook-secret"
  "serp-api-key"
  "yelp-api-key"
)

for secret in "${SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 5. Vertex AI RAG Corpus

```bash
# Create knowledge base corpus
gcloud ai rag-corpora create \
  --display-name="homecare-knowledge-base" \
  --region=us-central1

# Create user upload corpus
gcloud ai rag-corpora create \
  --display-name="homecare-user-uploads" \
  --region=us-central1

# Import initial documents
gcloud ai rag-corpora import-files CORPUS_ID \
  --region=us-central1 \
  --source=gs://your-bucket/knowledge-base/
```

### 6. Artifact Registry

```bash
# Create repository for container images
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=us-central1 \
  --description="Container images for Cloud Run services"

# Grant access to service account
gcloud artifacts repositories add-iam-policy-binding cloud-run-source-deploy \
  --location=us-central1 \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

## Terraform Infrastructure (Optional)

### Setup Terraform

```bash
cd gcp/terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars
cat > environments/staging/terraform.tfvars << EOF
project_id     = "homegeek-staging"
project_number = "PROJECT_NUMBER"
region         = "us-central1"
environment    = "staging"
EOF
```

### Deploy Infrastructure

```bash
# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy (if needed)
terraform destroy
```

### Managed Resources

Terraform can manage:

- Cloud Run services
- Cloud Functions
- Pub/Sub topics and subscriptions
- Cloud Storage buckets
- IAM service accounts and bindings
- Secret Manager secrets (references only)

## Monitoring and Logging

### Cloud Logging

```bash
# Create log sink for errors
gcloud logging sinks create error-sink \
  storage.googleapis.com/homegeek-logs \
  --log-filter='severity >= ERROR'

# View logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

### Cloud Monitoring

```bash
# Create uptime check
gcloud monitoring uptime-checks create https-check \
  --display-name="Proxy API Uptime" \
  --resource-type=uptime-url \
  --monitored-resource=https://homecare-agent-proxy-staging-*.run.app/health

# Create alert policy
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

### Dashboards

Create custom dashboards in Cloud Console:

1. Navigate to Monitoring → Dashboards
2. Create dashboard
3. Add charts for:
   - Request count
   - Error rate
   - Latency
   - Resource utilization

## Security Configuration

### IAM Best Practices

```bash
# Audit IAM policies
gcloud projects get-iam-policy PROJECT_ID > iam-policy.yaml

# Remove unnecessary permissions
gcloud projects remove-iam-policy-binding PROJECT_ID \
  --member="user:email@example.com" \
  --role="roles/owner"

# Use custom roles for least privilege
gcloud iam roles create customRole \
  --project=PROJECT_ID \
  --title="Custom Role" \
  --permissions=permission1,permission2
```

### VPC and Networking (Optional)

```bash
# Create VPC network
gcloud compute networks create homeapp-vpc \
  --subnet-mode=custom

# Create subnet
gcloud compute networks subnets create homeapp-subnet \
  --network=homeapp-vpc \
  --region=us-central1 \
  --range=10.0.0.0/24

# Create VPC connector for Cloud Run
gcloud compute networks vpc-access connectors create homeapp-connector \
  --region=us-central1 \
  --network=homeapp-vpc \
  --range=10.8.0.0/28

# Use connector in Cloud Run
gcloud run services update homecare-agent-proxy-staging \
  --vpc-connector=homeapp-connector \
  --vpc-egress=all-traffic
```

### Cloud Armor (Optional)

```bash
# Create security policy
gcloud compute security-policies create homeapp-policy \
  --description="Security policy for HomeApp"

# Add rate limiting rule
gcloud compute security-policies rules create 1000 \
  --security-policy=homeapp-policy \
  --expression="true" \
  --action=rate-based-ban \
  --rate-limit-threshold-count=100 \
  --rate-limit-threshold-interval-sec=60 \
  --ban-duration-sec=600

# Attach to backend service (requires load balancer)
```

## Cost Optimization

### Resource Quotas

```bash
# View quotas
gcloud compute project-info describe --project=PROJECT_ID

# Request quota increase (if needed)
# Do this in Cloud Console: https://console.cloud.google.com/iam-admin/quotas
```

### Budget Alerts

```bash
# Create budget (do this in Cloud Console)
# https://console.cloud.google.com/billing/budgets

# Or use gcloud (if available)
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="HomeApp Monthly Budget" \
  --budget-amount=1000 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

### Cost Monitoring

```bash
# Export billing data to BigQuery
# Configure in Cloud Console: https://console.cloud.google.com/billing/export

# Query costs
bq query --use_legacy_sql=false '
SELECT
  service.description,
  SUM(cost) as total_cost
FROM `PROJECT_ID.billing_export.gcp_billing_export_*`
WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY service.description
ORDER BY total_cost DESC
'
```

## Backup and Disaster Recovery

### Firestore Backups

```bash
# Create backup
gcloud firestore export gs://homegeek-backups/firestore/$(date +%Y%m%d)

# Restore from backup
gcloud firestore import gs://homegeek-backups/firestore/20240101
```

### Cloud Storage Versioning

```bash
# Enable versioning
gsutil versioning set on gs://homegeek-user-data

# List versions
gsutil ls -a gs://homegeek-user-data/file.pdf
```

### Disaster Recovery Plan

1. **Regular Backups**:
   - Firestore: Daily exports
   - Cloud Storage: Versioning enabled
   - Secrets: Documented in secure location

2. **Recovery Procedures**:
   - Document all infrastructure setup
   - Maintain Terraform configurations
   - Keep deployment scripts updated
   - Test recovery procedures quarterly

3. **High Availability**:
   - Multi-region deployment (optional)
   - Load balancing (optional)
   - Automatic failover (optional)

## Maintenance

### Regular Tasks

**Daily**:

- Monitor error rates
- Check deployment status
- Review critical alerts

**Weekly**:

- Review logs for issues
- Check resource utilization
- Update dependencies

**Monthly**:

- Review IAM permissions
- Rotate secrets
- Review costs
- Update documentation

**Quarterly**:

- Security audit
- Performance review
- Disaster recovery test
- Infrastructure review

### Updates and Patches

```bash
# Update Cloud Run services
gcloud run services update SERVICE_NAME \
  --region=us-central1 \
  --image=NEW_IMAGE

# Update Cloud Functions
gcloud functions deploy FUNCTION_NAME \
  --region=us-central1 \
  --source=.

# Update Firestore rules
firebase deploy --only firestore:rules --project PROJECT_ID
```

## Troubleshooting

### Common Issues

#### Quota Exceeded

```bash
# Check quotas
gcloud compute project-info describe --project=PROJECT_ID

# Request increase in Cloud Console
```

#### Permission Denied

```bash
# Check service account permissions
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*"

# Grant missing permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/REQUIRED_ROLE"
```

#### Resource Not Found

```bash
# Verify resource exists
gcloud run services list
gcloud functions list
gcloud pubsub topics list

# Create if missing (see setup sections above)
```

## Related Documentation

- [GCP Documentation](https://cloud.google.com/docs)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Web Application Deployment](./WEBAPP_DEPLOYMENT.md)
- [Agent Deployment](./AGENT_DEPLOYMENT.md)
- [Proxy Deployment](./PROXY_DEPLOYMENT.md)
- [CI/CD Pipeline Documentation](./CICD.md)
- [Environment Configuration](./ENVIRONMENTS.md)
