import { doc, getDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '@asset-mem/common/firebase';
import { getExpoExtra } from '@/lib/expo-extra';
import { getNativeAppVersion } from '@/lib/native-app-version';
import { isVersionLessThan } from '@/lib/semver';

export type MobileAppUpdatePolicy = {
  minimumNativeVersion: string | null;
  forceOta: boolean;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
  message: string | null;
};

const EMPTY_POLICY: MobileAppUpdatePolicy = {
  minimumNativeVersion: null,
  forceOta: false,
  iosStoreUrl: null,
  androidStoreUrl: null,
  message: null,
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBool(value: unknown): boolean {
  return value === true;
}

function policyFromRecord(data: Record<string, unknown>): MobileAppUpdatePolicy {
  return {
    minimumNativeVersion: readString(data.minimumNativeVersion),
    forceOta: readBool(data.forceOta),
    iosStoreUrl: readString(data.iosStoreUrl),
    androidStoreUrl: readString(data.androidStoreUrl),
    message: readString(data.message),
  };
}

function defaultStoreUrlsFromExtra(): Pick<MobileAppUpdatePolicy, 'iosStoreUrl' | 'androidStoreUrl'> {
  const extra = getExpoExtra();
  return {
    iosStoreUrl: readString(extra.iosStoreUrl),
    androidStoreUrl: readString(extra.androidStoreUrl),
  };
}

export function getAppEnv(): string {
  const env = getExpoExtra().appEnv;
  return typeof env === 'string' && env.trim() ? env.trim() : 'staging';
}

/** Firestore: config/mobileApp with per-env fields (prod, staging, dev). */
export async function fetchMobileAppUpdatePolicy(): Promise<MobileAppUpdatePolicy> {
  const defaults = defaultStoreUrlsFromExtra();
  const appEnv = getAppEnv();

  try {
    const snap = await getDoc(doc(db, 'config', 'mobileApp'));
    if (!snap.exists()) {
      return { ...EMPTY_POLICY, ...defaults };
    }
    const root = snap.data() as Record<string, unknown>;
    const envRecord = root[appEnv];
    if (!envRecord || typeof envRecord !== 'object') {
      return { ...EMPTY_POLICY, ...defaults };
    }
    const remote = policyFromRecord(envRecord as Record<string, unknown>);
    return {
      ...EMPTY_POLICY,
      ...defaults,
      ...remote,
      iosStoreUrl: remote.iosStoreUrl ?? defaults.iosStoreUrl,
      androidStoreUrl: remote.androidStoreUrl ?? defaults.androidStoreUrl,
    };
  } catch {
    return { ...EMPTY_POLICY, ...defaults };
  }
}

export function isNativeUpdateRequired(
  policy: MobileAppUpdatePolicy,
  installedVersion = getNativeAppVersion()
): boolean {
  if (!policy.minimumNativeVersion) return false;
  return isVersionLessThan(installedVersion, policy.minimumNativeVersion);
}

export function getStoreUrlForPlatform(policy: MobileAppUpdatePolicy): string | null {
  if (Platform.OS === 'ios') return policy.iosStoreUrl;
  if (Platform.OS === 'android') return policy.androidStoreUrl;
  return policy.iosStoreUrl ?? policy.androidStoreUrl;
}
