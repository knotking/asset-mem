# Reports Feature - Deployment Guide

## Prerequisites

- Google Cloud Project with billing enabled
- Firebase project linked to GCP
- Terraform installed (optional, for infrastructure as code)
- gcloud CLI installed and authenticated
- Python 3.11+ (for Cloud Function)
- Node.js 18+ (for frontend)

## Environment Variables

### Backend (GCP)

Create `.env` file in `gcp/proxy/api/`:
```bash
# Google Cloud
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Pub/Sub
REPORT_ANALYSIS_TOPIC=report-analysis-topic
CHECKPOINT_ANALYSIS_TOPIC=checkpoint-analysis-topic

# Firebase
FIREBASE_WEBHOOK_SECRET=your-webhook-secret-here

# Storage
GOOGLE_CLOUD_BUCKET=your-bucket-name
```

### Frontend (Web)

Create `.env.local` in `apps/webapp/`:
```bash
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NEXT_PUBLIC_FIREBASE_WEBHOOK_SECRET=your-webhook-secret-here

# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## Step-by-Step Deployment

### 1. Enable Required APIs

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  pubsub.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com
```

### 2. Create Pub/Sub Topic

```bash
# Create topic for report analysis
gcloud pubsub topics create report-analysis-topic

# Verify creation
gcloud pubsub topics list | grep report-analysis
```

### 3. Deploy Cloud Function

#### Option A: Using gcloud CLI

```bash
cd gcp/proxy/workers/function/report_analysis

# Deploy function
gcloud functions deploy pubsub-report-analysis \
  --gen2 \
  --runtime=python311 \
  --region=us-central1 \
  --source=. \
  --entry-point=pubsub_report_analysis \
  --trigger-topic=report-analysis-topic \
  --memory=2GB \
  --timeout=540s \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=your-project-id,GOOGLE_CLOUD_LOCATION=us-central1"
```

#### Option B: Using Firebase Functions

```bash
# From project root
firebase deploy --only functions:reportAnalysis
```

**Function Configuration** (`functions.yaml`):
```yaml
reportAnalysis:
  runtime: python311
  memory: 2GB
  timeout: 540s
  trigger:
    eventType: google.cloud.pubsub.topic.v1.messagePublished
    resource: projects/PROJECT_ID/topics/report-analysis-topic
  env:
    GOOGLE_CLOUD_PROJECT: your-project-id
    GOOGLE_CLOUD_LOCATION: us-central1
```

### 4. Deploy API (Cloud Run)

```bash
cd gcp/proxy/api

# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/proxy-api

# Deploy to Cloud Run
gcloud run deploy proxy-api \
  --image gcr.io/PROJECT_ID/proxy-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="FIREBASE_WEBHOOK_SECRET=your-secret,GCP_PROJECT_ID=your-project-id"
```

### 5. Deploy Firestore Indexes

```bash
cd apps/webapp

# Deploy indexes
firebase deploy --only firestore:indexes

# This deploys the indexes defined in firestore.indexes.json
```

**Verify indexes**:
```bash
firebase firestore:indexes
```

Wait for index creation (can take 10-30 minutes for first deployment).

### 6. Deploy Firestore Rules

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Verify rules
firebase firestore:rules
```

### 7. Deploy Frontend

#### Web Application

```bash
cd apps/webapp

# Install dependencies
npm install

# Build
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting:webapp

# Or deploy to Vercel/Netlify/etc.
```

#### Mobile Application

```bash
cd apps/mapp

# Install dependencies
npm install

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Or local builds
npm run ios
npm run android
```

### 8. Configure Report Agent

The report agent is deployed as part of the Cloud Function. Verify it's accessible:

```bash
# Test import
cd gcp/agents/homecare
python -c "from report_agent import report_agent; print('✓ Report agent loaded')"
```

## Post-Deployment Verification

### 1. Test Pub/Sub Topic

```bash
# Publish test message
gcloud pubsub topics publish report-analysis-topic \
  --message='{"reportId":"test","userId":"test","propertyId":"test","reportUri":"gs://test/test.pdf","contentType":"application/pdf"}'

# Check function logs
gcloud functions logs read pubsub-report-analysis --limit=50
```

### 2. Test API Endpoints

```bash
# Health check
curl https://your-api-domain.com/health

# Test analyze endpoint (should return 202)
curl -X POST "https://your-api-domain.com/secret/analyze-report" \
  -H "Content-Type: application/json" \
  -d '{"reportUri":"gs://test/report.pdf","contentType":"application/pdf","reportId":"test","userId":"test","propertyId":"test"}'
```

### 3. Test Frontend Upload

1. Open web app
2. Navigate to a property
3. Go to Reports tab
4. Upload a test PDF
5. Verify:
   - File uploads to Firebase Storage
   - Firestore document created
   - Status changes: uploading → analyzing → complete
   - Analysis results appear in UI

### 4. Test Chat Functionality

1. Open analyzed report
2. Click Chat tab
3. Ask: "What are the critical issues?"
4. Verify response appears within 5 seconds

## Monitoring Setup

### 1. Cloud Logging

Create log-based metrics:
```bash
gcloud logging metrics create report_analysis_success \
  --description="Successful report analyses" \
  --log-filter='resource.type="cloud_function"
    resource.labels.function_name="pubsub-report-analysis"
    textPayload=~"Successfully updated report"'

