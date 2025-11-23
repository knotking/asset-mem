# Environment Configuration Guide

This document explains how environment-specific configuration is managed for different deployment environments.

## Overview

The app uses a **proxy-based architecture** where all API endpoints are constructed from a base URL and token:

- **Local Development**: Uses `.env` file with `PROXY_BASE_URL` and `PROXY_TOKEN`
- **EAS Builds**: Uses `eas.json` configuration for each build profile
- **CI/CD Deployment**: Uses GitHub Actions with environment-level secrets

## Architecture

### Proxy URL Construction

Instead of managing individual endpoint URLs, the app uses a proxy pattern:

```
{PROXY_BASE_URL}/{PROXY_TOKEN}/{endpoint}
```

**Example:**

```
Base: https://homecare-agent-proxy-staging-321433914812.us-central1.run.app
Token: abc123xyz
Endpoint: agent-session
Result: https://homecare-agent-proxy-staging-321433914812.us-central1.run.app/abc123xyz/agent-session
```

The [app.config.js:5-8](apps/mapp/app.config.js#L5-L8) `buildProxyUrl()` helper constructs these URLs automatically.

### API Endpoints

The following endpoints are constructed from the proxy base URL:

| Endpoint                | Purpose                |
| ----------------------- | ---------------------- |
| `agent-session`         | Agent session creation |
| `firebase-agent-stream` | Agent SSE streaming    |
| `rag-file-upload`       | RAG file upload        |
| `extract-doc-info`      | Document analysis      |

These are exposed in [app.config.js:76-79](apps/mapp/app.config.js#L76-L79) via `expo.extra`.

## Setup for Local Development

### 1. Create your `.env` file

```bash
cd apps/mapp
cp .env.example .env
```

### 2. Configure environment variables

Edit `.env` with your development proxy configuration:

```env
# Proxy Configuration
PROXY_BASE_URL=https://homecare-agent-proxy-dev-321433914812.us-central1.run.app
PROXY_TOKEN=your-dev-proxy-token

# Web App URL
WEB_APP_URL=https://staging--homegeekdemo.us-central1.hosted.app

# Optional: App identification (defaults set in app.config.js)
APP_SLUG=homegeekai-staging
EXPO_PROJECT_ID=cc06df81-5ad0-4fc3-ad59-6294c95e4614
```

### 3. Start the development server

```bash
npm run dev
# or
npx expo start
```

The `.env` file is automatically loaded by `dotenv` in [app.config.js:2](apps/mapp/app.config.js#L2).

## EAS Build Profiles

Environment configuration for EAS builds is managed in [eas.json](../eas.json).

### Available Profiles

#### Development Profile

```bash
eas build --profile development --platform ios
```

**Configuration** ([eas.json:7-28](../eas.json#L7-L28)):

- App Slug: `homegeekai-development`
- Bundle ID: `com.homegeekai.dev`
- Proxy: Development environment
- Channel: `development`
- Development client enabled
- iOS simulator builds supported

#### Staging Profile

```bash
eas build --profile staging --platform ios
```

**Configuration** ([eas.json:29-48](../eas.json#L29-L48)):

- App Slug: `homegeekai-staging`
- Bundle ID: `com.homegeekai.staging`
- Proxy: Staging environment
- Channel: `staging`
- Internal distribution

#### Production Profile

```bash
eas build --profile production --platform ios
```

**Configuration** ([eas.json:49-69](../eas.json#L49-L69)):

- App Slug: `homegeekai-prod`
- Bundle ID: `com.homegeekai.prod`
- Proxy: Production environment
- Channel: `production`
- Store distribution
- Auto-increment build numbers

### Environment Variables in eas.json

Each profile defines these environment variables:

| Variable          | Description                              | Example                                    |
| ----------------- | ---------------------------------------- | ------------------------------------------ |
| `APP_SLUG`        | Expo app slug for the environment        | `homegeekai-staging`                       |
| `IOS_BUNDLE_ID`   | iOS bundle identifier                    | `com.homegeekai.staging`                   |
| `ANDROID_PACKAGE` | Android package name                     | `com.homegeekai.staging`                   |
| `EXPO_PROJECT_ID` | Expo project ID                          | `cc06df81-5ad0-4fc3-ad59-6294c95e4614`     |
| `PROXY_BASE_URL`  | Proxy base URL                           | `https://homecare-agent-proxy-staging-...` |
| `PROXY_TOKEN`     | Proxy authentication token (placeholder) | `${PROXY_TOKEN}`                           |
| `WEB_APP_URL`     | Web app URL                              | `https://staging--homegeekdemo...`         |
| `APP_ENV`         | App environment (production only)        | `production`                               |

**Important**: `PROXY_TOKEN` uses placeholder syntax `${PROXY_TOKEN}` and must be provided at build time via EAS Secrets or CI/CD secrets.

## CI/CD Deployment with GitHub Actions

The app uses automated deployment via GitHub Actions for OTA updates.

### Workflow: Deploy OTA Updates

**File**: [.github/workflows/deploy-mapp-update.yaml](../../../.github/workflows/deploy-mapp-update.yaml)

#### Automatic Deployment

**Trigger**: Push to `main` branch with changes to:

- `apps/mapp/**`
- `apps/common/**`
- Workflow file itself

**Behavior** ([deploy-mapp-update.yaml:54-57](../../../.github/workflows/deploy-mapp-update.yaml#L54-L57)):

- Automatically deploys to **staging** environment
- Uses staging channel
- Version auto-increments: `0.0.{run_number}`
- Commit message used as update message

#### Manual Deployment

**Trigger**: Manual workflow dispatch via GitHub UI

**Options**:

- **Environment**: `staging` or `production`
- **Version**: Custom version (e.g., `0.0.5`) or auto-increment
- **Message**: Custom update message

### Required GitHub Configuration

#### Repository Secrets

Set in **Settings → Secrets and variables → Actions**:

| Secret       | Description               | Used By            |
| ------------ | ------------------------- | ------------------ |
| `EXPO_TOKEN` | Expo authentication token | All builds/updates |

#### Environment-Level Configuration

Set in **Settings → Environments → [staging/production]**:

**Secrets**:
| Secret | Description |
|--------|-------------|
| `PROXY_TOKEN` | Proxy authentication token for the environment |

**Variables**:
| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_ACCOUNT` | Expo account name | `your-expo-account` |

### How CI/CD Works

1. **Validation** ([deploy-mapp-update.yaml:34-99](../../../.github/workflows/deploy-mapp-update.yaml#L34-L99)):
   - Determines environment (staging/production)
   - Validates required secrets exist
   - Sets update message from commit or manual input

2. **Environment Loading** ([deploy-mapp-update.yaml:156-178](../../../.github/workflows/deploy-mapp-update.yaml#L156-L178)):
   - Extracts env vars from `eas.json` for selected environment
   - Sets `PROXY_BASE_URL`, `WEB_APP_URL`, `APP_SLUG`, `EXPO_PROJECT_ID`

3. **Version Generation** ([deploy-mapp-update.yaml:180-192](../../../.github/workflows/deploy-mapp-update.yaml#L180-L192)):
   - Manual input: Uses provided version
   - Auto: `0.0.{github.run_number}`

4. **Publish Update** ([deploy-mapp-update.yaml:194-210](../../../.github/workflows/deploy-mapp-update.yaml#L194-L210)):
   - Runs `eas update --channel {channel}`
   - Injects environment variables from GitHub secrets
   - Publishes OTA update to the channel

5. **Summary** ([deploy-mapp-update.yaml:212-222](../../../.github/workflows/deploy-mapp-update.yaml#L212-L222)):
   - Posts summary with environment, version, message
   - Links to Expo dashboard

## Publishing OTA Updates

### Automatic (Recommended)

Simply push changes to the `main` branch:

```bash
git add .
git commit -m "Fix chat message rendering"
git push origin main
```

The GitHub Action automatically:

- Publishes to staging channel
- Auto-increments version
- Uses commit message as update description

### Manual via GitHub UI

1. Go to **Actions** tab in GitHub
2. Select **Deploy Mapp - EAS Update (OTA)** workflow
3. Click **Run workflow**
4. Select:
   - **Environment**: staging or production
   - **Version**: Custom or leave empty for auto-increment
   - **Message**: Update description
5. Click **Run workflow**

### Manual via CLI (Local)

If you need to publish manually from your local machine:

```bash
# Login to Expo
eas login

# Configure environment variables in .env
# Make sure PROXY_BASE_URL, PROXY_TOKEN, etc. are set

# Publish to staging
eas update --channel staging --message "Your update message"

# Publish to production
eas update --channel production --message "Production release v1.2.0"
```

**Note**: When publishing via CLI, environment variables come from your local `.env` file. For production releases, use the GitHub Actions workflow to ensure correct configuration.

## How Environment Variables Flow

### Local Development

```
.env file
  ↓
dotenv loads variables (app.config.js:2)
  ↓
buildProxyUrl() constructs URLs (app.config.js:5-8)
  ↓
expo.extra.{agentSessionUrl, etc.} (app.config.js:76-79)
  ↓
App reads via Constants.expoConfig.extra
```

### EAS Builds

```
eas.json profile env vars
  ↓
EAS CLI sets process.env during build
  ↓
app.config.js reads from process.env
  ↓
buildProxyUrl() constructs URLs
  ↓
expo.extra.{agentSessionUrl, etc.}
  ↓
Bundled into app binary
```

### CI/CD OTA Updates

```
eas.json → Extract env vars (deploy-mapp-update.yaml:164-172)
GitHub Environment Secrets → PROXY_TOKEN
  ↓
Set as process.env in workflow (deploy-mapp-update.yaml:203-210)
  ↓
eas update command runs
  ↓
app.config.js evaluates with env vars
  ↓
OTA bundle published with URLs
```

## Environment Variables Reference

### Required Variables

| Variable         | Description                    | Source                       |
| ---------------- | ------------------------------ | ---------------------------- |
| `PROXY_BASE_URL` | Base URL for proxy endpoints   | `.env` or `eas.json`         |
| `PROXY_TOKEN`    | Authentication token for proxy | `.env` or GitHub/EAS Secrets |
| `WEB_APP_URL`    | Web application URL            | `.env` or `eas.json`         |

### Optional Variables

| Variable          | Description      | Default                  | Source                  |
| ----------------- | ---------------- | ------------------------ | ----------------------- |
| `APP_SLUG`        | Expo app slug    | `homegeekai-staging`     | `eas.json`              |
| `APP_VERSION`     | App version      | `0.0.1`                  | Auto-generated in CI    |
| `IOS_BUNDLE_ID`   | iOS bundle ID    | `com.homegeekai.staging` | `eas.json`              |
| `ANDROID_PACKAGE` | Android package  | `com.homegeekai.staging` | `eas.json`              |
| `EXPO_PROJECT_ID` | Expo project ID  | (set in eas.json)        | `eas.json`              |
| `APP_ENV`         | Environment name | (not set)                | `eas.json` (production) |

### Constructed URLs (in expo.extra)

These are built automatically by [app.config.js:76-79](apps/mapp/app.config.js#L76-L79):

| Property              | Constructed From                                       | Example        |
| --------------------- | ------------------------------------------------------ | -------------- |
| `agentSessionUrl`     | `{PROXY_BASE_URL}/{PROXY_TOKEN}/agent-session`         | Full proxy URL |
| `agentSseUrl`         | `{PROXY_BASE_URL}/{PROXY_TOKEN}/firebase-agent-stream` | Full proxy URL |
| `ragFileUploadUrl`    | `{PROXY_BASE_URL}/{PROXY_TOKEN}/rag-file-upload`       | Full proxy URL |
| `documentAnalysisUrl` | `{PROXY_BASE_URL}/{PROXY_TOKEN}/extract-doc-info`      | Full proxy URL |
| `webAppUrl`           | `WEB_APP_URL`                                          | Direct value   |

## Security Best Practices

### Local Development

- ✅ `.env` is in `.gitignore` - never commit it
- ✅ `.env.example` is safe to commit (contains no secrets)
- ✅ Use development/staging proxy tokens, never production

### EAS Builds

- ✅ `eas.json` can be committed (uses `${PROXY_TOKEN}` placeholder)
- ✅ Real tokens provided via EAS Secrets or CI/CD secrets
- ⚠️ Never hardcode `PROXY_TOKEN` in `eas.json`

### GitHub Actions

- ✅ Use GitHub Environment-level secrets for `PROXY_TOKEN`
- ✅ Use repository secret for `EXPO_TOKEN`
- ✅ Separate staging and production environments
- ✅ Use environment protection rules for production

### Managing Secrets

**For local development:**

```bash
# Add to your .env file (never commit)
echo "PROXY_TOKEN=your-token-here" >> .env
```

**For GitHub Actions:**

1. Go to **Settings → Environments**
2. Create/edit `staging` and `production` environments
3. Add `PROXY_TOKEN` secret for each environment
4. Add `EXPO_ACCOUNT` variable for each environment

**For manual EAS builds:**

```bash
# Option 1: Use .env file
echo "PROXY_TOKEN=your-token" >> .env
eas build --profile staging --platform ios

# Option 2: Use EAS Secrets (recommended for shared projects)
eas secret:create --scope project --name PROXY_TOKEN --value "your-token" --type string
```

## Troubleshooting

### Error: "agentSessionUrl not set" or undefined URLs

**Cause**: Missing `PROXY_BASE_URL` or `PROXY_TOKEN`.

**Solution**:

1. Check `.env` file exists and contains both variables
2. Verify no typos in variable names
3. Restart Expo dev server: `npm run dev`
4. Check that `buildProxyUrl()` is being called (see [app.config.js:76](apps/mapp/app.config.js#L76))

### EAS Build: API calls failing with 401/403

**Cause**: `PROXY_TOKEN` not set or incorrect during build.

**Solution**:

1. Check `PROXY_TOKEN` in your `.env` file (for local builds)
2. For CI/CD builds, verify GitHub Environment secret is set correctly
3. Rebuild: `eas build --profile staging --platform ios`

### GitHub Actions: Workflow failing validation

**Cause**: Missing secrets or environment variables.

**Solution**:

1. Check error message for which secret/variable is missing
2. Go to **Settings → Environments → [environment-name]**
3. Ensure these exist:
   - Secret: `PROXY_TOKEN`
   - Variable: `EXPO_ACCOUNT`
4. Check repository-level secret: `EXPO_TOKEN`

### OTA Update not appearing in app

**Cause**: Channel mismatch or update not reaching device.

**Solution**:

1. Verify your build's channel matches update channel
   - Check [eas.json](../eas.json) for build profile's `channel` field
2. Restart the app completely (force close and reopen)
3. Check update was published: `eas update:list --channel staging`
4. Verify app is configured for OTA updates ([app.config.js:82-87](apps/mapp/app.config.js#L82-L87))

### Environment variables not updating after OTA

**Cause**: OTA updates use config from publish time.

**Solution**:

1. For GitHub Actions: Secrets are injected at publish time automatically
2. For manual CLI: Update `.env` before running `eas update`
3. Republish: `eas update --channel staging --message "Updated config"`
4. If still failing, create a new build (native config can't be updated via OTA)

## Files Overview

| File                      | Purpose                                        | Committed to Git      |
| ------------------------- | ---------------------------------------------- | --------------------- |
| `.env`                    | Local development environment variables        | ❌ No (in .gitignore) |
| `.env.example`            | Template showing required variables            | ✅ Yes                |
| `eas.json`                | EAS build profiles and environment config      | ✅ Yes                |
| `app.config.js`           | Expo config, loads env vars, builds proxy URLs | ✅ Yes                |
| `deploy-mapp-update.yaml` | GitHub Actions workflow for OTA updates        | ✅ Yes                |

## Environment URLs Reference

### Development Environment

- **Proxy Base URL**: `https://homecare-agent-proxy-dev-321433914812.us-central1.run.app`
- **Web App URL**: `https://staging--homegeekdemo.us-central1.hosted.app`
- **App Slug**: `homegeekai-development`
- **Bundle ID**: `com.homegeekai.dev`

### Staging Environment

- **Proxy Base URL**: `https://homecare-agent-proxy-staging-321433914812.us-central1.run.app`
- **Web App URL**: `https://staging--homegeekdemo.us-central1.hosted.app`
- **App Slug**: `homegeekai-staging`
- **Bundle ID**: `com.homegeekai.staging`

### Production Environment

- **Proxy Base URL**: `https://homecare-agent-proxy-prod-321433914812.us-central1.run.app`
- **Web App URL**: `https://prod--homegeekdemo.us-central1.hosted.app`
- **App Slug**: `homegeekai-prod`
- **Bundle ID**: `com.homegeekai.prod`

## Quick Reference

```bash
# Local development
cd apps/mapp
cp .env.example .env          # First time setup
# Edit .env with your PROXY_BASE_URL and PROXY_TOKEN
npm run dev                   # Start dev server

# EAS builds
eas login                                           # First time
eas build --profile development --platform ios      # Dev build
eas build --profile staging --platform ios          # Staging build
eas build --profile production --platform ios       # Production build

# OTA updates via CLI
eas update --channel staging --message "Bug fix"
eas update --channel production --message "v1.2.0"

# View updates
eas update:list
eas update:list --channel staging

# CI/CD (automated via GitHub Actions)
git push origin main          # Auto-deploys to staging
# Or use GitHub UI: Actions → Deploy Mapp - EAS Update (OTA) → Run workflow

# Managing secrets
# For GitHub: Use UI (Settings → Environments)
# For EAS: Use CLI
eas secret:create --scope project --name PROXY_TOKEN --value "token"
eas secret:list
eas secret:delete --name PROXY_TOKEN
```

## Additional Resources

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- [EAS Update](https://docs.expo.dev/eas-update/introduction/)
- [GitHub Actions with EAS](https://docs.expo.dev/build/building-on-ci/)
- [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
