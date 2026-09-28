# Environment Configuration

This guide covers the different deployment environments and their configurations.

## Overview

AssetMem supports three deployment environments:

### Brand vs infrastructure naming

The product is branded **AssetMem AI** (`asset-mem.com`, `hello@asset-mem.com`). GCP and Firebase **project IDs** (`homegeek-staging`, `homegeek-prod`), GCS buckets (`homegeek-user-data`, etc.), and default App Hosting URLs (`staging--homegeek-staging…`) intentionally keep the legacy `homegeek-*` prefix — renaming them would require a full GCP migration. Client code and docs should use AssetMem for user-facing strings only.

- **Development**: Local development and testing
- **Staging**: Pre-production testing and validation
- **Production**: Live production environment

## Environment Comparison

| Aspect            | Development       | Staging                | Production                       |
| ----------------- | ----------------- | ---------------------- | -------------------------------- |
| **Purpose**       | Local development | Pre-production testing | Live users                       |
| **GCP Project**   | homegeek-staging  | homegeek-staging       | homegeek-staging / homegeek-prod |
| **Auto-Deploy**   | No                | Yes (on push to main)  | No (manual only)                 |
| **Min Instances** | 0                 | 0                      | 1                                |
| **Max Instances** | 1                 | 5-10                   | 10-20                            |
| **Scaling**       | Scale to zero     | Scale to zero          | Always-on                        |
| **Monitoring**    | Basic             | Enhanced               | Full monitoring                  |
| **Costs**         | Minimal           | Low                    | Production costs                 |

## Development Environment

### Purpose

- Local development and testing
- Feature development
- Debugging and troubleshooting
- Integration testing

### Configuration

#### Web Application

```bash
# Local development server
cd apps/webapp
npm run dev

# Environment variables (.env.local)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_ENV=development
```

#### Mobile Application

```bash
# Local development
cd apps/mapp
npx expo start

# Environment (eas.json)
{
  "build": {
    "development": {
      "developmentClient": true,
      "channel": "development",
      "env": {
        "APP_ENV": "dev",
        "PROXY_BASE_URL": "https://homecare-agent-proxy-dev-*.run.app"
      }
    }
  }
}
```

#### Backend Services

```bash
# Local proxy API
cd gcp/proxy/api
uvicorn main:app --reload --port 8080

# Environment variables (.env)
GCP_PROJECT_ID=homegeek-staging
GCP_REGION=us-central1
REASONING_ENGINE_ID=dev-engine-id
```

### Access

- **Webapp**: http://localhost:3000
- **Proxy API**: http://localhost:8080
- **Mobile App**: Expo Go app or development build

### Data

- Uses development databases
- Separate Firestore collections (dev prefix)
- Development RAG corpus
- Test user accounts

## Staging Environment

### Purpose

- Pre-production testing
- QA validation
- Integration testing
- Performance testing
- User acceptance testing

### Configuration

#### Web Application

**URL**: https://staging--homegeek-staging.us-central1.hosted.app

**Configuration** (`apphosting.staging.yaml`):

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

#### Mobile Application

**Channel**: staging

**Configuration** (`eas.json`):

```json
{
  "build": {
    "staging": {
      "distribution": "internal",
      "channel": "staging",
      "env": {
        "APP_ENV": "staging",
        "IOS_BUNDLE_ID": "com.assetmem.staging",
        "ANDROID_PACKAGE": "com.assetmem.staging",
        "PROXY_BASE_URL": "https://homecare-agent-proxy-staging-*.run.app"
      }
    }
  }
}
```

#### Backend Services

**Proxy API**:

- Service: `homecare-agent-proxy-staging`
- URL: `https://homecare-agent-proxy-staging-321433914812.us-central1.run.app`
- Min Instances: 0
- Max Instances: 5

**AI Agent**:

- Reasoning Engine: staging engine
- RAG Corpus: staging corpus
- GCS Bucket: `homegeek-user-data` (staging prefix)

**Worker Functions**:

- Functions: `*-staging` suffix
- Pub/Sub Topics: staging topics
- Memory: 512Mi
- Max Instances: 10

### Deployment

- **Trigger**: Automatic on push to `main` branch
- **Method**: GitHub Actions workflows
- **Approval**: Not required
- **Rollback**: Available via Firebase Console or gcloud

### Access Control

- Internal team access
- Test user accounts
- Service account: `githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com`

### Data

- Staging Firestore database
- Staging RAG corpus
- Staging Cloud Storage bucket
- Test data only (no production data)

### Monitoring

- Cloud Logging enabled
- Basic Cloud Monitoring
- Error Reporting enabled
- No alerting (optional)

## Production Environment

### Purpose

