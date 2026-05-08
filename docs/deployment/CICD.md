# CI/CD Pipeline Documentation

This guide covers the Continuous Integration and Continuous Deployment (CI/CD) pipelines for HomeApp.

## Overview

HomeApp uses GitHub Actions for automated CI/CD workflows with:
- Automated deployments on code changes
- Manual deployment triggers for production
- Environment-specific configurations
- Workload Identity Federation for secure authentication
- Multi-environment support (staging/production)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  GitHub Repository                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         GitHub Actions Workflows               │    │
│  │                                                 │    │
│  │  - deploy-webapp-apphosting.yaml               │    │
│  │  - deploy-mapp-build.yaml                      │    │
│  │  - deploy-mapp-update.yaml                     │    │
│  │  - deploy-homecare-agent.yaml                  │    │
│  │  - deploy-homecare-agent-proxy.yaml            │    │
│  │  - deploy-checkpoint-analysis.yaml             │    │
│  │  - deploy-checkpoint-metrics.yaml              │    │
│  │  - deploy-pubsub-user-docs.yaml                │    │
│  └────────────────────────────────────────────────┘    │
│                          │                              │
│                          │ Workload Identity            │
│                          │ Federation                   │
│                          ▼                              │
└──────────────────────────┼──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Google Cloud Platform                       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Firebase    │  │  Cloud Run   │  │  Cloud       │ │
│  │  App Hosting │  │  Services    │  │  Functions   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Vertex AI   │  │  Pub/Sub     │  │  Firestore   │ │
│  │  Agent       │  │  Topics      │  │  Database    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Workflows

### 1. Web Application Deployment

**File**: `.github/workflows/deploy-webapp-apphosting.yaml`

**Triggers**:
- Push to `main` branch (paths: `apps/webapp/**`, `apps/common/**`)
- Manual `workflow_dispatch` with environment selection

**Environments**: staging (auto), prod (manual)

**Steps**:
1. Set environment variables
2. Validate GitHub variables
3. Checkout code
4. Authenticate with GCP (Workload Identity)
5. Setup Cloud SDK and Node.js
6. Install Firebase CLI
7. Deploy Firestore rules and indexes
8. Deploy Storage rules
9. Create App Hosting rollout
10. Generate deployment summary

**Required Variables**:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `WORKLOAD_IDENTITY_PROVIDER`
- `FIREBASE_SERVICE_ACCOUNT_EMAIL`
- `GCP_SERVICE_ACCOUNT_EMAIL`

**Configuration Files**:
- `apphosting.yaml` - Base configuration
- `apphosting.staging.yaml` - Staging overrides
- `apphosting.prod.yaml` - Production overrides

### 2. Mobile Application Build

**File**: `.github/workflows/deploy-mapp-build.yaml`

**Triggers**:
- Manual `workflow_dispatch` with platform and profile selection

**Environments**: staging, prod

**Steps**:
1. Checkout code
2. Setup Node.js
3. Install EAS CLI
4. Authenticate with Expo
5. Install dependencies
6. Build for selected platform(s)
7. Generate build summary

**Required Secrets**:
- `EXPO_TOKEN`

**Required Variables**:
- `EXPO_PROJECT_ID`

**Build Profiles**:
- `development` - Development builds with dev client
- `staging` - Internal testing builds
- `prod` - Production store builds

### 3. Mobile Application OTA Update

**File**: `.github/workflows/deploy-mapp-update.yaml`

**Triggers**:
- Manual `workflow_dispatch` with channel and message

**Environments**: staging, prod

**Steps**:
1. Checkout code
2. Setup Node.js
3. Install EAS CLI
4. Authenticate with Expo
5. Install dependencies
6. Publish OTA update to channel
7. Generate update summary

**Update Channels**:
- `development` - Development builds
- `staging` - Staging builds
- `prod` - Production builds

### 4. AI Agent Deployment

**File**: `.github/workflows/deploy-homecare-agent.yaml`

**Triggers**:
- Push to `main` branch (paths: `gcp/agents/homecare/**`)
- Manual `workflow_dispatch` with environment and action

**Environments**: staging (auto), prod (manual)

