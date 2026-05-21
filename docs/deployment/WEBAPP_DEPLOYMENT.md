# Web Application Deployment

This guide covers deploying the Next.js web application to Firebase App Hosting.

## Overview

The web application is a Next.js 14+ application with:

- Server-Side Rendering (SSR)
- API Routes
- Image Optimization
- Firebase Authentication integration
- Real-time Firestore updates

**Deployment Platform**: Firebase App Hosting  
**Technology**: Next.js 14+, React 18, TypeScript  
**Location**: `apps/webapp/`

## Environments

### Staging

- **URL**: https://staging--homegeek-staging.us-central1.hosted.app
- **Backend ID**: `staging`
- **Config**: `apphosting.staging.yaml`
- **Auto-Deploy**: Yes (on push to `main`)

### Production

- **URL**: https://prod--homegeek-prod.us-central1.hosted.app
- **Backend ID**: `prod`
- **Config**: `apphosting.prod.yaml`
- **Auto-Deploy**: Manual trigger only

## Prerequisites

### Required Tools

```bash
# Install Firebase CLI
npm install -g firebase-tools@latest

# Install Node.js 20+
# Download from https://nodejs.org/

# Verify installations
firebase --version  # Should be 13.0.0 or higher
node --version      # Should be 20.0.0 or higher
```

### Authentication

```bash
# Login to Firebase
firebase login

# Set project
firebase use homegeekdemo
```

### Required Permissions

Your account or service account needs:

- `Firebase App Hosting Admin`
- `Cloud Run Admin`
- `Service Account User`
- `Storage Object Admin`

## Configuration Files

### apphosting.yaml (Base Configuration)

Location: `apps/webapp/apphosting.yaml`

```yaml
env:
  - variable: NEXT_PUBLIC_API_BASE_URL
    value: https://homecare-agent-proxy-321433914812.us-central1.run.app/...
    availability:
      - BUILD
      - RUNTIME
  - variable: GOOGLE_BUILDABLE
    value: apps/webapp
    availability:
      - BUILD
  - variable: NEXT_PUBLIC_ENV
    value: dev
    availability:
      - BUILD
      - RUNTIME

runConfig:
  maxInstances: 1
```

### apphosting.staging.yaml (Staging Override)

```yaml
env:
  - variable: NEXT_PUBLIC_API_BASE_URL
    value: https://homecare-agent-proxy-staging-321433914812.us-central1.run.app/...
  - variable: NEXT_PUBLIC_ENV
    value: staging

runConfig:
  maxInstances: 1
  minInstances: 0
```

### apphosting.prod.yaml (Production Override)

```yaml
env:
  - variable: NEXT_PUBLIC_API_BASE_URL
    value: https://homecare-agent-proxy-prod-686746113874.us-central1.run.app/...
  - variable: NEXT_PUBLIC_ENV
    value: prod

runConfig:
  maxInstances: 1
  minInstances: 0
```

### Marketing & analytics environment variables

Used for Open Graph URLs, contact/legal pages, and GA4 (Product Hunt / launch). Defined in `apphosting.*.yaml` and [`apps/webapp/.env.example`](../../apps/webapp/.env.example). Tracked in [LAUNCH_PLAN_PROGRESS.md](./LAUNCH_PLAN_PROGRESS.md).

| Variable                        | Staging (example)       | Production (example)  | Notes                                                |
| ------------------------------- | ----------------------- | --------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | Staging App Hosting URL | `https://homegeek.ai` | Canonical origin for OG metadata (no trailing slash) |
| `NEXT_PUBLIC_SUPPORT_EMAIL`     | `support@homegeek.ai`   | `support@homegeek.ai` | Landing contact + legal pages                        |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional                | **Add before PH**     | GA4 `G-XXXXXXXX`; omit = analytics disabled          |

