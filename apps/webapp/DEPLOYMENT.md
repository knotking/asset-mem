# WebApp Deployment Guide

This guide explains how to deploy the Next.js webapp to Firebase App Hosting.

## Overview

The webapp is deployed to Firebase App Hosting at:
**https://studio--goggle-gab.us-central1.hosted.app**

Firebase App Hosting provides full Next.js support including:

- Server-Side Rendering (SSR)
- API Routes
- Image Optimization
- Incremental Static Regeneration (ISR)

## Deployment Methods

### Method 1: Automated GitHub Actions (Recommended)

The webapp automatically deploys when changes are pushed to the `main` branch.

**Workflow:** `.github/workflows/deploy-webapp.yml`

**Trigger conditions:**

- Push to `main` branch with changes in `apps/webapp/`
- Manual trigger via GitHub Actions UI

**Setup Requirements:**

1. **GitHub Secrets Required:**
   - `GCP_SA_KEY`: Service account key JSON for authentication
   - `FIREBASE_TOKEN`: Firebase CI token (optional, can use GCP_SA_KEY)

2. **Service Account Permissions:**
   The service account needs these IAM roles:
   - `Firebase App Hosting Admin`
   - `Cloud Run Admin`
   - `Service Account User`

3. **Manual Trigger:**
   ```bash
   # Go to GitHub Actions → Deploy WebApp to Firebase App Hosting → Run workflow
   ```

### Method 2: Local Deployment Script

Use the deployment script for local deployments:

```bash
cd apps/webapp
./deploy-apphosting.sh
```

**Prerequisites:**

- Firebase CLI installed: `npm install -g firebase-tools@latest`
- Authenticated: `firebase login`
- Node.js 20+ installed

**Script Features:**

- Validates Firebase CLI installation and version
- Checks authentication status
- Installs dependencies if needed
- Creates new rollout for the backend
- Provides deployment status and URL

### Method 3: Manual Firebase CLI

Deploy directly using Firebase CLI:

```bash
cd apps/webapp

# Set the project
firebase use goggle-gab

# Create a new rollout
firebase apphosting:rollouts:create studio --project goggle-gab
```

## Configuration Files

### apphosting.yaml

Located at `apps/webapp/apphosting.yaml`:

```yaml
runConfig:
  maxInstances: 1
```

This file configures the App Hosting backend runtime settings.

### next.config.ts

The Next.js configuration is optimized for Firebase App Hosting:

- SSR enabled (no static export)
- Image optimization enabled
- Remote image patterns configured

### firebase.json

Minimal configuration for Firestore rules. App Hosting doesn't require hosting configuration in firebase.json.

## Backend Information

- **Project ID:** goggle-gab
- **Backend ID:** studio
- **Region:** us-central1
- **URL:** https://studio--goggle-gab.us-central1.hosted.app

## Monitoring Deployment

### Check Rollout Status

```bash
firebase apphosting:rollouts:list studio --project goggle-gab
```

### View Backend Details

```bash
firebase apphosting:backends:get studio --project goggle-gab
```

### Check Logs

```bash
# Via Google Cloud Console
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=studio" \
  --project goggle-gab \
  --limit 50 \
  --format json
```

## Troubleshooting

### Backend Not Found Error

If you see "Backend 'studio' not found", you need to create it first:

```bash
firebase apphosting:backends:create studio \
  --project goggle-gab \
  --location us-central1
```

### Build Failures

1. Check Node.js version (must be 20+)
2. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
3. Run local build: `npm run build`
4. Check for TypeScript errors: `npm run typecheck`

### Deployment Timeouts

App Hosting builds can take 5-10 minutes. If deployment times out:

1. Check build logs in Firebase Console
2. Verify service account permissions
3. Check Cloud Run quota limits

### Environment Variables

If you need to add environment variables:

1. **Via Firebase Console:**
   - Go to Firebase Console → App Hosting → Backend (studio)
   - Add environment variables in the backend settings

2. **Via apphosting.yaml:**
   ```yaml
   runConfig:
     maxInstances: 1
   env:
     - variable: YOUR_VAR_NAME
       value: your_value
   ```

## Rollback

To rollback to a previous version:

```bash
# List recent rollouts
firebase apphosting:rollouts:list studio --project goggle-gab

# Get specific rollout ID and create new rollout from it
firebase apphosting:rollouts:create studio \
  --project goggle-gab \
  --rollout-id <PREVIOUS_ROLLOUT_ID>
```

## CI/CD Best Practices

1. **Test Before Deploy:** Always run `npm run build` and `npm run typecheck` locally
2. **Branch Protection:** Configure branch protection rules on `main`
3. **Review Deployments:** Use pull requests to review changes before merging
4. **Monitor Logs:** Check Cloud Run logs after deployment
5. **Staged Rollouts:** Consider creating separate backends for staging/production

## Configure GitHub Secrets (if not already done)

For GitHub Actions to work, ensure you have the required secrets:
Go to GitHub repository → Settings → Secrets and variables → Actions
Add FIREBASE_TOKEN or verify GCP_SA_KEY exists
To get Firebase token:
firebase login:ci

## Related Files

- [deploy-apphosting.sh](./deploy-apphosting.sh) - Local deployment script
- [apphosting.yaml](./apphosting.yaml) - App Hosting configuration
- [next.config.ts](./next.config.ts) - Next.js configuration
- [.github/workflows/deploy-webapp.yml](../../.github/workflows/deploy-webapp.yml) - GitHub Actions workflow

## Support

For issues:

1. Check Firebase App Hosting documentation: https://firebase.google.com/docs/app-hosting
2. View Cloud Run logs in Google Cloud Console
3. Check GitHub Actions logs for CI/CD issues
