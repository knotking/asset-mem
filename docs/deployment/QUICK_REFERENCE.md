# Deployment Quick Reference

Quick commands and procedures for common deployment tasks.

## Quick Links

- [Full Documentation](./README.md)
- [Launch Plan Progress](./LAUNCH_PLAN_PROGRESS.md)
- [Product Hunt Launch](./PRODUCT_HUNT_LAUNCH.md)
- [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md)
- [Web App](./WEBAPP_DEPLOYMENT.md)
- [Mobile App](./MOBILE_DEPLOYMENT.md)
- [AI Agent](./AGENT_DEPLOYMENT.md)
- [Proxy API](./PROXY_DEPLOYMENT.md)
- [Workers](./WORKERS_DEPLOYMENT.md)
- [CI/CD](./CICD.md)
- [Environments](./ENVIRONMENTS.md)
- [Infrastructure](./INFRASTRUCTURE.md)

## Common Deployment Commands

### Web Application

```bash
# Deploy to staging (automatic on push to main)
git push origin main

# Deploy to production (manual)
# Go to GitHub Actions → Deploy Webapp → Run workflow → Select prod

# Local deployment
cd apps/webapp
./deploy-apphosting.sh

# Manual CLI
firebase apphosting:rollouts:create staging --project homegeekdemo
```

### Mobile Application

```bash
# Build for app stores
cd apps/mapp
./deploy.sh build --platform all --profile prod

# Publish OTA update
./deploy.sh update --channel prod --message "Bug fixes"

# Submit to stores
./deploy.sh submit --platform all
```

### AI Agent

```bash
# Deploy/update agent
cd gcp/agents/homecare
uv run python deployment/deploy.py update staging

# Test deployed agent
uv run python deployment/run.py
```

### Proxy API

```bash
# Deploy to staging
cd gcp/proxy/api
gcloud run deploy homecare-agent-proxy-staging \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Worker Functions

```bash
# Deploy checkpoint analysis function
cd gcp/proxy/workers/function/checkpoint_analysis
gcloud functions deploy pubsub-checkpoint-analysis-staging \
  --gen2 \
  --runtime python313 \
  --region us-central1 \
  --entry-point pubsub_checkpoint_analysis \
  --trigger-topic checkpoint-analysis-topic
```

## Monitoring Commands

### View Logs

```bash
# Web app logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=staging" --limit 50

# Proxy API logs
gcloud run services logs tail homecare-agent-proxy-staging --region us-central1

# Function logs
gcloud functions logs read pubsub-checkpoint-analysis-staging --region us-central1 --gen2 --limit 50

# Firestore operations
gcloud logging read "resource.type=datastore_database" --limit 50
```

### Check Service Status

```bash
# Web app rollouts
firebase apphosting:rollouts:list staging --project homegeekdemo

# Cloud Run services
gcloud run services list --region us-central1

# Cloud Functions
gcloud functions list --region us-central1

# Pub/Sub topics
gcloud pubsub topics list
```

### Monitor Metrics

```bash
# Cloud Run metrics
gcloud run services describe homecare-agent-proxy-staging --region us-central1

# Function metrics
gcloud functions describe pubsub-checkpoint-analysis-staging --region us-central1 --gen2

# View in Cloud Console
# https://console.cloud.google.com/monitoring
```

## Rollback Procedures

### Web Application

```bash
# List rollouts
firebase apphosting:rollouts:list staging --project homegeekdemo

# Rollback to previous
firebase apphosting:rollouts:create staging \
  --project homegeekdemo \
  --rollout-id PREVIOUS_ROLLOUT_ID
```

### Cloud Run Services

```bash
# List revisions
gcloud run revisions list --service homecare-agent-proxy-staging --region us-central1

# Route traffic to previous revision
gcloud run services update-traffic homecare-agent-proxy-staging \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION=100
```

### Mobile App

```bash
# Rollback OTA update
cd apps/mapp
eas update:rollback --channel prod
```

## Troubleshooting Commands

### Check Authentication

```bash
# GCP authentication
gcloud auth list
gcloud config get-value project

# Firebase authentication
firebase login:list
firebase projects:list

# Expo authentication
eas whoami
```

### Verify Permissions

```bash
# Check service account permissions
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:githubworkflowdeployment@*"

