import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type ExpoApplicationModule = {
  nativeApplicationVersion?: string | null;
  nativeBuildVersion?: string | null;
};

/** Linked at EAS/prebuild time; null on dev clients built before expo-application was added. */
const ExpoApplication = requireOptionalNativeModule<ExpoApplicationModule>('ExpoApplication');

function getConfigAppVersion(): string | null {
  return Constants.expoConfig?.version?.trim() || null;
}

function getConfigBuildVersion(): string | null {
  const config = Constants.expoConfig;
  if (!config) return null;

  if (Platform.OS === 'ios') {
    const fromConfig = config.ios?.buildNumber?.trim();
    if (fromConfig) return fromConfig;

    const fromPlatform = Constants.platform?.ios?.buildNumber?.trim();
    return fromPlatform || null;
  }

  if (Platform.OS === 'android') {
    const versionCode = config.android?.versionCode;
    if (versionCode != null) return String(versionCode);
  }

  return null;
}

/** Native app version (App Store / Play versionName), not OTA runtime. */
export function getNativeAppVersion(): string {
  const fromNative = ExpoApplication?.nativeApplicationVersion?.trim();
  if (fromNative) return fromNative;

  return getConfigAppVersion() || '0.0.1';
}

/** Native build number (iOS CFBundleVersion / Android versionCode). */
export function getNativeBuildVersion(): string | null {
  const fromNative = ExpoApplication?.nativeBuildVersion?.trim();
  if (fromNative) return fromNative;

  return getConfigBuildVersion();
}