- Live production workloads
- Real user traffic
- Production data
- Business-critical operations

### Configuration

#### Web Application

**URL**: https://prod--homegeek-prod.us-central1.hosted.app

**Configuration** (`apphosting.prod.yaml`):

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

#### Mobile Application

**Channel**: prod

**Configuration** (`eas.json`):

```json
{
  "build": {
    "prod": {
      "distribution": "store",
      "autoIncrement": true,
      "channel": "prod",
      "env": {
        "APP_ENV": "prod",
        "IOS_BUNDLE_ID": "com.assetmem.prod",
        "ANDROID_PACKAGE": "com.assetmem.prod",
        "PROXY_BASE_URL": "https://homecare-agent-proxy-prod-*.run.app"
      }
    }
  }
}
```

#### Backend Services

**Proxy API**:

- Service: `homecare-agent-proxy-prod`
- URL: `https://homecare-agent-proxy-prod-686746113874.us-central1.run.app`
- Min Instances: 1 (always warm)
- Max Instances: 10

**AI Agent**:

- Reasoning Engine: production engine
- RAG Corpus: production corpus
- GCS Bucket: `homegeek-user-data` (prod prefix)

**Worker Functions**:

- Functions: `*-prod` suffix
- Pub/Sub Topics: production topics
- Memory: 512Mi-1Gi
- Max Instances: 10-20

### Deployment

- **Trigger**: Manual workflow dispatch only
- **Method**: GitHub Actions workflows
- **Approval**: Required (recommended)
- **Rollback**: Available with documented procedures

### Access Control

- Restricted access
- Production service account
- Audit logging enabled
- MFA required for admin access

### Data

- Production Firestore database
- Production RAG corpus
- Production Cloud Storage bucket
- Real user data (PII protected)

### Monitoring

- Full Cloud Monitoring
- Custom dashboards
- Alerting configured
- Error Reporting with notifications
- Uptime checks
- Performance monitoring

### Security

- Cloud Armor enabled (optional)
- Rate limiting configured
- Webhook secrets rotated regularly
- Service account permissions audited
- Data encryption at rest and in transit

## Environment Variables

### Web Application