# Check API enablement
gcloud services list --enabled
```

### Debug Deployments

```bash
# Check Cloud Build logs
gcloud builds list --limit 5
gcloud builds log BUILD_ID

# Check deployment errors
gcloud logging read "severity>=ERROR" --limit 50

# Test endpoints
curl https://homecare-agent-proxy-staging-*.run.app/health
```

## Environment URLs

### Staging
- **Web App**: https://staging--homegeekdemo.us-central1.hosted.app
- **Proxy API**: https://homecare-agent-proxy-staging-321433914812.us-central1.run.app

### Production
- **Web App**: https://prod--homegeek-prod.us-central1.hosted.app
- **Proxy API**: https://homecare-agent-proxy-prod-686746113874.us-central1.run.app

## GitHub Actions Workflows

### Trigger Manual Deployment

1. Go to: https://github.com/YOUR_ORG/HomeApp/actions
2. Select workflow
3. Click "Run workflow"
4. Select environment and options
5. Click "Run workflow" button

### View Workflow Status

```bash
# Using GitHub CLI (if installed)
gh workflow list
gh run list --workflow=deploy-webapp-apphosting.yaml
gh run view RUN_ID
```

## Emergency Contacts

### GCP Console Links
- **Cloud Run**: https://console.cloud.google.com/run
- **Cloud Functions**: https://console.cloud.google.com/functions
- **Logs**: https://console.cloud.google.com/logs
- **Monitoring**: https://console.cloud.google.com/monitoring
- **IAM**: https://console.cloud.google.com/iam-admin

### Firebase Console Links
- **App Hosting**: https://console.firebase.google.com/project/homegeekdemo/apphosting
- **Firestore**: https://console.firebase.google.com/project/homegeekdemo/firestore
- **Storage**: https://console.firebase.google.com/project/homegeekdemo/storage

## Common Issues and Quick Fixes

### Build Failures

```bash
# Clear cache and rebuild
cd apps/webapp
rm -rf node_modules .next
npm install
npm run build
```

### Permission Errors

```bash
# Grant required role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/REQUIRED_ROLE"
```

### Service Not Responding

```bash
# Check service status
gcloud run services describe SERVICE_NAME --region us-central1

# View recent logs
gcloud run services logs tail SERVICE_NAME --region us-central1

# Restart service (redeploy)
gcloud run services update SERVICE_NAME --region us-central1
```

### Secrets Not Found

```bash
# List secrets
gcloud secrets list

# Create missing secret
echo -n "secret-value" | gcloud secrets create secret-name --data-file=-

# Grant access
gcloud secrets add-iam-policy-binding secret-name \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
# GCP shortcuts
alias gcp-staging='gcloud config set project homegeekdemo'
alias gcp-logs='gcloud logging read --limit 50'
alias gcp-services='gcloud run services list --region us-central1'

# Firebase shortcuts
alias fb-staging='firebase use homegeekdemo'
alias fb-deploy='firebase apphosting:rollouts:create staging --project homegeekdemo'
alias fb-logs='firebase apphosting:rollouts:list staging --project homegeekdemo'

# Deployment shortcuts
alias deploy-webapp='cd ~/repos/HomeApp/apps/webapp && ./deploy-apphosting.sh'
alias deploy-mapp='cd ~/repos/HomeApp/apps/mapp && ./deploy.sh'
```

## Pre-Deployment Checklist

- [ ] Code reviewed and approved
- [ ] Tests passing locally
- [ ] Environment variables configured
- [ ] Dependencies updated
- [ ] Documentation updated
- [ ] Tested in staging (for prod deployments)
- [ ] Stakeholders notified
- [ ] Rollback plan ready

## Post-Deployment Checklist

- [ ] Smoke tests passed
- [ ] Monitoring shows no errors
- [ ] Performance metrics normal
- [ ] Critical paths tested
- [ ] Users notified (if applicable)
- [ ] Documentation updated
- [ ] Team notified

## Support

For detailed information, see the full documentation:
- [Main README](./README.md)
- Component-specific guides
- [CI/CD Documentation](./CICD.md)
- [Infrastructure Setup](./INFRASTRUCTURE.md)

