// Local dev only — EAS Build sets env from eas.json (avoid .env vs EAS APP_VERSION mismatch).
if (process.env.EAS_BUILD !== 'true') {
  require('dotenv').config();
}

// Proxy URLs: Cloud Run origin + route; auth is Firebase Bearer (not path secret).
const buildProxyUrl = (baseUrl, endpoint) => {
  if (!baseUrl) return undefined;
  const origin = baseUrl.replace(/\/$/, '');
  return `${origin}/${endpoint}`;
};

const proxyBaseUrl = process.env.PROXY_BASE_URL;
const appEnv = process.env.APP_ENV || 'dev';

/** iOS URL scheme for @react-native-google-signin/google-signin — keep in sync with firebase-config iosClientId per env. */
const GOOGLE_IOS_CLIENT_ID_BY_ENV = {
  dev: '291418967332-42nd4f964tf4fn418ujhpm8sts2ca5kq.apps.googleusercontent.com',
  staging: '291418967332-k75961692hifn2d107agkknl4as4fa4q.apps.googleusercontent.com',
  prod: '686746113874-ubpn67uvhogvsvfgn5fkkvm6kj2lcfu4.apps.googleusercontent.com',
};

function googleIosUrlScheme(iosClientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!iosClientId?.endsWith(suffix)) return undefined;
  return `com.googleusercontent.apps.${iosClientId.slice(0, -suffix.length)}`;
}

const googleIosUrlSchemeForBuild = googleIosUrlScheme(
  GOOGLE_IOS_CLIENT_ID_BY_ENV[appEnv] ?? GOOGLE_IOS_CLIENT_ID_BY_ENV.staging
);

const STORE_URLS_BY_ENV = {
  prod: {
    iosStoreUrl: 'https://apps.apple.com/app/id6774020500',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.assetmem.app',
  },
  staging: {
    iosStoreUrl: null,
    androidStoreUrl: null,
  },
  dev: {
    iosStoreUrl: null,
    androidStoreUrl: null,
  },
};

const storeUrls = STORE_URLS_BY_ENV[appEnv] ?? STORE_URLS_BY_ENV.staging;

