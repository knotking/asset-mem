// Local dev only — EAS Build sets env from eas.json (avoid .env vs EAS APP_VERSION mismatch).
if (process.env.EAS_BUILD !== 'true') {
  require('dotenv').config();
}

// Proxy URLs: Cloud Run origin + route; auth is Firebase Bearer (not path secret).
/** Legacy: strip /{secret} from PROXY_BASE_URL when migrating from path-token URLs. */
function proxyPathSecret() {
  return (process.env.PROXY_PATH_SECRET || process.env.PROXY_TOKEN || '').trim();
}

const buildProxyUrl = (baseUrl, endpoint) => {
  if (!baseUrl) return undefined;
  const clean = baseUrl.replace(/\/$/, '');
  const secret = proxyPathSecret();
  const origin =
    secret && clean.endsWith(`/${secret}`) ? clean.slice(0, -(secret.length + 1)) : clean;
  return `${origin}/${endpoint}`;
};

const proxyBaseUrl = process.env.PROXY_BASE_URL;
const appEnv = process.env.APP_ENV || 'dev';

/** iOS URL scheme for @react-native-google-signin/google-signin — keep in sync with firebase-config iosClientId per env. */
const GOOGLE_IOS_CLIENT_ID_BY_ENV = {
  dev: '291418967332-jrt9s4laorjff7lk7oghitpi5eckg4up.apps.googleusercontent.com',
  staging: '291418967332-jrt9s4laorjff7lk7oghitpi5eckg4up.apps.googleusercontent.com',
  prod: '686746113874-b0002g07rkbatcdv45et44avs3p4hpbk.apps.googleusercontent.com',
};

function googleIosUrlScheme(iosClientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!iosClientId?.endsWith(suffix)) return undefined;
  return `com.googleusercontent.apps.${iosClientId.slice(0, -suffix.length)}`;
}

const googleIosUrlSchemeForBuild =
  googleIosUrlScheme(GOOGLE_IOS_CLIENT_ID_BY_ENV[appEnv] ?? GOOGLE_IOS_CLIENT_ID_BY_ENV.staging);

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
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'cover',
      backgroundColor: '#1a2332',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.assetmem.staging',
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
      package: process.env.ANDROID_PACKAGE || 'com.assetmem.staging',
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
        process.env.EXPO_PUBLIC_DEBUG_LOGS === 'true' ||
        process.env.EXPO_PUBLIC_DEBUG_LOGS === '1',
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
      url: `https://u.expo.dev/${process.env.EXPO_PROJECT_ID || '66c0400f-d590-4459-88a7-21ed4367854e'}`,
    },
  },
};
