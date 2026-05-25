# Mobile Application Deployment

This guide covers deploying the React Native mobile application using Expo Application Services (EAS).

## Overview

The mobile application is a React Native/Expo application with:

- Cross-platform support (iOS and Android)
- Over-the-Air (OTA) updates
- Native modules integration
- Firebase integration
- Real-time chat functionality

**Deployment Platform**: Expo Application Services (EAS)  
**Technology**: React Native, Expo SDK, TypeScript  
**Location**: `apps/mapp/`

## Environments

### Development

- **Purpose**: Local development and testing
- **Channel**: `development`
- **Bundle ID (iOS)**: `com.assetmem.dev`
- **Package (Android)**: `com.assetmem.dev`
- **Expo slug**: `assetmem-dev`
- **Build Type**: Development client with simulator support

### Staging

- **Purpose**: Internal testing and QA
- **Channel**: `staging`
- **Bundle ID (iOS)**: `com.assetmem.staging`
- **Package (Android)**: `com.assetmem.staging`
- **Expo slug**: `assetmem-staging`
- **Build Type**: Internal distribution (iOS ad hoc / Android APK)
- **Webapp URL**: https://staging--homegeek-staging.us-central1.hosted.app
- **Device test**: [STAGING_DEVICE_TEST.md](../../apps/mapp/docs/STAGING_DEVICE_TEST.md) (Android) · [STAGING_DEVICE_TEST_IOS.md](../../apps/mapp/docs/STAGING_DEVICE_TEST_IOS.md) (iPhone)

### Production

- **Purpose**: App Store/Play Store releases
- **Channel**: `prod`
- **Bundle ID (iOS)**: `com.assetmem.app`
- **Package (Android)**: `com.assetmem.app`
- **Expo slug**: `assetmem-app` (see `APP_SLUG` in eas.json)
- **Build Type**: Store distribution
- **Webapp URL**: https://asset-mem.com

## Prerequisites

### Required Tools

```bash
# Install Node.js 20+
# Download from https://nodejs.org/

# Install EAS CLI
npm install -g eas-cli

# Verify installation
eas --version
node --version
```

### Authentication

```bash
# Login to Expo
eas login

# Verify authentication
eas whoami
```

### Required Accounts

- **Expo Account**: For EAS builds and updates
- **Apple Developer Account**: For iOS builds and App Store submission
- **Google Play Console Account**: For Android builds and Play Store submission

### Platform-Specific Setup

#### iOS Setup

1. **Apple Developer Account**
   - Enroll in Apple Developer Program ($99/year)
   - Create App ID in Apple Developer Portal
   - Configure signing certificates

2. **App Store Connect**
   - Create app in App Store Connect
   - Configure app metadata
   - Set up TestFlight for beta testing

#### Android Setup

1. **Google Play Console**
   - Create developer account ($25 one-time)
   - Create app in Play Console
   - Configure app metadata

2. **Keystore**
   - EAS automatically manages keystores
   - Or provide your own keystore

## Configuration

### eas.json

Location: `apps/mapp/eas.json`

```json
{
  "cli": {
    "version": ">= 16.26.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "env": {
        "APP_ENV": "dev",
        "PROXY_BASE_URL": "https://homecare-agent-proxy-dev-*.run.app",
        "WEB_APP_URL": "https://staging--homegeek-staging.us-central1.hosted.app"
      }
    },
    "staging": {
      "distribution": "internal",
      "channel": "staging",
      "env": {
        "APP_ENV": "staging",
        "PROXY_BASE_URL": "https://homecare-agent-proxy-staging-*.run.app",
        "WEB_APP_URL": "https://staging--homegeek-staging.us-central1.hosted.app"
      }
    },
    "prod": {
      "distribution": "store",
      "autoIncrement": true,
      "channel": "prod",
      "env": {
        "APP_ENV": "prod",
        "PROXY_BASE_URL": "https://homecare-agent-proxy-prod-*.run.app",
        "WEB_APP_URL": "https://prod--homegeek-prod.us-central1.hosted.app"
      }
    }
  },
  "submit": {
    "prod": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-id",
        "appleTeamId": "your-apple-team-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### app.config.js

Dynamic configuration based on environment:

```javascript
export default ({ config }) => {
  const env = process.env.APP_ENV || "dev";

  return {
    ...config,
    name: env === "prod" ? "AssetMem AI" : `AssetMem AI (${env})`,
    slug: process.env.APP_SLUG || "assetmem-staging",
    ios: {
      bundleIdentifier: process.env.IOS_BUNDLE_ID || "com.assetmem.staging",
    },
    android: {
      package: process.env.ANDROID_PACKAGE || "com.assetmem.staging",
    },
    extra: {
      proxyBaseUrl: process.env.PROXY_BASE_URL,
      webAppUrl: process.env.WEB_APP_URL,
      eas: {
        projectId: process.env.EXPO_PROJECT_ID,
      },
    },
  };
};
```

## Deployment Methods

### Method 1: Deployment Script (Recommended)

**Script Location**: `apps/mapp/deploy.sh`

#### Build for App Stores

```bash
cd apps/mapp