**Steps**:
1. Validate GitHub variables and secrets
2. Checkout code
3. Setup Python
4. Set environment variables
5. Authenticate with GCP (Workload Identity)
6. Install UV and dependencies
7. Run deployment script (create/update)
8. Output Reasoning Engine ID

**Required Variables**:
- `GCP_PROJECT_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_REGION`
- `PYTHON_VERSION`
- `AGENT_STAGING_BUCKET`
- `REASONING_ENGINE_ID`
- `GCS_BUCKET`
- `USER_UPLOAD_FOLDER`
- `USER_UPLOAD_RAG_CORPUS`
- `KNOWLEDGE_BASE_RAG_CORPUS`
- `USER_UPLOAD_TOPIC`
- ``
- `WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`

**Required Secrets**:
- `SERP_API_KEY`
- ``

### 5. Proxy API Deployment

**File**: `.github/workflows/deploy-homecare-agent-proxy.yaml`

**Triggers**:
- Push to `main` branch (paths: `gcp/proxy/api/**`)
- Manual `workflow_dispatch` with environment selection

**Environments**: staging (auto), prod (manual)

**Steps**:
1. Validate GitHub variables and secrets
2. Checkout code
3. Authenticate with GCP (Workload Identity)
4. Setup Cloud SDK
5. Deploy to Cloud Run
6. Set IAM policy for public access
7. Output service URL

**Required Variables**:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `REASONING_ENGINE_ID`
- `USER_UPLOAD_TOPIC`
- `USER_UPLOAD_RESULT_SUBSCRIPTION`
- `GCS_BUCKET`
- `CHECKPOINT_ANALYSIS_TOPIC`
- `CHECKPOINT_METRICS_TOPIC`

**Required Secrets**:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `FIREBASE_WEBHOOK_SECRET`

### 6. Worker Functions Deployment

#### Checkpoint Analysis Function

**File**: `.github/workflows/deploy-checkpoint-analysis.yaml`

**Triggers**:
- Push to `main` branch (paths: `gcp/proxy/workers/function/checkpoint_analysis/**`)
- Manual `workflow_dispatch` with environment selection

**Steps**:
1. Validate GitHub variables
2. Checkout code
3. Authenticate with GCP
4. Sync shared modules (observability)
5. Deploy Cloud Function
6. Output function details

#### Checkpoint Metrics Function

**File**: `.github/workflows/deploy-checkpoint-metrics.yaml`

**Triggers**:
- Push to `main` branch (paths: `gcp/proxy/workers/function/checkpoint_metrics/**`)
- Manual `workflow_dispatch` with environment selection

**Steps**: Similar to Checkpoint Analysis

#### User Document Upload Function

**File**: `.github/workflows/deploy-pubsub-user-docs.yaml`

**Triggers**:
- Push to `main` branch (paths: `gcp/proxy/workers/function/user_docs/**`)
- Manual `workflow_dispatch` with environment selection

**Steps**: Similar to Checkpoint Analysis

## Authentication

### Workload Identity Federation

HomeApp uses Workload Identity Federation for secure, keyless authentication from GitHub Actions to GCP.

**Benefits**:
- No service account keys to manage
- Automatic credential rotation
- Better security posture
- Audit trail in Cloud Logging

**Setup**:

1. **Create Workload Identity Pool**:
```bash
gcloud iam workload-identity-pools create github-actions-pool \
  --project=PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"
```

2. **Create Workload Identity Provider**:
```bash
gcloud iam workload-identity-pools providers create-oidc github-actions-provider \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --display-name="GitHub Actions Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

3. **Grant Service Account Access**:
```bash
gcloud iam service-accounts add-iam-policy-binding \
  githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com \
  --project=PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/YOUR_GITHUB_ORG/HomeApp"
```

4. **Get Workload Identity Provider Name**:
```bash
gcloud iam workload-identity-pools providers describe github-actions-provider \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --format="value(name)"
```

5. **Set GitHub Variable**:
Set `WORKLOAD_IDENTITY_PROVIDER` to the full provider name from step 4.

**Usage in Workflows**:
```yaml
- name: Google Auth
  id: auth
  uses: "google-github-actions/auth@v2"
  with:
    workload_identity_provider: "${{ vars.WORKLOAD_IDENTITY_PROVIDER }}"
    service_account: "${{ vars.GCP_SERVICE_ACCOUNT_EMAIL }}"
