# Firebase App Hosting Configuration

This project uses Firebase App Hosting with separate configurations for different environments.

## Configuration Files

- `apphosting.yaml` - Default/Development environment
- `apphosting.staging.yaml` - Staging environment
- `apphosting.prod.yaml` - Production environment

## Setup

### Prerequisites

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

### Creating Backends

#### Staging Backend

```bash
cd apps/webapp
firebase apphosting:backends:create \
  --project YOUR_PROJECT_ID \
  --location us-central1 \
  --config apphosting.staging.yaml
```

#### Production Backend

```bash
cd apps/webapp
firebase apphosting:backends:create \
  --project YOUR_PROJECT_ID \
  --location us-central1 \
  --config apphosting.prod.yaml
```

## Deployment

### Deploying to Staging

```bash
cd apps/webapp
firebase apphosting:rollouts:create BACKEND_ID \
  --project YOUR_PROJECT_ID \
  --config apphosting.staging.yaml
```

### Deploying to Production

```bash
cd apps/webapp
firebase apphosting:rollouts:create BACKEND_ID \
  --project YOUR_PROJECT_ID \
  --config apphosting.prod.yaml
```

## Environment Variables

Each environment has its own configuration:

### Staging
- Uses staging-specific Cloud Run URLs (with `-staging` suffix)
- Lower `maxInstances` (2) for cost control
- `NEXT_PUBLIC_ENV=staging`

### Production
- Uses production Cloud Run URLs
- Higher `maxInstances` (10) for scalability
- Minimum 1 instance always running
- `NEXT_PUBLIC_ENV=production`

## Secret Management

**Note:** The webapp no longer requires `GEMINI_API_KEY` as all AI features now use the backend API which authenticates via GCP service accounts.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Staging
on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - name: Deploy to App Hosting
        run: |
          cd apps/webapp
          firebase apphosting:rollouts:create staging-backend \
            --project ${{ secrets.FIREBASE_PROJECT_ID }} \
            --config apphosting.staging.yaml
```

## Monitoring

View your backends:
```bash
firebase apphosting:backends:list --project YOUR_PROJECT_ID
```

View rollouts for a backend:
```bash
firebase apphosting:rollouts:list BACKEND_ID --project YOUR_PROJECT_ID
```

## Troubleshooting

### Backend Not Found
Make sure you've created the backend first using `apphosting:backends:create`.

### Secret Not Found
Ensure secrets are created in the same GCP project and the App Hosting service account has access.

### Build Failures
Check the `GOOGLE_BUILDABLE` variable points to the correct monorepo path: `apps/webapp`
