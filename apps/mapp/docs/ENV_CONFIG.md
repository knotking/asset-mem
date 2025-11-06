# Environment Configuration Guide

This document explains how environment-specific URLs are configured for different deployment environments.

## Overview

The app uses different API endpoints depending on the environment:

- **Local Development**: Uses `.env` file
- **EAS Builds**: Uses `eas.json` configuration

## Setup for Local Development

### 1. Create your `.env` file

```bash
cp .env.example .env
```

### 2. Configure your environment variables

Edit `.env` and set your development URLs:

```env
# Agent API URLs
AGENT_SESSION_URL=https://your-dev-proxy-url.com/agent-session
AGENT_SSE_URL=https://your-dev-proxy-url.com/firebase-agent-stream
RAG_FILE_UPLOAD_URL=https://your-dev-proxy-url.com/rag-file-upload
DOCUMENT_ANALYSIS_URL=https://your-dev-proxy-url.com/extract-doc-info

# Web App URL
WEB_APP_URL=https://your-dev-web-app.com
```

### 3. Start the development server

```bash
npm run dev
# or
npx expo start
```

The `.env` file will be automatically loaded by `dotenv`.

## EAS Build Profiles

For EAS builds, environment variables are configured in `eas.json` for each build profile.

### Available Profiles

#### Development

```bash
eas build --profile development --platform ios
```

- Uses development/staging URLs
- Includes development client
- Internal distribution

#### Staging

```bash
eas build --profile staging --platform ios
```

- Uses staging environment URLs
- Internal distribution
- **Note**: Update `YOUR_STAGING_TOKEN` in `eas.json` before building

#### Production

```bash
eas build --profile production --platform ios
```

- Uses production URLs
- App Store/Play Store distribution
- **Note**: Update `YOUR_PROD_TOKEN` in `eas.json` before building

### Updating EAS Environment Variables

Edit `eas.json` to update URLs for each profile:

```json
{
  "build": {
    "development": {
      "env": {
        "AGENT_SESSION_URL": "https://...",
        "AGENT_SSE_URL": "https://...",
        ...
      }
    }
  }
}
```

## How It Works

### Configuration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     app.config.js                           │
│  Loads environment variables via dotenv                     │
│  Exposes them in expo.extra                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     lib/api.ts                              │
│  Reads URLs from Constants.expoConfig.extra                 │
│  Uses them for API calls                                    │
└─────────────────────────────────────────────────────────────┘
```

### Environment Variable Priority

| Context   | Source                | Priority    |
| --------- | --------------------- | ----------- |
| Local Dev | `.env` file           | 1 (highest) |
| EAS Build | `eas.json` env config | 1 (highest) |
| Fallback  | Empty string `''`     | 2 (lowest)  |

**Note**: There are no hardcoded fallback URLs. You must provide environment variables via `.env` (local) or `eas.json` (EAS builds).

## Environment Variables Reference

| Variable                | Description                     | Example                                   |
| ----------------------- | ------------------------------- | ----------------------------------------- |
| `AGENT_SESSION_URL`     | Agent session creation endpoint | `https://proxy.com/agent-session`         |
| `AGENT_SSE_URL`         | Agent streaming endpoint        | `https://proxy.com/firebase-agent-stream` |
| `RAG_FILE_UPLOAD_URL`   | RAG file upload endpoint        | `https://proxy.com/rag-file-upload`       |
| `DOCUMENT_ANALYSIS_URL` | Document analysis endpoint      | `https://proxy.com/extract-doc-info`      |
| `WEB_APP_URL`           | Web app URL for sharing links   | `https://app.example.com`                 |

## Troubleshooting

### Error: "AGENT_SESSION_URL not set"

**Cause**: Missing `.env` file or empty environment variables.

**Solution**:

1. Ensure `.env` file exists in `apps/mapp/`
2. Verify all required variables are set in `.env`
3. Restart the Expo dev server

### EAS Build: URLs not working

**Cause**: Environment variables in `eas.json` not configured correctly.

**Solution**:

1. Check `eas.json` has correct URLs for your build profile
2. Replace placeholder tokens (`YOUR_STAGING_TOKEN`, `YOUR_PROD_TOKEN`)
3. Rebuild with `eas build --profile <profile-name>`

## Security Notes

