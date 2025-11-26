// Load environment variables from .env file for local development
require('dotenv').config();

// Helper function to build proxy URLs
const buildProxyUrl = (baseUrl, token, endpoint) => {
  if (!baseUrl || !token) return undefined;
  return `${baseUrl}/${token}/${endpoint}`;
};

const proxyBaseUrl = process.env.PROXY_BASE_URL;
const proxyToken = process.env.PROXY_TOKEN;

module.exports = {
  expo: {
    name: 'HomeGeekAI',
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
        NSLocationWhenInUseUsageDescription: 'This app needs access to your location to find nearby service providers when property address is not available.',
      },
    },
    android: {
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#1a2332',
      },
      package: process.env.ANDROID_PACKAGE || 'com.homegeekai.staging',
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
      ],
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
      // Environment-specific URLs
      // Local dev: Loaded from .env file (via dotenv)
      // EAS builds: Built from PROXY_BASE_URL + PROXY_TOKEN from eas.json
      agentSessionUrl: buildProxyUrl(proxyBaseUrl, proxyToken, 'agent-session'),
      agentSseUrl: buildProxyUrl(proxyBaseUrl, proxyToken, 'firebase-agent-stream'),
      ragFileUploadUrl: buildProxyUrl(proxyBaseUrl, proxyToken, 'rag-file-upload'),
      documentAnalysisUrl: buildProxyUrl(proxyBaseUrl, proxyToken, 'extract-doc-info'),
      webAppUrl: process.env.WEB_APP_URL,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: `https://u.expo.dev/${process.env.EXPO_PROJECT_ID || 'cc06df81-5ad0-4fc3-ad59-6294c95e4614'}`,
    },
  },
};