```

## GitHub Configuration

### Required Secrets

Set these in GitHub repository → Settings → Secrets and variables → Actions → Secrets:

- `EXPO_TOKEN` - Expo authentication token
- `TELEGRAM_BOT_TOKEN` - Telegram bot API token
- `TELEGRAM_WEBHOOK_SECRET` - Telegram webhook secret
- `FIREBASE_WEBHOOK_SECRET` - Firebase webhook secret
- `SERP_API_KEY` - SerpAPI key for search
- `` - SerpAPI key

**Getting Secrets**:

```bash
# Expo token
eas login
eas whoami --json | jq -r '.token'

# Generate webhook secrets
openssl rand -hex 32
```

### Required Variables

Set these in GitHub repository → Settings → Secrets and variables → Actions → Variables:

**GCP Configuration**:
- `GCP_PROJECT_ID` - Google Cloud project ID
- `GCP_PROJECT_NUMBER` - Google Cloud project number
- `GCP_REGION` - Deployment region (us-central1)
- `WORKLOAD_IDENTITY_PROVIDER` - Full workload identity provider name
- `GCP_SERVICE_ACCOUNT_EMAIL` - Service account email
- `FIREBASE_SERVICE_ACCOUNT_EMAIL` - Firebase service account email

**Agent Configuration**:
- `PYTHON_VERSION` - Python version (3.9)
- `AGENT_STAGING_BUCKET` - GCS bucket for agent staging
- `REASONING_ENGINE_ID` - Vertex AI Reasoning Engine ID
- `KNOWLEDGE_BASE_RAG_CORPUS` - RAG corpus for knowledge base
- `USER_UPLOAD_RAG_CORPUS` - RAG corpus for user uploads

**Storage and Messaging**:
- `GCS_BUCKET` - Cloud Storage bucket name
- `USER_UPLOAD_FOLDER` - Folder for user uploads
- `USER_UPLOAD_TOPIC` - Pub/Sub topic for uploads
- `USER_UPLOAD_RESULT_SUBSCRIPTION` - Pub/Sub subscription for results
- `CHECKPOINT_ANALYSIS_TOPIC` - Pub/Sub topic for checkpoint analysis
- `CHECKPOINT_METRICS_TOPIC` - Pub/Sub topic for metrics

**External APIs**:
- `` - SerpAPI endpoint
- `EXPO_PROJECT_ID` - Expo project ID

### Environment Configuration

GitHub Actions supports environment-specific configurations:

**Staging Environment**:
- Auto-deploys on push to `main`
- No approval required
- Lower resource limits
- Scale to zero enabled

**Production Environment**:
- Manual deployment only
- Approval required (optional)
- Higher resource limits
- Always-on instances

**Configure Environments**:
1. Go to GitHub repository → Settings → Environments
2. Create `staging` and `prod` environments
3. Configure protection rules for `prod`:
   - Required reviewers
   - Wait timer
   - Deployment branches (main only)

## Deployment Workflows

### Automated Staging Deployment

```
Developer → Push to main → GitHub Actions → Auto-deploy to staging
```

**Process**:
1. Developer pushes code to `main` branch
2. GitHub Actions detects changes in specific paths
3. Workflow runs automatically
4. Deploys to staging environment
5. Notification sent (if configured)

**Monitoring**:
- View workflow runs in GitHub Actions tab
- Check deployment logs
- Verify in GCP Console

### Manual Production Deployment

```
Developer → Trigger workflow → Select prod → Approve → Deploy to production
```

**Process**:
1. Navigate to GitHub → Actions
2. Select appropriate workflow
3. Click "Run workflow"
4. Select `prod` environment
5. Click "Run workflow" button
6. (Optional) Approval from designated reviewers
7. Workflow deploys to production
8. Notification sent (if configured)

### Rollback Procedure

```
Developer → Trigger workflow → Select previous version → Deploy
```

**For Web Application**:
1. Go to Firebase Console
2. View rollout history
3. Create new rollout from previous version

**For Cloud Run Services**:
1. List revisions: `gcloud run revisions list`
2. Route traffic to previous revision
3. Or redeploy from previous commit

**For Mobile Apps**:
1. Publish OTA update with previous code
2. Or submit new build with previous version

## Monitoring and Notifications

### Workflow Status

**View in GitHub**:
- Navigate to repository → Actions
- View workflow runs
- Check logs for each step
- Download artifacts (if any)

**Status Badge**:
Add to README.md:
```markdown
![Deploy Status](https://github.com/YOUR_ORG/HomeApp/actions/workflows/deploy-webapp-apphosting.yaml/badge.svg)
```

### Deployment Notifications

**GitHub Notifications**:
- Email notifications for workflow failures
- Slack integration (if configured)
- Discord webhooks (if configured)

**Setup Slack Notifications**:
```yaml
- name: Notify Slack
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "Deployment failed: ${{ github.workflow }}"
      }
