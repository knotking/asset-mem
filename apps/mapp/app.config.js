// Load environment variables from .env file for local development
require('dotenv').config();

module.exports = {
  expo: {
    name: 'HomeGeekAI',
    slug: 'homegeek-ai',
    version: '0.0.1',
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
      bundleIdentifier: 'com.homegeekai.demo',
    },
    android: {
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#1a2332',
      },
      package: 'com.homegeekai.demo',
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
        projectId: '4d090ffd-6554-4652-9cb5-0ca6f02fb167',
      },
      // Environment-specific URLs
      // Local dev: Loaded from .env file (via dotenv)
      // EAS builds: Loaded from eas.json env configuration
      agentSessionUrl: process.env.AGENT_SESSION_URL,
      agentSseUrl: process.env.AGENT_SSE_URL,
      ragFileUploadUrl: process.env.RAG_FILE_UPLOAD_URL,
      documentAnalysisUrl: process.env.DOCUMENT_ANALYSIS_URL,
      webAppUrl: process.env.WEB_APP_URL,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/4d090ffd-6554-4652-9cb5-0ca6f02fb167',
    },
  },
};