gcloud logging metrics create report_analysis_failure \
  --description="Failed report analyses" \
  --log-filter='resource.type="cloud_function"
    resource.labels.function_name="pubsub-report-analysis"
    severity="ERROR"'
```

### 2. Alerting Policies

Create alerts for:
- High failure rate (> 5%)
- Long processing times (> 120 seconds)
- High costs (> budget threshold)

```bash
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Report Analysis Failures" \
  --condition-display-name="High Failure Rate" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=300s
```

### 3. Cost Monitoring

Set budget alerts:
```bash
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Reports Feature Budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=90
```

## Scaling Configuration

### Cloud Function

```bash
# Update function with scaling config
gcloud functions deploy pubsub-report-analysis \
  --gen2 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=1
```

### Cloud Run API

```bash
# Update service with scaling config
gcloud run services update proxy-api \
  --min-instances=1 \
  --max-instances=20 \
  --concurrency=80
```

### Pub/Sub

Pub/Sub scales automatically. Configure dead letter topic for failed messages:

```bash
# Create dead letter topic
gcloud pubsub topics create report-analysis-dead-letter

# Update subscription with DLQ
gcloud pubsub subscriptions update SUBSCRIPTION_NAME \
  --dead-letter-topic=report-analysis-dead-letter \
  --max-delivery-attempts=5
```

## Backup & Disaster Recovery

### Firestore Backups

Enable automatic backups:
```bash
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=7d
```

### Storage Backups

Enable versioning on Storage bucket:
```bash
gsutil versioning set on gs://your-bucket-name
```

## Security Hardening

### 1. Service Account Permissions

Create dedicated service account:
```bash
gcloud iam service-accounts create report-analyzer \
  --display-name="Report Analysis Service Account"

# Grant minimal required permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:report-analyzer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:report-analyzer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### 2. VPC Service Controls

For production, use VPC Service Controls:
```bash
gcloud access-context-manager perimeters create report-perimeter \
  --title="Report Analysis Perimeter" \
  --resources=projects/PROJECT_NUMBER \
  --restricted-services=aiplatform.googleapis.com,firestore.googleapis.com
```

### 3. Secret Manager

Store sensitive values in Secret Manager:
```bash
# Store webhook secret
echo -n "your-webhook-secret" | gcloud secrets create firebase-webhook-secret \
  --data-file=- \
  --replication-policy="automatic"

# Grant access to Cloud Function
gcloud secrets add-iam-policy-binding firebase-webhook-secret \
  --member="serviceAccount:PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Rollback Procedures

### Cloud Function

```bash
# List revisions
gcloud functions list --gen2

# Roll back to previous revision
gcloud functions deploy pubsub-report-analysis \
  --source=gs://gcf-sources-PROJECT_ID-REGION/previous-version.zip
```

### API (Cloud Run)

```bash
# List revisions
gcloud run revisions list --service=proxy-api

# Roll back to specific revision
gcloud run services update-traffic proxy-api \
  --to-revisions=REVISION_NAME=100
```

### Frontend

```bash
# Firebase Hosting rollback
firebase hosting:rollback

# Or deploy previous version
firebase deploy --only hosting:webapp --version=previous-version
```

## Troubleshooting

### Function Not Triggering

1. Check Pub/Sub subscription exists:
```bash
gcloud pubsub subscriptions list | grep report-analysis
```

2. Verify function has correct trigger:
```bash
gcloud functions describe pubsub-report-analysis --gen2 --region=us-central1
```

3. Check IAM permissions:
```bash
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/pubsub.subscriber"
```

### Analysis Failing

1. Check Cloud Function logs:
```bash
gcloud functions logs read pubsub-report-analysis --limit=100 --region=us-central1
```

2. Test report agent directly:
```bash
cd gcp/agents/homecare
python -c "
from report_agent.tools import analyze_report_pdf
result = analyze_report_pdf('gs://test/sample.pdf', 'application/pdf', 'full')
print(result)
"
```

3. Verify Vertex AI quota:
```bash
gcloud services list --enabled | grep aiplatform
gcloud alpha quotas describe aiplatform.googleapis.com
```

### High Costs

1. Check usage:
```bash
gcloud billing accounts list
gcloud alpha billing accounts get-pricing-info BILLING_ACCOUNT_ID
```

2. Review API calls:
```bash
gcloud logging read "resource.type=ai_platform_api" --limit=100
```

3. Optimize:
   - Use Gemini Flash instead of Pro
   - Reduce max_output_tokens
   - Cache analysis results
   - Add rate limiting

## Maintenance

### Regular Tasks

**Weekly**:
- Review error logs
- Check analysis success rate
- Monitor costs

**Monthly**:
- Review and archive old reports
- Update dependencies
- Performance optimization

**Quarterly**:
- Security audit
- Cost optimization review
- Capacity planning

### Updates

```bash
# Update Cloud Function
cd gcp/proxy/workers/function/report_analysis
gcloud functions deploy pubsub-report-analysis --gen2

# Update API
cd gcp/proxy/api
gcloud run deploy proxy-api

# Update frontend
cd apps/webapp
firebase deploy --only hosting
```

## Support Contacts

- **GCP Issues**: Google Cloud Support
- **Firebase Issues**: Firebase Support  
- **Application Issues**: Development team
- **Security Issues**: Security team (priority escalation)