module.exports = {
  expo: {
    name: appEnv === 'prod' ? 'AssetMem AI' : `AssetMem AI (${appEnv})`,
    // Slug must match the Expo project on expo.dev (see extra.eas.projectId). Store package uses ANDROID_PACKAGE.
    slug: process.env.APP_SLUG || 'assetmem-staging',
    // Drives expo.version and runtimeVersion (policy: appVersion). Set APP_VERSION in eas.json per profile.
    version: process.env.APP_VERSION || '0.0.1',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: process.env.APP_SCHEME || 'assetmem',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    privacy: 'hidden',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      usesAppleSignIn: true,
      bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.assetmem.staging',
      infoPlist: {
        NSCameraUsageDescription:
          'This app needs access to your camera to take photos and record videos for property documentation.',
        NSMicrophoneUsageDescription:
          'This app needs access to your microphone to record videos with audio.',
        NSPhotoLibraryUsageDescription:
          'This app needs access to your photo library to select photos and videos for property documentation.',
        NSPhotoLibraryAddUsageDescription:
          'This app needs access to save photos and videos to your photo library.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#0a0a0f',
      },
      package: process.env.ANDROID_PACKAGE || 'com.assetmem.staging',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      [
        'expo-build-properties',
        {
          ios: {
            extraPods: [
              { name: 'GoogleUtilities', modular_headers: true },
              { name: 'RecaptchaInterop', modular_headers: true },
            ],
          },
        },
      ],
      [
        'expo-splash-screen',
        {
          // Match LANDING_BACKGROUND in lib/landing-background.ts
          backgroundColor: '#0a0a0f',
          image: './assets/images/splash.png',
          imageWidth: 180,
          resizeMode: 'contain',
          ios: {
            backgroundColor: '#0a0a0f',
            image: './assets/images/splash.png',
          },
          android: {
            backgroundColor: '#0a0a0f',
            image: './assets/images/splash.png',
          },
        },
      ],
      'expo-router',
      '@react-native-community/datetimepicker',
      'expo-apple-authentication',
      'expo-web-browser',
      'expo-video',
      [
        'expo-image-picker',
        {
          photosPermission:
            'This app needs access to your photo library to select photos and videos for property documentation.',
          cameraPermission:
            'This app needs access to your camera to take photos and record videos for property documentation.',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'This app uses your location to attach property address context to your home records.',
        },
      ],
      googleIosUrlSchemeForBuild
        ? [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: googleIosUrlSchemeForBuild },
          ]
        : '@react-native-google-signin/google-signin',
      [
        'expo-navigation-bar',
        {
          enforceContrast: false,
          barStyle: 'light',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: process.env.EXPO_PROJECT_ID || '66c0400f-d590-4459-88a7-21ed4367854e',
      },
      appEnv,
      /** When true, emit debug/info logs in release builds (see lib/logger.ts). */
      debugLogs:
        process.env.EXPO_PUBLIC_DEBUG_LOGS === 'true' || process.env.EXPO_PUBLIC_DEBUG_LOGS === '1',
      agentSessionUrl: buildProxyUrl(proxyBaseUrl, 'agent-session'),
      agentSseUrl: buildProxyUrl(proxyBaseUrl, 'firebase-agent-stream'),
      ragFileUploadUrl: buildProxyUrl(proxyBaseUrl, 'rag-file-upload'),
      documentAnalysisUrl: buildProxyUrl(proxyBaseUrl, 'extract-doc-info'),
      checkpointAnalysisUrl: buildProxyUrl(proxyBaseUrl, 'analyze-checkpoint'),
      checkpointComparisonUrl: buildProxyUrl(proxyBaseUrl, 'compare-checkpoints'),
      reportsPreviewUrl: buildProxyUrl(proxyBaseUrl, 'reports/preview'),
      reportsPreviewHtmlUrl: buildProxyUrl(proxyBaseUrl, 'reports/preview-html'),
      reportsStatusUrl: buildProxyUrl(proxyBaseUrl, 'reports/status'),
      reportsGenerateUrl: buildProxyUrl(proxyBaseUrl, 'reports/generate'),
      reportsSignedUrl: buildProxyUrl(proxyBaseUrl, 'reports/signed-url'),
      reportsMetadataUrl: buildProxyUrl(proxyBaseUrl, 'reports/metadata'),
      reportsShareUrl: buildProxyUrl(proxyBaseUrl, 'reports/share'),
      reportsRagIndexUrl: buildProxyUrl(proxyBaseUrl, 'reports/rag-index'),
      /** Feature flag: show “Include in Docs chat” on reports (EXPO_PUBLIC_REPORT_DOCS_CHAT_RAG). */
      reportDocsChatRagEnabled:
        process.env.EXPO_PUBLIC_REPORT_DOCS_CHAT_RAG === 'true' ||
        process.env.EXPO_PUBLIC_REPORT_DOCS_CHAT_RAG === '1',
      reportsPublicSignedUrl: buildProxyUrl(proxyBaseUrl, 'reports/public-signed-url'),
      tokenQuotaStatusUrl: buildProxyUrl(proxyBaseUrl, 'token-quota-status'),
      billingB2cCheckoutUrl: buildProxyUrl(proxyBaseUrl, 'billing/b2c/checkout-session'),
      billingB2cPortalUrl: buildProxyUrl(proxyBaseUrl, 'billing/b2c/portal-session'),
      mobileWebHandoffUrl: buildProxyUrl(proxyBaseUrl, 'auth/mobile-web-handoff'),
      webAppUrl: process.env.WEB_APP_URL,
      iosStoreUrl: storeUrls.iosStoreUrl ?? undefined,
      androidStoreUrl: storeUrls.androidStoreUrl ?? undefined,
      supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'hello@asset-mem.com',
      enterpriseEmail: process.env.EXPO_PUBLIC_ENTERPRISE_EMAIL?.trim() || undefined,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: `https://u.expo.dev/${process.env.EXPO_PROJECT_ID || '66c0400f-d590-4459-88a7-21ed4367854e'}`,
    },
  },
};
