// Load environment variables from .env file for local development
require('dotenv').config();

// Proxy URLs: base origin only; clients send Firebase ID token (Phase 2.1).
const buildProxyUrl = (baseUrl, endpoint) => {
  if (!baseUrl) return undefined;
  const clean = baseUrl.replace(/\/$/, '');
  const secret = process.env.PROXY_PATH_SECRET?.trim();
  const origin =
    secret && clean.endsWith(`/${secret}`) ? clean.slice(0, -(secret.length + 1)) : clean;
  return `${origin}/${endpoint}`;
};

const proxyBaseUrl = process.env.PROXY_BASE_URL;

module.exports = {
  expo: {
    name: 'AssetMem AI',
    slug: process.env.APP_SLUG || 'homegeekai-staging',
    version: process.env.APP_VERSION || '0.0.1',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'homegeekai',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    privacy: 'hidden',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'cover',
      backgroundColor: '#1a2332',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.homegeekai.staging',
      infoPlist: {
        NSCameraUsageDescription: 'This app needs access to your camera to take photos and record videos for property documentation.',
        NSMicrophoneUsageDescription: 'This app needs access to your microphone to record videos with audio.',
        NSPhotoLibraryUsageDescription: 'This app needs access to your photo library to select photos and videos for property documentation.',
        NSPhotoLibraryAddUsageDescription: 'This app needs access to save photos and videos to your photo library.',
      },
    },
    android: {
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#1a2332',
      },
      package: process.env.ANDROID_PACKAGE || 'com.homegeekai.staging',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-web-browser',
      'expo-video',
      [
        'expo-image-picker',
        {
          photosPermission: 'This app needs access to your photo library to select photos and videos for property documentation.',
          cameraPermission: 'This app needs access to your camera to take photos and record videos for property documentation.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: process.env.EXPO_PROJECT_ID || 'cc06df81-5ad0-4fc3-ad59-6294c95e4614',
      },
      // Environment
      appEnv: process.env.APP_ENV || 'dev',
      /** When true, emit debug/info logs in release builds (see lib/logger.ts). */
      debugLogs:
        process.env.EXPO_PUBLIC_DEBUG_LOGS === 'true' ||
        process.env.EXPO_PUBLIC_DEBUG_LOGS === '1',
      // Environment-specific URLs
      // Local dev: Loaded from .env file (via dotenv)
      // EAS builds: Built from PROXY_BASE_URL + PROXY_TOKEN from eas.json
      agentSessionUrl: buildProxyUrl(proxyBaseUrl, 'agent-session'),
      agentSseUrl: buildProxyUrl(proxyBaseUrl, 'firebase-agent-stream'),
      ragFileUploadUrl: buildProxyUrl(proxyBaseUrl, 'rag-file-upload'),
      documentAnalysisUrl: buildProxyUrl(proxyBaseUrl, 'extract-doc-info'),
      checkpointAnalysisUrl: buildProxyUrl(proxyBaseUrl, 'analyze-checkpoint'),
      checkpointComparisonUrl: buildProxyUrl(proxyBaseUrl, 'compare-checkpoints'),
      tokenQuotaStatusUrl: buildProxyUrl(proxyBaseUrl, 'token-quota-status'),
      billingB2cCheckoutUrl: buildProxyUrl(proxyBaseUrl, 'billing/b2c/checkout-session'),
      billingB2cPortalUrl: buildProxyUrl(proxyBaseUrl, 'billing/b2c/portal-session'),
      mobileWebHandoffUrl: buildProxyUrl(proxyBaseUrl, 'auth/mobile-web-handoff'),
      webAppUrl: process.env.WEB_APP_URL,
      supportEmail:
        process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@homegeek.ai',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: `https://u.expo.dev/${process.env.EXPO_PROJECT_ID || 'cc06df81-5ad0-4fc3-ad59-6294c95e4614'}`,
    },
  },
};
