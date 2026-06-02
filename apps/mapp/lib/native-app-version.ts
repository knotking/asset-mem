import Constants from 'expo-constants';

/** Native app version (App Store / Play versionName), not OTA runtime. */
export function getNativeAppVersion(): string {
  const fromNative = Constants.nativeAppVersion?.trim();
  if (fromNative) return fromNative;

  return Constants.expoConfig?.version?.trim() || '0.0.1';
}