- ✅ `.env` is in `.gitignore` - never commit it
- ✅ `.env.example` is safe to commit (contains no secrets)
- ✅ `eas.json` can be committed if URLs are not sensitive
- ⚠️ If your URLs contain sensitive tokens, consider using [EAS Secrets](https://docs.expo.dev/build-reference/variables/#using-secrets-in-environment-variables)

### Using EAS Secrets (Recommended for Sensitive Data)

```bash
# Set secrets
eas secret:create --scope project --name AGENT_SESSION_URL --value "your-url"

# Reference in eas.json
{
  "build": {
    "production": {
      "env": {
        "AGENT_SESSION_URL": "$AGENT_SESSION_URL"
      }
    }
  }
}
```

## Files Overview

| File            | Purpose                                 | Committed to Git |
| --------------- | --------------------------------------- | ---------------- |
| `.env`          | Local development environment variables | ❌ No            |
| `.env.example`  | Template for `.env`                     | ✅ Yes           |
| `eas.json`      | EAS build environment configuration     | ✅ Yes           |
| `app.config.js` | Expo configuration, loads env vars      | ✅ Yes           |
| `lib/api.ts`    | Consumes environment variables          | ✅ Yes           |

## Publishing Updates with EAS Update

EAS Update allows you to push over-the-air (OTA) updates to your app. This is useful for quick bug fixes and updates without requiring a full rebuild.

### Prerequisites

1. Install EAS CLI if you haven't already:

```bash
npm install -g eas-cli
```

2. Login to your Expo account:

```bash
eas login
```

3. Configure EAS Update in your project (if not already configured):

```bash
eas update:configure
```

### Publishing Updates

#### 1. Update Environment Configuration

Ensure your `.env` file has the correct environment variables for the environment you want to publish:

```bash
# Make sure .env is configured
cat .env
```

#### 2. Publish an Update

```bash
# Publish to the default branch (usually tied to your current git branch)
eas update --auto

# Publish to a specific branch
eas update --branch staging --message "Bug fixes for chat feature"
eas update --branch production --message "Production release v1.2.0"

# Publish to a specific channel (used by builds)
eas update --channel staging --message "Staging update"
eas update --channel production --message "Production update"
```

#### 3. Testing Updates

**On Expo Go (development):**
- Open your app in Expo Go
- Pull down to refresh to fetch the latest update
- Or restart the app

**On Development/Production Builds:**
- Open your app
- The update will be downloaded in the background
- Restart the app to apply the update

### Publishing with Different Environments

To publish with different environment configurations:

```bash
# Staging environment
# First update your .env with staging URLs, then:
eas update --channel staging --message "Staging update"

# Production environment
# First update your .env with production URLs, then:
eas update --channel production --message "Production release"
```

**Note**: EAS Update uses your `.env` file at publish time. Make sure to update `.env` with the appropriate URLs before publishing to different channels.

### Managing Published Updates

```bash
# View all updates
eas update:list

# View updates for a specific branch
eas update:list --branch staging

# View update details
eas update:view [update-id]

# Delete an update
eas update:delete [update-id]

# Republish a previous update
eas update:republish [update-id]
```

### Understanding Branches vs Channels

- **Branches**: Organize updates by development workflow (e.g., main, staging, production)
- **Channels**: Link your builds to update branches (configured in `eas.json`)

Example `eas.json` configuration:

```json
{
  "build": {
    "development": {
      "channel": "development",
      "developmentClient": true
    },
    "staging": {
      "channel": "staging"
    },
    "production": {
      "channel": "production"
    }
  }
}
```

### Important Notes

- **Environment Variables**: Updates will use environment variables from your `.env` file at publish time
- **Channels**: Each build profile should have a corresponding channel for receiving updates
- **OTA Updates**: Only JavaScript and asset changes can be updated. Native code changes require a new build
- **Automatic Updates**: By default, updates are fetched automatically when the app starts
- **Rollbacks**: You can roll back by republishing a previous update

### Sharing Updates with Your Team

After publishing an update, share the details:

```bash
# Get update group ID from the publish output, then share:
Update group ID: <update-group-id>
Branch: staging
Message: "Bug fixes for chat feature"
```

Team members with builds configured to the same channel will automatically receive the update.

### Troubleshooting

#### "No builds found for this project"

- You need to create at least one build with `eas build` before publishing updates
- Make sure your builds are configured with channels in `eas.json`

#### Updates not appearing

- Check that your build's channel matches the update channel
- Verify the update was published successfully with `eas update:list`
- Try restarting the app completely

#### Environment variables not updating

- Remember to update `.env` before publishing the update
- Republish with `eas update` after changing environment variables
- Clear app data and reinstall if issues persist

## Quick Reference

```bash
# Local development
npm run dev                                    # Uses .env

# Publishing updates with EAS Update
eas login                                      # Login to Expo account
eas update:configure                           # Configure EAS Update (first time)
eas update --auto                              # Publish to default branch
eas update --channel staging                   # Publish to staging channel
eas update --channel production                # Publish to production channel
eas update:list                                # View update history
eas update:list --branch staging               # View updates for specific branch

# EAS builds
eas build --profile development --platform ios # Uses eas.json (development)
eas build --profile staging --platform ios     # Uses eas.json (staging)
eas build --profile production --platform ios  # Uses eas.json (production)

# Managing EAS secrets
eas secret:list                                # List all secrets
eas secret:create --scope project              # Create new secret
eas secret:delete --name SECRET_NAME           # Delete a secret
```

## Additional Resources

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- [EAS Secrets](https://docs.expo.dev/build-reference/variables/)