**Before Product Hunt:** Complete the checklist in [PRODUCT_HUNT_LAUNCH.md §2.1](./PRODUCT_HUNT_LAUNCH.md#21-environment-variables-production-web).

```yaml
# Example — add to apphosting.prod.yaml when GA4 property exists:
- variable: NEXT_PUBLIC_GA_MEASUREMENT_ID
  value: G-XXXXXXXXXX
  availability:
    - BUILD
    - RUNTIME
```

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

**Automatic Staging Deployment**:

- Push changes to `main` branch
- GitHub Actions automatically deploys to staging
- Workflow file: `.github/workflows/deploy-webapp-apphosting.yaml`

**Manual Production Deployment**:

1. Go to GitHub repository → Actions
2. Select "Deploy Webapp - AppHosting" workflow
3. Click "Run workflow"
4. Select `prod` environment
5. Click "Run workflow" button

**Workflow Features**:

- Validates all required environment variables
- Deploys Firestore rules and indexes
- Deploys Storage rules
- Creates App Hosting rollout
- Provides deployment summary with URLs

### Method 2: Local Deployment Script

**Script Location**: `apps/webapp/deploy-apphosting.sh`

```bash
cd apps/webapp
./deploy-apphosting.sh
```

**Script Features**:

- Validates Firebase CLI installation
- Checks authentication status
- Installs dependencies if needed
- Creates new rollout for staging backend
- Provides deployment status and URL

**Script Configuration**:
Edit these variables in the script if needed:

```bash
PROJECT_ID="homegeekdemo"
BACKEND_ID="staging"
REGION="us-central1"
```

### Method 3: Firebase Console

1. Navigate to [Firebase Console - App Hosting](https://console.firebase.google.com/project/homegeekdemo/apphosting)
2. Select your backend (`staging` or `prod`)
3. Click "Create rollout" or "Deploy" button
4. Select the branch to deploy from
5. Firebase automatically builds and deploys

**Benefits**:

- No local CLI setup required
- Visual deployment progress monitoring
- Easy rollback to previous versions
- View build logs in real-time

### Method 4: Manual Firebase CLI

```bash
cd apps/webapp

# Deploy to staging
firebase apphosting:rollouts:create staging \
  --project homegeekdemo

# Deploy to production
firebase apphosting:rollouts:create prod \
  --project homegeekdemo

# Deploy from specific branch
firebase apphosting:rollouts:create staging \
  --project homegeekdemo \
  --git-branch feature-branch
```

## Build Process

### Build Steps

1. **Install Dependencies**: `npm install` in monorepo root and webapp
2. **Type Check**: TypeScript compilation check
3. **Build**: Next.js production build (`next build`)
4. **Deploy**: Upload to Cloud Run via Firebase App Hosting

### Build Configuration

**next.config.ts**:

```typescript
const nextConfig = {
  // SSR enabled (no static export)
  output: undefined,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },

  // Monorepo support
  transpilePackages: ["@homeapp/common"],
};
```

**Build Environment Variables**:

- `GOOGLE_BUILDABLE=apps/webapp` - Tells Firebase where to build
- `NEXT_PUBLIC_API_BASE_URL` - Backend API endpoint
- `NEXT_PUBLIC_ENV` - Environment identifier
- `NEXT_PUBLIC_SITE_URL` - Canonical site URL for metadata / Open Graph
- `NEXT_PUBLIC_SUPPORT_EMAIL` - Support email on landing and legal pages
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Optional GA4 measurement ID

## Monitoring Deployments

### Check Rollout Status

```bash
# List all rollouts
firebase apphosting:rollouts:list staging --project homegeekdemo

# Get specific rollout details
firebase apphosting:rollouts:get staging ROLLOUT_ID --project homegeekdemo
```

### View Backend Details

```bash
firebase apphosting:backends:get staging --project homegeekdemo
```

### Check Logs

```bash
# Via gcloud (App Hosting uses Cloud Run)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=staging" \
  --project homegeekdemo \
  --limit 50 \
  --format json

# Or view in Cloud Console
# https://console.cloud.google.com/logs
```

### Monitor in Firebase Console

- Navigate to Firebase Console → App Hosting
- View rollout history
- Check build logs
- Monitor traffic and performance

## Rollback Procedures

### Rollback to Previous Version

```bash
# 1. List recent rollouts to find the previous working version
firebase apphosting:rollouts:list staging --project homegeekdemo

# 2. Note the ROLLOUT_ID of the previous working version

# 3. Create new rollout from previous version
firebase apphosting:rollouts:create staging \
  --project homegeekdemo \
  --rollout-id PREVIOUS_ROLLOUT_ID
```

### Emergency Rollback via Console

1. Go to Firebase Console → App Hosting
2. Select the backend (staging/prod)
3. View rollout history
4. Click on previous working rollout
5. Click "Create new rollout from this version"

## Troubleshooting

### Backend Not Found Error

**Error**: `Backend 'staging' not found`

**Solution**: Create the backend first:

```bash
firebase apphosting:backends:create staging \
  --project homegeekdemo \
  --location us-central1
```

### Build Failures

**Common Causes**:

1. TypeScript errors
2. Missing dependencies
3. Node.js version mismatch
4. Environment variables not set

**Debug Steps**:

```bash
# 1. Check Node.js version
node --version  # Should be 20+

# 2. Clean install dependencies
cd apps/webapp
rm -rf node_modules package-lock.json
npm install

# 3. Run local build
npm run build

# 4. Check for TypeScript errors
npm run typecheck

# 5. Check for linting errors
npm run lint
```

### Deployment Timeouts

**Cause**: App Hosting builds can take 5-10 minutes

**Solutions**:

1. Check build logs in Firebase Console
2. Verify service account permissions
3. Check Cloud Run quota limits
4. Ensure Cloud Build API is enabled

### Environment Variable Issues

**Problem**: Variables not available at runtime

**Check**:

1. Variables are defined in `apphosting.yaml`
2. `availability` includes `RUNTIME` for runtime variables
3. Variables prefixed with `NEXT_PUBLIC_` for client-side access

**Example**:

```yaml
env:
  # Server-side only
  - variable: API_SECRET
    value: secret-value
    availability:
      - RUNTIME

  # Client-side accessible
  - variable: NEXT_PUBLIC_API_URL
    value: https://api.example.com
    availability:
      - BUILD
      - RUNTIME
```

### Firestore Rules Deployment Fails

**Error**: Permission denied deploying Firestore rules

**Solution**:

```bash
# Ensure service account has Firestore Admin role
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/datastore.owner"
```

### Image Optimization Issues

**Problem**: Images not loading or optimizing

**Check**:

1. Remote image patterns configured in `next.config.ts`
2. Image domains are HTTPS
3. Cloud Storage bucket has public read access (if applicable)

## Performance Optimization

### Cold Start Optimization

```yaml
runConfig:
  minInstances: 1 # Keep one instance warm
  maxInstances: 10
```

### Memory and CPU Allocation

```yaml
runConfig:
  cpu: 1
  memory: 512Mi # Adjust based on needs
```

### Caching Strategy

- Next.js automatic static optimization
- Image optimization caching
- API route caching headers
- CDN caching via Firebase

## Security Considerations

### Environment Variables

- Never commit secrets to repository
- Use Secret Manager for sensitive values
- Rotate secrets regularly

### Firestore Rules

- Deploy rules with every deployment
- Test rules in Firebase Console
- Use emulator for local testing

### CORS Configuration

- Configure in API routes
- Whitelist specific origins
- Use credentials carefully

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/deploy-webapp-apphosting.yaml`

**Triggers**:

- Push to `main` → Auto-deploy staging
- Manual workflow_dispatch → Deploy to prod

**Required GitHub Secrets**:
None (uses Workload Identity Federation)

**Required GitHub Variables**:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `WORKLOAD_IDENTITY_PROVIDER`
- `FIREBASE_SERVICE_ACCOUNT_EMAIL`
- `GCP_SERVICE_ACCOUNT_EMAIL`

**Workflow Steps**:

1. Checkout code
2. Authenticate with GCP
3. Install Firebase CLI
4. Deploy Firestore rules and indexes
5. Deploy Storage rules
6. Create App Hosting rollout
7. Generate deployment summary

## Local Development

### Running Locally

```bash
cd apps/webapp

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_ENV=development
```

### Testing Production Build

```bash
# Build
npm run build

# Start production server
npm start
```

## Best Practices

1. **Always test in staging first**
   - Deploy to staging automatically
   - Perform manual testing
   - Validate all features work

2. **Use semantic versioning**
   - Tag releases in Git
   - Document changes in CHANGELOG
   - Reference tags in rollouts

3. **Monitor deployments**
   - Check logs after deployment
   - Verify all pages load correctly
   - Test critical user flows

4. **Maintain rollback capability**
   - Keep previous rollouts available
   - Document known good versions
   - Test rollback procedures

5. **Security**
   - Keep dependencies updated
   - Review Firestore rules regularly
   - Audit IAM permissions

## Related Documentation

- [Firebase App Hosting Configuration](../../apps/webapp/APPHOSTING.md)
- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [CI/CD Pipeline Documentation](./CICD.md)