# Build for both platforms (production)
./deploy.sh build --platform all --profile prod

# Build for iOS only
./deploy.sh build --platform ios --profile prod

# Build for Android only
./deploy.sh build --platform android --profile prod

# Build for staging
./deploy.sh build --platform all --profile staging
```

#### Publish OTA Update

```bash
# Update staging
./deploy.sh update --channel staging --message "Bug fixes and improvements"

# Update production
./deploy.sh update --channel prod --message "New features release"
```

#### Submit to App Stores

```bash
# Submit to both stores
./deploy.sh submit --platform all

# Submit to App Store only
./deploy.sh submit --platform ios

# Submit to Play Store only
./deploy.sh submit --platform android
```

### Method 2: GitHub Actions

**Workflow Files**:

- `.github/workflows/deploy-mapp-build.yaml` - Build native apps
- `.github/workflows/deploy-mapp-update.yaml` - Publish OTA updates

#### Trigger Build

1. Go to GitHub → Actions
2. Select "Deploy Mapp - Build" workflow
3. Click "Run workflow"
4. Select:
   - Environment (staging/prod)
   - Platform (ios/android/all)
   - Profile (staging/prod)
5. Click "Run workflow"

#### Trigger OTA Update

1. Go to GitHub → Actions
2. Select "Deploy Mapp - Update" workflow
3. Click "Run workflow"
4. Select:
   - Environment (staging/prod)
   - Update message
5. Click "Run workflow"

### Method 3: Manual EAS Commands

#### Build Commands

```bash
cd apps/mapp

# Development build
eas build --platform ios --profile development
eas build --platform android --profile development

# Staging build
eas build --platform ios --profile staging
eas build --platform android --profile staging

# Production build
eas build --platform ios --profile prod
eas build --platform android --profile prod
```

#### Update Commands

```bash
# Publish OTA update
eas update --channel staging --message "Bug fixes"
eas update --channel prod --message "New features"

# Publish to specific branch
eas update --branch staging --message "Testing new feature"
```

#### Submit Commands

```bash
# Submit to App Store
eas submit --platform ios --profile prod --latest

# Submit to Play Store
eas submit --platform android --profile prod --latest
```

## Build Process

### Build Types

#### 1. Development Build

- **Purpose**: Local development with Expo Dev Client
- **Features**: Fast refresh, debugging, development tools
- **Distribution**: Internal only
- **Build Time**: ~15-20 minutes

#### 2. Preview Build

- **Purpose**: Internal testing and QA
- **Features**: Production-like build without store submission
- **Distribution**: Internal (TestFlight, Internal Testing)
- **Build Time**: ~20-30 minutes

#### 3. Production Build

- **Purpose**: App Store/Play Store release
- **Features**: Optimized, signed, ready for distribution
- **Distribution**: Public stores
- **Build Time**: ~20-30 minutes

### Build Workflow

1. **Code Preparation**
   - Commit all changes
   - Update version in app.config.js
   - Update CHANGELOG

2. **Trigger Build**
   - Via script, GitHub Actions, or EAS CLI
   - Select platform and profile
   - Wait for build to complete

3. **Build Execution**
   - EAS creates build job
   - Installs dependencies
   - Compiles native code
   - Signs application
   - Uploads to EAS servers

4. **Build Completion**
   - Download build artifact
   - Install on device for testing
   - Or submit directly to stores

### Build Monitoring

```bash
# List recent builds
eas build:list

