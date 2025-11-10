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
    plugins: ['expo-router', 'expo-web-browser', 'expo-video'],
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
