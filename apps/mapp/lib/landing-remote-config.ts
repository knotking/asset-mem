/** Keep fetch keys and fallbacks aligned with apps/webapp/src/lib/landing-remote-config.ts */

import { ensureFirebaseRemoteConfigEnvironment } from './firebase-remote-config-setup';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import { app } from '@asset-mem/common/firebase';
import Constants from 'expo-constants';
import {
  DEFAULT_LANDING_DEMO_VIDEO_URLS,
  LANDING_DEMO_DESKTOP_URL_PARAM,
  LANDING_DEMO_MOBILE_URL_PARAM,
  type LandingDemoVideoUrls,
} from '@/lib/landing-demo-video-constants';
import {
  ENTERPRISE_EMAIL_REMOTE_PARAM,
  SUPPORT_EMAIL_REMOTE_PARAM,
  DEFAULT_SUPPORT_EMAIL,
  getEnterpriseConfigFromEnv,
  type EnterpriseConfig,
} from '@/lib/enterprise-config';
import { createLogger } from '@/lib/logger';

export type LandingRemoteConfig = {
  demoVideos: LandingDemoVideoUrls;
  enterprise: EnterpriseConfig;
};

const log = createLogger('LandingRemoteConfig');

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const getMinimumFetchIntervalMillis = (): number => {
  const env = Constants.expoConfig?.extra?.appEnv as string | undefined;
  const isDev =
    typeof __DEV__ !== 'undefined' && __DEV__ ? true : env !== 'prod';
  if (isDev) {
    return 0;
  }
  return 60 * 60 * 1000;
};

let inflightFetch: Promise<LandingRemoteConfig> | null = null;

export async function fetchLandingRemoteConfig(): Promise<LandingRemoteConfig> {
  if (!inflightFetch) {
    inflightFetch = (async () => {
      ensureFirebaseRemoteConfigEnvironment();
      const envEnterprise = getEnterpriseConfigFromEnv();
      const remoteConfig = getRemoteConfig(app);

      remoteConfig.settings = {
        fetchTimeoutMillis: 10 * 1000,
        minimumFetchIntervalMillis: getMinimumFetchIntervalMillis(),
      };
      remoteConfig.defaultConfig = {
        [LANDING_DEMO_MOBILE_URL_PARAM]: DEFAULT_LANDING_DEMO_VIDEO_URLS.mobile,
        [LANDING_DEMO_DESKTOP_URL_PARAM]: DEFAULT_LANDING_DEMO_VIDEO_URLS.desktop,
        [ENTERPRISE_EMAIL_REMOTE_PARAM]: envEnterprise.enterpriseEmail,
        [SUPPORT_EMAIL_REMOTE_PARAM]: envEnterprise.supportEmail,
      };

      try {
        await fetchAndActivate(remoteConfig);
      } catch (err) {
        log.warn('fetchAndActivate failed; using defaults/cache', {
          cause: err instanceof Error ? err.message : String(err),
        });
      }

      const mobile = getValue(remoteConfig, LANDING_DEMO_MOBILE_URL_PARAM).asString();
      const desktop = getValue(remoteConfig, LANDING_DEMO_DESKTOP_URL_PARAM).asString();
      const enterpriseEmail = getValue(remoteConfig, ENTERPRISE_EMAIL_REMOTE_PARAM).asString();
      const supportEmail = getValue(remoteConfig, SUPPORT_EMAIL_REMOTE_PARAM).asString();

      return {
        demoVideos: {
          mobile: isNonEmptyString(mobile) ? mobile : DEFAULT_LANDING_DEMO_VIDEO_URLS.mobile,
          desktop: isNonEmptyString(desktop) ? desktop : DEFAULT_LANDING_DEMO_VIDEO_URLS.desktop,
        },
        enterprise: {
          enterpriseEmail: isNonEmptyString(enterpriseEmail)
            ? enterpriseEmail.trim()
            : envEnterprise.enterpriseEmail,
          supportEmail: isNonEmptyString(supportEmail)
            ? supportEmail.trim()
            : envEnterprise.supportEmail || DEFAULT_SUPPORT_EMAIL,
        },
      };
    })().finally(() => {
      inflightFetch = null;
    });
  }

  return inflightFetch;
}