# View specific build
eas build:view BUILD_ID

# View build logs
eas build:view BUILD_ID --logs

# Cancel running build
eas build:cancel BUILD_ID
```

## Over-the-Air (OTA) Updates

### What are OTA Updates?

OTA updates allow you to push JavaScript/asset changes without rebuilding the native app:

- **Fast**: Updates deploy in seconds
- **No Review**: Bypass app store review process
- **Instant**: Users get updates immediately
- **Limitations**: Cannot update native code or dependencies

### When to Use OTA Updates

**Use OTA for**:

- Bug fixes in JavaScript code
- UI/UX improvements
- Content updates
- Configuration changes
- Non-native feature additions

**Rebuild Native App for**:

- Native dependency updates
- Expo SDK version changes
- Native module additions
- Build configuration changes
- App permissions changes

### Publishing Updates

```bash
cd apps/mapp

# Staging update
eas update --channel staging --message "Fixed login bug"

# Production update
eas update --channel prod --message "Performance improvements"

# Update with specific branch
eas update --branch feature-x --message "Testing new feature"
```

### Update Channels

- **development**: Development builds
- **staging**: Staging/QA builds
- **prod**: Production builds

Builds automatically receive updates from their configured channel.

### Update Monitoring

```bash
# List updates
eas update:list

# View specific update
eas update:view UPDATE_ID

# Rollback to previous update
eas update:rollback --channel prod
```

## App Store Submission

### iOS App Store

#### Prerequisites

1. App created in App Store Connect
2. App metadata configured
3. Screenshots prepared
4. App privacy details filled

#### Submission Process

**Via EAS CLI**:

```bash
cd apps/mapp

# Submit latest production build
eas submit --platform ios --profile prod --latest

# Submit specific build
eas submit --platform ios --profile prod --id BUILD_ID
```

**Via Script**:

```bash
./deploy.sh submit --platform ios
```

**Manual Process**:

1. Build app with production profile
2. Download IPA from EAS
3. Upload to App Store Connect via Transporter
4. Submit for review in App Store Connect

#### TestFlight Distribution

```bash
# Build automatically uploads to TestFlight
eas build --platform ios --profile prod

# Add testers in App Store Connect
# Share TestFlight link with testers
```

### Android Play Store

#### Prerequisites

1. App created in Play Console
2. App metadata configured
3. Screenshots prepared
4. Content rating completed
5. Service account JSON key

#### Submission Process

**Via EAS CLI**:

```bash
cd apps/mapp

# Submit latest production build
eas submit --platform android --profile prod --latest

# Submit to specific track
eas submit --platform android --profile prod --latest --track internal
```

**Via Script**:

```bash
./deploy.sh submit --platform android
```

**Manual Process**:

1. Build app with production profile
2. Download AAB from EAS
3. Upload to Play Console
4. Submit for review

#### Testing Tracks

- **Internal**: Quick testing (up to 100 testers)
- **Closed**: Closed beta testing
- **Open**: Open beta testing
- **Production**: Public release

## Version Management

### Versioning Strategy

Follow semantic versioning: `MAJOR.MINOR.PATCH`

```javascript
// app.config.js
export default {
  version: "1.2.3",
  ios: {
    buildNumber: "123", // Auto-incremented by EAS
  },
  android: {
    versionCode: 123, // Auto-incremented by EAS
  },
};
```

### Auto-Increment

EAS can auto-increment build numbers:

```json
// eas.json
{
  "build": {
    "prod": {
      "autoIncrement": true
    }
  }
}
```

### Version Updates

1. Update `version` in app.config.js
2. Commit changes
3. Tag release in Git: `git tag v1.2.3`
4. Build and submit

## Monitoring and Analytics

### Build Monitoring

**EAS Dashboard**:

- View all builds: https://expo.dev/accounts/[account]/projects/assetmem-staging/builds
- Monitor build status
- Download build artifacts
- View build logs

**CLI Monitoring**:

```bash
# List builds
eas build:list --limit 10

