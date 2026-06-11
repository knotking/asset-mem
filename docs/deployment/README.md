# HomeApp Deployment Documentation

This directory contains comprehensive documentation for deploying all components of the HomeApp project.

## Overview

HomeApp is a full-stack application deployed on Google Cloud Platform (GCP) with the following main components:

1. **Web Application** - Next.js webapp deployed on Firebase App Hosting
2. **Mobile Application** - React Native/Expo app deployed via EAS (Expo Application Services)
3. **AI Agent Engine** - Vertex AI Reasoning Engine for property management intelligence
4. **Proxy API** - FastAPI service on Cloud Run for API orchestration
5. **Worker Functions** - Cloud Functions for async processing
6. **Infrastructure** - GCP resources provisioned via GitHub Actions (`create-environment.yaml`) and `gcloud`

## Quick Links

- [Launch Plan Progress](./LAUNCH_PLAN_PROGRESS.md) — phase status and per-phase operational TODOs (includes [post-GA API Gateway](./LAUNCH_PLAN_PROGRESS.md#phase-4--future-infrastructure-post-ga))
- [Product Hunt Launch Checklist](./PRODUCT_HUNT_LAUNCH.md)
- [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md)
- [Web Application Deployment](./WEBAPP_DEPLOYMENT.md)
- [Mobile Application Deployment](./MOBILE_DEPLOYMENT.md)
- [AI Agent Deployment](./AGENT_DEPLOYMENT.md)
- [Proxy API Deployment](./PROXY_DEPLOYMENT.md)
- [Worker Functions Deployment](./WORKERS_DEPLOYMENT.md)
- [Infrastructure Setup](./INFRASTRUCTURE.md)
- [Operations (DLQ, alerts, runbooks)](./OPERATIONS.md) — scripts in [`.github/scripts/`](../../.github/scripts/)
- [Property Agent Architecture cutover runbook](./runbooks/orchestrator-v2-cutover.md)
- [CI/CD Pipelines](./CICD.md)
- [Environment Configuration](./ENVIRONMENTS.md)

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                        │
│                    (Source Code & CI/CD)                        │
└────────────┬────────────────────────────────┬───────────────────┘
             │                                │
             │ GitHub Actions                 │ GitHub Actions
             │ (Automated Deployment)         │ (Automated Deployment)
             ▼                                ▼
┌────────────────────────┐        ┌──────────────────────────────┐
│  Firebase App Hosting  │        │     Google Cloud Platform    │
│   (Next.js WebApp)     │        │                              │
│                        │        │  ┌────────────────────────┐  │
│  - SSR Support         │        │  │   Cloud Run Services   │  │
│  - Auto-scaling        │        │  │  - Proxy API           │  │
│  - CDN                 │        │  │  - Staging/Prod        │  │
└────────────────────────┘        │  └────────────────────────┘  │
                                  │                              │
┌────────────────────────┐        │  ┌────────────────────────┐  │
│   Expo Application     │        │  │   Cloud Functions      │  │
│   Services (EAS)       │        │  │  - User Doc Upload     │  │
│                        │        │  │  - Checkpoint Analysis │  │
│  - iOS Builds          │        │  │  - Metrics Processing  │  │
│  - Android Builds      │        │  └────────────────────────┘  │
│  - OTA Updates         │        │                              │
└────────────────────────┘        │  ┌────────────────────────┐  │
                                  │  │   Vertex AI            │  │
                                  │  │  - Agent Engine        │  │
                                  │  │  - RAG Corpus          │  │
                                  │  └────────────────────────┘  │
                                  │                              │
                                  │  ┌────────────────────────┐  │
                                  │  │   Supporting Services  │  │
                                  │  │  - Pub/Sub             │  │
                                  │  │  - Cloud Storage       │  │
                                  │  │  - Secret Manager      │  │
                                  │  │  - Firestore           │  │
                                  │  └────────────────────────┘  │
                                  └──────────────────────────────┘
```

## Environments

The project supports three deployment environments:

### Development

- **Purpose**: Local development and testing
- **GCP Project**: `homegeek-staging`
- **Webapp URL**: Local (http://localhost:3000)
- **Proxy URL**: `homecare-agent-proxy-dev-*.run.app`

### Staging

- **Purpose**: Pre-production testing and validation
- **GCP Project**: `homegeek-staging`
- **Webapp URL**: `https://staging--homegeek-staging.us-central1.hosted.app`
- **Proxy URL**: `homecare-agent-proxy-staging-*.run.app`
- **Auto-Deploy**: Triggered on push to `main` branch

### Production

- **Purpose**: Live production environment
- **GCP Project**: `homegeek-staging` (prod resources) / `homegeek-prod`
- **Webapp URL**: `https://prod--homegeek-prod.us-central1.hosted.app`
- **Proxy URL**: `homecare-agent-proxy-prod-*.run.app`
- **Deploy**: Manual trigger via GitHub Actions workflow_dispatch

## Deployment Methods

### 1. Automated CI/CD (Recommended)

All components have GitHub Actions workflows for automated deployment:

- Push to `main` → Auto-deploy to staging
- Manual workflow dispatch → Deploy to production
- See [CI/CD Documentation](./CICD.md) for details

### 2. Local Deployment Scripts

Each component has deployment scripts for local execution:

- `apps/webapp/deploy-apphosting.sh` - Web app deployment
- `apps/mapp/deploy.sh` - Mobile app deployment
- `gcp/agents/homecare/deployment/deploy.py` - Agent deployment
- See individual component docs for usage

### 3. Manual CLI Commands

Direct deployment using GCP CLI tools:

- `gcloud` for Cloud Run and Cloud Functions
- `firebase` for App Hosting
- `eas` for mobile app builds
- See individual component docs for commands

## Prerequisites

### Required Tools

- **Node.js** 20+ (for webapp and mobile app)
- **Python** 3.9+ (for agents and workers)
- **Google Cloud SDK** (gcloud CLI)
- **Firebase CLI** 13+ (for webapp deployment)
- **EAS CLI** (for mobile app deployment)
- **UV** (for Python dependency management)

Infrastructure is provisioned via [Create Environment](../../.github/workflows/create-environment.yaml) and [`.github/workflows/README.md`](../../.github/workflows/README.md).

### GCP Setup

1. **Enable Required APIs**:

   ```bash
   gcloud services enable \
     artifactregistry.googleapis.com \
     cloudbuild.googleapis.com \
     run.googleapis.com \
     aiplatform.googleapis.com \
     pubsub.googleapis.com \
     cloudfunctions.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     storage-api.googleapis.com
   ```

2. **Service Account Configuration**:
   - Create service account: `githubworkflowdeployment@PROJECT_ID.iam.gserviceaccount.com`
   - Assign required roles (see [Infrastructure Setup](./INFRASTRUCTURE.md))

3. **Workload Identity Federation**:
   - Configure for GitHub Actions authentication
   - See [CI/CD Documentation](./CICD.md)

### Authentication

```bash
# GCP Authentication
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Firebase Authentication
firebase login

# Expo/EAS Authentication
eas login
```

## Deployment Workflow

### Standard Deployment Process

1. **Code Changes**
   - Develop features in feature branches
   - Create pull request to `main`
   - Code review and approval

2. **Staging Deployment**
   - Merge to `main` branch
   - GitHub Actions auto-deploys to staging
   - Automated tests run (if configured)
   - Manual testing and validation

3. **Production Deployment**
   - Trigger production deployment via GitHub Actions
   - Select "prod" environment in workflow_dispatch
   - Monitor deployment progress
   - Verify production functionality

### Component-Specific Workflows

#### Web Application

```bash
# Local deployment
cd apps/webapp
./deploy-apphosting.sh

# Or via GitHub Actions
# Push to main → Auto-deploy to staging
# Workflow dispatch → Deploy to prod
```

#### Mobile Application

```bash
# Build for app stores
cd apps/mapp
./deploy.sh build --platform all --profile prod

# OTA update
./deploy.sh update --channel staging --message "Bug fixes"
```

#### AI Agent

```bash
# Deploy agent engine
cd gcp/agents/homecare
uv run python deployment/deploy.py update staging
```

#### Proxy API

```bash
# Deploy via gcloud
cd gcp/proxy/api
gcloud run deploy homecare-agent-proxy-staging \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## Monitoring and Rollback

### Monitoring Deployments

**Firebase App Hosting**:

```bash
firebase apphosting:rollouts:list staging --project homegeek-staging
```

**Cloud Run**:

```bash
gcloud run services describe homecare-agent-proxy-staging --region us-central1
```

**Cloud Functions**:

```bash
gcloud functions describe FUNCTION_NAME --region us-central1
```

### Rollback Procedures

**Web Application**:

```bash
# List rollouts
firebase apphosting:rollouts:list staging --project homegeek-staging

# Create new rollout from previous version
firebase apphosting:rollouts:create staging \
  --project homegeek-staging \
  --rollout-id PREVIOUS_ROLLOUT_ID
```

**Cloud Run Services**:

```bash
# List revisions
gcloud run revisions list --service homecare-agent-proxy-staging

# Route traffic to previous revision
gcloud run services update-traffic homecare-agent-proxy-staging \
  --to-revisions PREVIOUS_REVISION=100
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check GitHub Actions logs
   - Verify all environment variables are set
   - Ensure dependencies are up to date
   - Check for TypeScript/linting errors

2. **Deployment Timeouts**
   - Increase timeout settings in deployment configs
   - Check Cloud Build quotas
   - Verify network connectivity

3. **Permission Errors**
   - Verify service account has required roles
   - Check IAM policy bindings
   - Ensure APIs are enabled

4. **Environment Variable Issues**
   - Verify GitHub secrets are set
   - Check apphosting.yaml configurations
   - Validate .env files for local development

### Getting Help

- Check component-specific documentation
- Review GitHub Actions logs
- Check GCP Cloud Logging
- Review Firebase Console for App Hosting issues

## Security Best Practices

1. **Secrets Management**
   - Use Google Secret Manager for API keys
   - Never commit secrets to repository
   - Rotate secrets regularly

2. **Service Account Permissions**
   - Follow principle of least privilege
   - Use separate service accounts per environment
   - Audit IAM permissions regularly

3. **Network Security**
   - Use webhook secrets for external integrations
   - Implement rate limiting
   - Enable Cloud Armor for DDoS protection (production)

4. **Authentication**
   - Use Workload Identity Federation for GitHub Actions
   - Avoid service account key files when possible
   - Enable audit logging

## Cost Optimization

1. **Auto-scaling Configuration**
   - Set appropriate min/max instances
   - Use scale-to-zero for non-critical services
   - Configure concurrency settings

2. **Resource Allocation**
   - Right-size memory and CPU allocations
   - Use appropriate machine types
   - Enable sustained use discounts

3. **Monitoring**
   - Set up billing alerts
   - Monitor resource utilization
   - Review Cloud Billing reports regularly

## Next Steps

1. Review component-specific deployment guides
2. Set up CI/CD pipelines (if not already configured)
3. Configure monitoring and alerting
4. Establish backup and disaster recovery procedures
5. Document custom deployment procedures for your team

## Additional Resources

- [GCP Documentation](https://cloud.google.com/docs)
- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Expo EAS Documentation](https://docs.expo.dev/eas/)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
