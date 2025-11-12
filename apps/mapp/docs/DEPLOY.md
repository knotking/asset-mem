# HomeGeekAI Mapp Deployment Guide

Complete guide for deploying the React Native + Expo mobile application using GitHub Actions and local deployment scripts.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Deployment Methods](#deployment-methods)
  - [GitHub Actions (Recommended)](#github-actions-recommended)
  - [Local Deployment](#local-deployment)
- [Build Profiles](#build-profiles)
- [Deployment Workflows](#deployment-workflows)
- [Troubleshooting](#troubleshooting)

## Overview

The mapp deployment system supports two types of deployments:

1. **EAS Build** - Native app builds for iOS/Android (required for app store submissions)
2. **EAS Update** - Over-the-air (OTA) JavaScript updates (fast updates without app store review)

### When to Use Each

| Scenario | Use Build | Use Update |
|----------|-----------|------------|
| JS/React code changes only | ❌ | ✅ |
| New dependencies added | ✅ | ❌ |
| Native module changes | ✅ | ❌ |
| app.json/eas.json changes | ✅ | ❌ |
| Assets changes (images, fonts) | ❌ | ✅ |
| Config changes (API endpoints) | ❌ | ✅ |
| First release | ✅ | ❌ |

## Prerequisites

### Required Accounts & Tools

1. **Expo Account**
   - Sign up at [expo.dev](https://expo.dev)
   - Note your account username

2. **Apple Developer Account** (for iOS)
   - Enroll at [developer.apple.com](https://developer.apple.com)
   - Cost: $99/year
   - Create App ID in App Store Connect

3. **Google Play Developer Account** (for Android)
   - Enroll at [play.google.com/console](https://play.google.com/console)
   - One-time fee: $25
   - Create app in Google Play Console

4. **Local Development Tools**
   - Node.js 20+ ([nodejs.org](https://nodejs.org))
   - npm (comes with Node.js)
   - EAS CLI: `npm install -g eas-cli`
   - Git

## Initial Setup

### Step 1: Configure Expo/EAS

```bash
# Navigate to mapp directory
cd apps/mapp

# Login to Expo
eas login

# Verify login
eas whoami

# Configure EAS project (if needed)
eas build:configure
```

### Step 2: Set Up GitHub Secrets

Navigate to your GitHub repository: **Settings → Secrets and variables → Actions**

#### Required Secrets (Repository Level)

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `EXPO_TOKEN` | Expo access token | Run `eas login` then create token at [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) |

#### Required Secrets (Environment Level)

Navigate to: **Settings → Environments → [staging/production] → Environment secrets**

| Secret Name | Description | Environment |
|-------------|-------------|-------------|
| `PROXY_TOKEN` | API proxy authentication token | staging, production |

#### Required Variables (Environment Level)

Navigate to: **Settings → Environments → [staging/production] → Environment variables**

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `EXPO_PROJECT_ID` | `cc06df81-5ad0-4fc3-ad59-6294c95e4614` | From app.config.js extra.eas.projectId |
| `EXPO_ACCOUNT` | Your Expo username | From `eas whoami` |

### Step 3: Configure App Store Credentials (Production Only)

#### iOS Setup

1. Update [eas.json](./eas.json):
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDEF1234"
      }
    }
  }
}
```

2. Generate credentials:
```bash
eas credentials
```

#### Android Setup

1. Create service account in Google Play Console
2. Download JSON key file
3. Update [eas.json](./eas.json):
```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

## Deployment Methods

### GitHub Actions (Recommended)

Automated deployments triggered by code changes or manual workflows.

#### Automatic Triggers

| Event | Workflow | Profile | Channel |
|-------|----------|---------|---------|
| Push to `main` (mapp changes) | Update only | staging | staging |

**Note**: Automatic builds are currently disabled. Use manual workflows for builds.

#### Manual Workflows

##### 1. Deploy Mapp - EAS Build

**Location**: Actions → Deploy Mapp - EAS Build

**When to Use**: Native app builds for app stores or internal testing

**Parameters**:
- **Environment**: `staging` or `production`
- **Platform**: `ios`, `android`, or `all`
- **Profile**: Build profile (optional, defaults to environment)
- **Version**: App version (optional, auto-increments if not specified)

**Example Scenarios**:

```yaml
# Scenario 1: Production iOS build for App Store with auto-increment version
Environment: production
Platform: ios
Profile: (leave empty)
Version: (leave empty for auto-increment)

# Scenario 2: Staging Android APK with specific version
Environment: staging
Platform: android
Profile: staging
Version: 1.0.0

# Scenario 3: Build both platforms for production with auto-increment
Environment: production
Platform: all
Profile: (leave empty)
Version: (leave empty for auto-increment)
```

**Steps**:
1. Go to **Actions** tab in GitHub
2. Select **Deploy Mapp - EAS Build**
3. Click **Run workflow**
4. Select options
5. Click **Run workflow**
6. Monitor build at [expo.dev](https://expo.dev/accounts/YOUR_ACCOUNT/projects/homegeek-ai/builds)

##### 2. Deploy Mapp - EAS Update (OTA)

**Location**: Actions → Deploy Mapp - EAS Update

**When to Use**: Quick JavaScript/React updates without app store review

**Parameters**:
- **Environment**: `staging` or `production`
- **Version**: App version (optional, auto-increments if not specified)
- **Message**: Description of changes (optional)

**Example Scenarios**:

```yaml
# Scenario 1: Staging update with auto-increment version
Environment: staging
Version: (leave empty for auto-increment)
Message: "Fixed login bug and improved performance"

# Scenario 2: Production hotfix with specific version
Environment: production
Version: 1.2.1
Message: "Critical security patch"

# Scenario 3: Feature update with auto-increment
Environment: staging
Version: (leave empty for auto-increment)
Message: "Added new dashboard widgets"
```

**Steps**:
1. Go to **Actions** tab in GitHub
2. Select **Deploy Mapp - EAS Update**
3. Click **Run workflow**
4. Select environment and add message
5. Click **Run workflow**
6. Update goes live in minutes

**Update Delivery**:
- Users get updates on next app restart
- No app store approval needed
- Only works for JS/asset changes

### Local Deployment

Use the local deployment script for development and testing.

#### Script Location

```bash
apps/mapp/deploy.sh
```

#### Available Commands

##### Build Commands

```bash
# Development build (with dev tools)
./deploy.sh build --platform ios --profile development

# Preview build (internal testing)
./deploy.sh build --platform android --profile preview

# Staging build
./deploy.sh build --platform all --profile staging

# Production build (for app stores)
./deploy.sh build --platform ios --profile production
./deploy.sh build --platform android --profile production

# Build both platforms
./deploy.sh build --platform all --profile production
```

##### Update Commands (OTA)

```bash
# Staging channel update
./deploy.sh update --channel staging --message "Bug fixes"

# Production channel update
./deploy.sh update --channel production --message "New features"

# Quick staging update (default message)
./deploy.sh update --channel staging
```

##### Submit Commands

```bash
# Submit iOS to App Store
./deploy.sh submit --platform ios

# Submit Android to Google Play
./deploy.sh submit --platform android

# Submit both platforms
./deploy.sh submit --platform all
```

##### Help Command

```bash
./deploy.sh help
```

#### Script Features

- ✅ Prerequisite checking (Node.js, npm, EAS CLI)
- ✅ Automatic dependency installation
- ✅ Expo authentication verification
- ✅ Colorized output for better readability
- ✅ Error handling and validation

## Environment Configuration Flow

### How Environment Variables Work

The deployment system uses a layered approach for environment configuration:

#### 1. GitHub Environment Variables (Workflow Level)
Set in: **Settings → Environments → [staging/production] → Environment variables**

These override values during GitHub Actions workflows:
- `EXPO_PROJECT_ID` - Passed to EAS commands
- `EXPO_ACCOUNT` - Used in workflow summaries

#### 2. EAS Build Profile (eas.json)
Set in: [eas.json](./eas.json) under each profile's `env` section

These are used during EAS builds (both GitHub and local):
- `APP_SLUG` - App identifier/slug
- `IOS_BUNDLE_ID` - iOS bundle identifier
- `ANDROID_PACKAGE` - Android package name
- `EXPO_PROJECT_ID` - Expo project ID (fallback)
- `PROXY_BASE_URL`, `PROXY_TOKEN`, `WEB_APP_URL` - API endpoints

#### 3. App Configuration (app.config.js)
Reads from: `process.env.*` with fallback values

The app config reads environment variables set by either:
- GitHub workflows → EAS build
- eas.json → EAS build
- Local .env file → Local development

**Example Flow for GitHub Workflow Build:**
```
GitHub Env Var (EXPO_PROJECT_ID)
  ↓ (passed to workflow)
Workflow sets environment
  ↓ (passed to EAS command)
EAS build runs with env vars from both GitHub + eas.json
  ↓ (environment variables available)
app.config.js reads process.env.EXPO_PROJECT_ID
  ↓ (configuration applied)
App builds with correct settings
```

**Example Flow for Local Build:**
```
eas.json profile env values
  ↓ (EAS reads profile)
Local EAS build uses eas.json env
  ↓ (environment variables available)
app.config.js reads process.env.IOS_BUNDLE_ID
  ↓ (configuration applied)
App builds with profile-specific settings
```

### Bundle Identifier Strategy

Each environment uses a unique bundle identifier, allowing multiple versions to be installed side-by-side on the same device:

| Environment | iOS Bundle ID | Android Package | Purpose |
|-------------|--------------|-----------------|---------|
| Development | `com.homegeekai.dev` | `com.homegeekai.dev` | Local dev builds |
| Staging | `com.homegeekai.staging` | `com.homegeekai.staging` | Internal testing |
| Production | `com.homegeekai.prod` | `com.homegeekai.prod` | App store releases |

**Benefits:**
- Test production and staging builds on the same device
- No conflicts between different environments
- Clear separation of app data per environment

## Build Profiles

Defined in [eas.json](./eas.json)

### Development

**Purpose**: Local development with Expo Dev Client

**Configuration**:
- Internal distribution
- Development client enabled
- iOS simulator support
- Android APK (debug)

**Usage**:
```bash
./deploy.sh build --platform ios --profile development
```

### Preview

**Note**: The preview profile is not currently configured in [eas.json](./eas.json). For internal testing, use the `development` or `staging` profiles instead.

### Staging

**Purpose**: Pre-production testing

**Configuration**:
- Internal distribution
- Separate bundle IDs:
  - iOS: `com.homegeekai.staging`
  - Android: `com.homegeekai.staging`
- Staging update channel
- Release build with staging environment variables

**Usage**:
```bash
./deploy.sh build --platform all --profile staging
```

**Environment Variables** (from eas.json):
- `APP_SLUG=homegeekai-staging`
- `IOS_BUNDLE_ID=com.homegeekai.staging`
- `ANDROID_PACKAGE=com.homegeekai.staging`
- `EXPO_PROJECT_ID=cc06df81-5ad0-4fc3-ad59-6294c95e4614`
- `PROXY_BASE_URL`, `PROXY_TOKEN`, `WEB_APP_URL`

### Production

**Purpose**: App store releases

**Configuration**:
- Store distribution
- Production bundle IDs:
  - iOS: `com.homegeekai.prod`
  - Android: `com.homegeekai.prod`
- Production update channel
- Auto-increment build numbers
- AAB for Android (required by Google Play)

**Usage**:
```bash
./deploy.sh build --platform all --profile production
```

**Environment Variables** (from eas.json):
- `APP_ENV=production`
- `APP_SLUG=homegeekai-prod`
- `IOS_BUNDLE_ID=com.homegeekai.prod`
- `ANDROID_PACKAGE=com.homegeekai.prod`
- `EXPO_PROJECT_ID=cc06df81-5ad0-4fc3-ad59-6294c95e4614`
- `PROXY_BASE_URL`, `PROXY_TOKEN`, `WEB_APP_URL`

## Deployment Workflows

### Workflow 1: Feature Development

```bash
# 1. Develop feature locally
npm start

# 2. Test on device/simulator
npm run ios
# or
npm run android

# 3. Commit changes
git add .
git commit -m "Add new feature"

# 4. Push to main branch
git push origin main
# → Triggers automatic staging OTA update

# 5. Test on staging channel
# Have QA team verify on staging build

# 6. When ready for production, use manual workflow
# Actions → Deploy Mapp - EAS Update
# Select production environment
```

### Workflow 2: Production Release (Full Build)

```bash
# 1. Ensure main branch is ready
git checkout main
git pull origin main

# 2. Trigger production build via GitHub Actions
# Actions → Deploy Mapp - EAS Build
# Environment: production
# Platform: all
# Version: 1.0.2 (or leave empty to auto-increment)

# 3. Wait for builds to complete (~15-30 minutes)
# Monitor at: https://expo.dev/accounts/[account]/projects/homegeek-ai/builds

# 4. Download and test builds

# 5. Submit to stores via GitHub Actions
# Actions → Deploy Mapp - EAS Build
# Or use local script:
./deploy.sh submit --platform all

# 6. Monitor app store review process
```

### Workflow 3: Hotfix via OTA Update

```bash
# 1. Fix critical bug on main branch
git checkout main
# Make fixes...
git add .
git commit -m "Fix critical bug in user authentication"

# 2. Push to trigger staging update
git push origin main

# 3. Test staging update

# 4. Deploy to production via GitHub Actions
# Actions → Deploy Mapp - EAS Update
# Environment: production
# Message: "Critical bug fix for authentication"

# 5. Update goes live immediately
# Users get update on next app restart
```

### Workflow 4: Testing on Real Devices

```bash
# 1. Create internal distribution build
./deploy.sh build --platform ios --profile staging

# 2. Wait for build to complete

# 3. Share build via Expo
# Navigate to: https://expo.dev/accounts/[account]/projects/homegeek-ai/builds
# Download build or send invitation link to testers

# 4. Testers install via link or TestFlight/Play Console
```

## Update Channels Explained

Update channels control which OTA updates users receive.

### Staging Channel

**Purpose**: Testing and QA

**Users**: Internal team, beta testers

**Builds**:
- `staging` profile builds
- `development` profile builds

**Updates**:
```bash
./deploy.sh update --channel staging
```

**Configuration in app.json**:
```json
{
  "updates": {
    "url": "https://u.expo.dev/4d090ffd-6554-4652-9cb5-0ca6f02fb167"
  },
  "runtimeVersion": {
    "policy": "appVersion"
  }
}
```

### Production Channel

**Purpose**: Live users

**Users**: All app store users

**Builds**: `production` profile builds

**Updates**:
```bash
./deploy.sh update --channel production
```

### Channel Switching

Users receive updates based on the channel their build was configured with:

```json
// eas.json
{
  "build": {
    "staging": {
      "channel": "staging"  // Gets staging updates
    },
    "production": {
      "channel": "production"  // Gets production updates
    }
  }
}
```

## Troubleshooting

### Common Issues

#### Issue 1: "EXPO_TOKEN not found"

**Symptom**: GitHub Actions workflow fails with missing token error

**Solution**:
```bash
# 1. Create access token at Expo
# https://expo.dev/settings/access-tokens

# 2. Add to GitHub Secrets
# Settings → Secrets and variables → Actions → New repository secret
# Name: EXPO_TOKEN
# Value: [your token]
```

#### Issue 2: "Build failed - credentials not configured"

**Symptom**: Build fails during credential setup

**Solution**:
```bash
# Run credentials setup locally
cd apps/mapp
eas credentials

# Follow prompts to configure iOS/Android credentials
# Then retry build
```

#### Issue 3: "Update not appearing on device"

**Symptom**: Published OTA update doesn't appear

**Solution**:
```bash
# 1. Verify device is on correct channel
# Check app.json and eas.json configuration

# 2. Force app restart (kill and reopen)

# 3. Check update was published
# https://expo.dev/accounts/[account]/projects/homegeek-ai/updates

# 4. Verify runtime version matches
# OTA updates only work with matching runtime versions
```

#### Issue 4: "eas: command not found"

**Symptom**: Local script fails to find EAS CLI

**Solution**:
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Verify installation
eas --version

# Login to Expo
eas login
```

#### Issue 5: "Dependencies out of sync"

**Symptom**: Build fails with dependency errors

**Solution**:
```bash
# Clean install dependencies
cd apps/mapp
rm -rf node_modules package-lock.json
npm install

# Also clean root dependencies
cd ../..
rm -rf node_modules package-lock.json
npm install
```

#### Issue 6: "GitHub workflow fails validation"

**Symptom**: Workflow fails in validation step

**Solution**:
```bash
# Check all required secrets and variables are set:

# Repository-level secrets (Settings → Secrets and variables → Actions):
# - EXPO_TOKEN

# Environment-level secrets (Settings → Environments → [staging/production] → Environment secrets):
# - PROXY_TOKEN

# Environment-level variables (Settings → Environments → [staging/production] → Environment variables):
# - EXPO_PROJECT_ID
# - EXPO_ACCOUNT
```

#### Issue 7: "PROXY_TOKEN not found"

**Symptom**: Workflow fails with "PROXY_TOKEN secret is not set" error

**Solution**:
```bash
# PROXY_TOKEN is environment-specific
# 1. Go to Settings → Environments
# 2. Select the environment (staging or production)
# 3. Add PROXY_TOKEN to Environment secrets
# 4. Repeat for each environment you use
```

### Getting Help

1. **Expo Documentation**: [docs.expo.dev](https://docs.expo.dev)
2. **EAS Build Docs**: [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction/)
3. **EAS Update Docs**: [docs.expo.dev/eas-update/introduction](https://docs.expo.dev/eas-update/introduction/)
4. **GitHub Actions Logs**: Check workflow run details in Actions tab
5. **EAS Build Logs**: Available at [expo.dev](https://expo.dev) in build details

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Local builds with debug output
EAS_DEBUG=1 ./deploy.sh build --platform ios --profile development

# Check EAS project configuration
eas config

# Validate eas.json
eas build:configure --check
```

## Best Practices

### Version Management

1. **Automatic Version Management**
   - GitHub workflows now auto-increment versions using workflow run numbers (e.g., `0.0.123`)
   - You can also specify a custom version when manually triggering workflows
   - Local development uses fallback version `0.0.1` from [app.config.js](./app.config.js)

2. **Custom Versioning**
   - For production releases, specify semantic versions: `1.0.0`, `1.1.0`, `1.0.1`
   - When triggering workflows manually, use the version input field
   - Example: Trigger with version `1.2.0` for a major feature release

3. **Version via Environment Variable (Local)**
   ```bash
   # Set custom version locally
   APP_VERSION=1.0.0 ./deploy.sh build --platform ios --profile production
   APP_VERSION=1.0.1 ./deploy.sh update --channel production
   ```

4. **Use semantic versioning**: `MAJOR.MINOR.PATCH`
   - MAJOR: Breaking changes
   - MINOR: New features
   - PATCH: Bug fixes

### Testing Strategy

1. **Always test on staging first**
   - Deploy to staging channel
   - Have QA team verify
   - Then promote to production

2. **Test on real devices**
   - Use preview/staging builds
   - Test on multiple iOS/Android versions
   - Verify on different screen sizes

3. **Use OTA updates for non-breaking changes**
   - UI tweaks
   - Bug fixes
   - Content updates
   - Analytics changes

4. **Use full builds for breaking changes**
   - New dependencies
   - Native module changes
   - Major feature releases
   - App configuration changes

### Security

1. **Never commit secrets**
   - Use GitHub Secrets for sensitive data
   - Keep `.env` files in `.gitignore`
   - Use EAS Secrets for runtime secrets

2. **Rotate access tokens regularly**
   - Update `EXPO_TOKEN` every 90 days
   - Revoke old tokens

3. **Limit production access**
   - Use branch protection on `main`
   - Require PR reviews
   - Use environment-specific secrets

### Performance

1. **Optimize bundle size**
   ```bash
   # Analyze bundle
   npx expo export --dump-sourcemap
   ```

2. **Use OTA updates sparingly**
   - Large updates can be slow to download
   - Consider full build for major changes

3. **Monitor build times**
   - Use appropriate resource classes in eas.json
   - Consider build priority for urgent releases

## Additional Resources

- **Project Configuration**: [app.json](./app.json)
- **Build Configuration**: [eas.json](./eas.json)
- **Package Dependencies**: [package.json](./package.json)
- **GitHub Workflows**:
  - [deploy-mapp-build.yaml](../../.github/workflows/deploy-mapp-build.yaml)
  - [deploy-mapp-update.yaml](../../.github/workflows/deploy-mapp-update.yaml)

## Quick Reference

### Command Cheat Sheet

```bash
# Local development
npm start                                    # Start Expo dev server
npm run ios                                  # Run on iOS simulator
npm run android                              # Run on Android emulator

# Builds
./deploy.sh build --platform all --profile staging      # Staging build
./deploy.sh build --platform all --profile production   # Production build

# Updates
./deploy.sh update --channel staging                    # Staging OTA
./deploy.sh update --channel production                 # Production OTA

# Submit
./deploy.sh submit --platform all                       # Submit to stores

# EAS CLI
eas login                                    # Login to Expo
eas whoami                                   # Check current user
eas build:list                               # List recent builds
eas update:list                              # List recent updates
eas credentials                              # Manage credentials
```

### GitHub Actions Triggers

| Branch | Path | Workflow | Result |
|--------|------|----------|--------|
| `main` | `apps/mapp/**` | Update only | Staging OTA |
| Manual | N/A | Build | Custom environment/platform |
| Manual | N/A | Update | Custom channel/message |

---

**Last Updated**: 2025-11-12
**Maintainer**: HomeGeekAI Team