# Watch build progress
eas build:view BUILD_ID --wait
```

### Update Monitoring

**EAS Dashboard**:

- View updates: https://expo.dev/accounts/[account]/projects/assetmem-staging/updates
- Monitor update adoption
- View update manifests

**CLI Monitoring**:

```bash
# List updates
eas update:list --channel prod

# View update details
eas update:view UPDATE_ID
```

### Runtime Monitoring

Integrate analytics and error tracking:

- **Sentry**: Error tracking and performance monitoring
- **Firebase Analytics**: User behavior and events
- **Custom logging**: Application-specific metrics

## Troubleshooting

### Build Failures

#### Common Issues

**1. Dependency Resolution Errors**

```bash
# Clear cache and reinstall
cd apps/mapp
rm -rf node_modules package-lock.json
npm install

# Clear Expo cache
npx expo start --clear
```

**2. Native Module Errors**

```bash
# Ensure all native dependencies are in dependencies, not devDependencies
# Rebuild with clean cache
eas build --platform ios --profile prod --clear-cache
```

**3. Signing Errors (iOS)**

```bash
# Clear credentials and regenerate
eas credentials --platform ios

# Or let EAS manage credentials automatically
# (recommended for most cases)
```

**4. Keystore Errors (Android)**

```bash
# Clear credentials and regenerate
eas credentials --platform android
```

### OTA Update Issues

**Updates Not Applying**:

1. Check update channel matches build channel
2. Verify app is connected to internet
3. Force close and reopen app
4. Check update compatibility

**Rollback Update**:

```bash
# Rollback to previous update
eas update:rollback --channel prod

# Or publish previous version again
eas update --channel prod --message "Rollback to v1.2.2"
```

### Submission Issues

**iOS Rejection**:

- Review rejection reasons in App Store Connect
- Address issues mentioned
- Resubmit with fixes

**Android Rejection**:

- Review rejection reasons in Play Console
- Fix issues
- Upload new build

## Best Practices

### 1. Testing Strategy

- Test on physical devices, not just simulators
- Test on multiple device sizes and OS versions
- Use TestFlight/Internal Testing before production
- Perform regression testing

### 2. Version Control

- Tag releases in Git
- Maintain CHANGELOG
- Use semantic versioning
- Document breaking changes

### 3. Deployment Strategy

- Always deploy to staging first
- Test thoroughly before production
- Use OTA updates for quick fixes
- Rebuild native app for major updates

### 4. Monitoring

- Monitor build success rates
- Track update adoption
- Monitor crash reports
- Review user feedback

### 5. Security

- Never commit credentials
- Use environment variables for secrets
- Rotate API keys regularly
- Enable app signing by EAS

## CI/CD Integration

### GitHub Actions Workflows

**Build Workflow**: `.github/workflows/deploy-mapp-build.yaml`

- Triggered manually
- Builds native apps
- Uploads to EAS

**Update Workflow**: `.github/workflows/deploy-mapp-update.yaml`

- Triggered manually or on push
- Publishes OTA updates
- Fast deployment

### Required GitHub Secrets (per environment)

- `EXPO_TOKEN`: Expo authentication token

### Required GitHub Variables (per environment)

- `EXPO_ACCOUNT`: Expo account slug (used in build summary links)

`EXPO_PROJECT_ID` and other app env values live in `apps/mapp/eas.json` per build profile.

## Local Development

### Running Development Build

```bash
cd apps/mapp

# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android

# Run on physical device
# Scan QR code with Expo Go app
```

### Testing Production Build Locally

```bash
# Build development client
eas build --platform ios --profile development --local

# Install on simulator/device
# Then run development server
npx expo start --dev-client
```

## Related Documentation

- [Expo EAS Documentation](https://docs.expo.dev/eas/)
- [React Native Documentation](https://reactnative.dev/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Play Store Policies](https://play.google.com/about/developer-content-policy/)
- [CI/CD Pipeline Documentation](./CICD.md)