```

### Cloud Logging

All deployments are logged in GCP Cloud Logging:

```bash
# View deployment logs
gcloud logging read "resource.type=cloud_run_revision" \
  --limit 50 \
  --format json

# View function deployment logs
gcloud logging read "resource.type=cloud_function" \
  --limit 50 \
  --format json
```

## Troubleshooting

### Workflow Failures

#### Authentication Errors

**Error**: `Failed to authenticate with GCP`

**Solution**:
1. Verify Workload Identity Federation is configured
2. Check service account has required permissions
3. Verify GitHub variables are set correctly
4. Check provider attribute mappings

```bash
# Test authentication
gcloud auth list
gcloud projects get-iam-policy PROJECT_ID
```

#### Permission Errors

**Error**: `Permission denied` or `403 Forbidden`

**Solution**:
1. Check service account has required roles
2. Verify IAM policy bindings
3. Grant missing permissions

```bash
# List service account roles
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:githubworkflowdeployment@*"

# Grant missing role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/REQUIRED_ROLE"
```

#### Missing Variables

**Error**: `Missing required GitHub variables`

**Solution**:
1. Check workflow validation step output
2. Add missing variables in GitHub settings
3. Verify variable names match exactly

#### Build Failures

**Error**: Build fails during compilation

**Solution**:
1. Check build logs in GitHub Actions
2. Test build locally
3. Verify dependencies are up to date
4. Check for TypeScript/linting errors

### Deployment Timeouts

**Error**: Workflow times out

**Solution**:
1. Increase workflow timeout:
```yaml
jobs:
  deploy:
    timeout-minutes: 30  # Default is 360
```

2. Optimize build process
3. Check for hanging processes

### Rollback Issues

**Problem**: Rollback doesn't work as expected

**Solution**:
1. Verify previous version is available
2. Check revision/rollout history
3. Manually deploy known good version
4. Review logs for errors

## Best Practices

### 1. Branch Strategy
- Use `main` branch for production-ready code
- Create feature branches for development
- Use pull requests for code review
- Protect `main` branch with required reviews

### 2. Testing
- Run tests locally before pushing
- Use pre-commit hooks for linting
- Test in staging before production
- Implement automated tests in CI

### 3. Secrets Management
- Never commit secrets to repository
- Rotate secrets regularly
- Use Secret Manager for sensitive values
- Audit secret access regularly

### 4. Monitoring
- Monitor workflow runs regularly
- Set up failure notifications
- Review deployment logs
- Track deployment frequency and success rate

### 5. Documentation
- Document deployment procedures
- Keep runbooks up to date
- Document rollback procedures
- Maintain changelog

### 6. Security
- Use Workload Identity Federation
- Follow principle of least privilege
- Enable branch protection
- Require code reviews
- Use environment-specific secrets

## Performance Optimization

### 1. Caching
```yaml
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### 2. Parallel Jobs
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    # ...
  deploy:
    needs: test  # Run after test
    runs-on: ubuntu-latest
    # ...
```

### 3. Conditional Execution
```yaml
- name: Deploy
  if: github.ref == 'refs/heads/main'
  # ...
```

## Related Documentation

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Web Application Deployment](./WEBAPP_DEPLOYMENT.md)
- [Mobile Application Deployment](./MOBILE_DEPLOYMENT.md)
- [Agent Deployment](./AGENT_DEPLOYMENT.md)
- [Proxy Deployment](./PROXY_DEPLOYMENT.md)
- [Worker Functions Deployment](./WORKERS_DEPLOYMENT.md)