| Variable                        | Development           | Staging                 | Production                                                                                             |
| ------------------------------- | --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL`      | http://localhost:8080 | staging proxy URL       | prod proxy URL                                                                                         |
| `NEXT_PUBLIC_ENV`               | development           | staging                 | prod                                                                                                   |
| `NEXT_PUBLIC_SITE_URL`          | (optional local)      | staging App Hosting URL | `https://asset-mem.com`                                                                                  |
| `NEXT_PUBLIC_SUPPORT_EMAIL`     | (optional)            | `support@buildgeek.ai` | `support@buildgeek.ai`                                                                       |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | (optional)            | optional                | add before PH — see [PH launch §2.1](./PRODUCT_HUNT_LAUNCH.md#21-environment-variables-production-web) |
| `GOOGLE_BUILDABLE`              | apps/webapp           | apps/webapp             | apps/webapp                                                                                            |

### Mobile Application

| Variable          | Development        | Staging                | Production          |
| ----------------- | ------------------ | ---------------------- | ------------------- |
| `APP_ENV`         | dev                | staging                | prod                |
| `PROXY_BASE_URL`  | dev proxy URL      | staging proxy URL      | prod proxy URL      |
| `WEB_APP_URL`     | localhost:3000     | staging webapp URL     | prod webapp URL     |
| `IOS_BUNDLE_ID`   | com.assetmem.dev | com.assetmem.staging | com.assetmem.prod |
| `ANDROID_PACKAGE` | com.assetmem.dev | com.assetmem.staging | com.assetmem.prod |

### Backend Services

| Variable              | Development      | Staging            | Production                       |
| --------------------- | ---------------- | ------------------ | -------------------------------- |
| `GCP_PROJECT_ID`      | homegeek-staging | homegeek-staging   | homegeek-staging / homegeek-prod |
| `GCP_REGION`          | us-central1      | us-central1        | us-central1                      |
| `REASONING_ENGINE_ID` | dev-engine-id    | staging-engine-id  | prod-engine-id                   |
| `GCS_BUCKET`          | dev bucket       | homegeek-user-data | homegeek-user-data               |
| `USER_UPLOAD_TOPIC`   | dev-topic        | user-upload-topic  | user-upload-topic                |

## Environment Promotion

### Development → Staging

**Process**:

1. Complete feature development locally
2. Test thoroughly in development
3. Create pull request to `main`
4. Code review and approval
5. Merge to `main`
6. Automatic deployment to staging
7. Validate in staging environment

**Validation**:

- Functional testing
- Integration testing
- Performance testing
- Security testing

### Staging → Production

**Process**:

1. Complete testing in staging
2. Get stakeholder approval
3. Create release tag in Git
4. Trigger production deployment workflow
5. Select `prod` environment
6. (Optional) Wait for approval
7. Monitor deployment
8. Validate in production
9. Announce release

**Validation**:

- Smoke testing
- Critical path testing
- Monitor error rates
- Check performance metrics
- Verify integrations

## Environment-Specific Features

### Feature Flags

Use environment variables to enable/disable features:

```typescript
// apps/webapp/src/config/features.ts
export const features = {
  checkpointAnalysis: process.env.NEXT_PUBLIC_ENV !== "development",
  advancedMetrics: process.env.NEXT_PUBLIC_ENV === "prod",
  debugMode: process.env.NEXT_PUBLIC_ENV === "development",
};
```

### Logging Levels

```python
# gcp/proxy/api/config.py
import os

LOG_LEVEL = {
    'development': 'DEBUG',
    'staging': 'INFO',
    'prod': 'WARNING',
}.get(os.getenv('ENV', 'development'), 'INFO')
```

### Rate Limiting

```python
# Different rate limits per environment
RATE_LIMITS = {
    'development': {'calls': 1000, 'period': 3600},
    'staging': {'calls': 500, 'period': 3600},
    'prod': {'calls': 100, 'period': 3600},
}
```

## Troubleshooting

### Environment Mismatch

**Problem**: Service calling wrong environment

**Solution**:

1. Verify environment variables are set correctly
2. Check configuration files
3. Restart services
4. Clear cache

### Configuration Errors

**Problem**: Configuration not applying

**Solution**:

1. Verify configuration file exists
2. Check file naming (e.g., `apphosting.staging.yaml`)
3. Validate YAML syntax
4. Redeploy service

### Data Isolation Issues

**Problem**: Staging data mixing with production

**Solution**:

1. Use separate GCP projects (recommended)
2. Use environment prefixes in resource names
3. Use separate Firestore collections
4. Audit IAM permissions

## Best Practices

### 1. Environment Isolation

- Use separate GCP projects for production
- Separate service accounts per environment
- Isolated databases and storage
- No production data in staging

### 2. Configuration Management

- Use environment-specific config files
- Store secrets in Secret Manager
- Never commit secrets to repository
- Document all environment variables

### 3. Testing Strategy

- Test in development first
- Validate in staging before production
- Automated testing in CI/CD
- Manual testing for critical features

### 4. Deployment Strategy

- Auto-deploy to staging
- Manual deploy to production
- Require approval for production
- Maintain rollback capability

### 5. Monitoring

- Monitor all environments
- Alert on production errors
- Review staging logs regularly
- Track deployment frequency

### 6. Security

- Restrict production access
- Audit access logs
- Rotate secrets regularly
- Enable MFA for production access

## Environment Checklist

For launch sign-off (Product Hunt and production GA), use the dedicated checklists:

- [Launch Plan Progress](./LAUNCH_PLAN_PROGRESS.md) — phase engineering status and operational TODOs after each phase
- [Product Hunt Launch](./PRODUCT_HUNT_LAUNCH.md) — listing assets, UTM, **§2.1 prod web env vars**, launch-day ops, smoke tests
- [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md) — security, compliance, ops, CI (full GA)

The abbreviated lists below remain for quick reference during routine deploys.

### Before Deploying to Staging

- [ ] Code reviewed and approved
- [ ] Tests passing locally
- [ ] Environment variables configured
- [ ] Dependencies updated
- [ ] Documentation updated

### Before Deploying to Production

- [ ] Tested thoroughly in staging
- [ ] Stakeholder approval obtained
- [ ] Release notes prepared
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Team notified
- [ ] Backup taken (if applicable)

### After Deployment

- [ ] Smoke tests passed
- [ ] Monitoring shows no errors
- [ ] Performance metrics normal
- [ ] Users notified (if applicable)
- [ ] Documentation updated
- [ ] Post-deployment review scheduled

## Related Documentation

- [Launch Plan Progress](./LAUNCH_PLAN_PROGRESS.md)
- [Product Hunt Launch](./PRODUCT_HUNT_LAUNCH.md)
- [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md)
- [Web Application Deployment](./WEBAPP_DEPLOYMENT.md)
- [Mobile Application Deployment](./MOBILE_DEPLOYMENT.md)
- [Agent Deployment](./AGENT_DEPLOYMENT.md)
- [Proxy Deployment](./PROXY_DEPLOYMENT.md)
- [CI/CD Pipeline Documentation](./CICD.md)
- [Infrastructure Setup](./INFRASTRUCTURE.md)
