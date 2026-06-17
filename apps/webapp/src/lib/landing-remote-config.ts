import { app } from "@/lib/firebase";
import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
} from "firebase/remote-config";
import {
  DEFAULT_LANDING_DEMO_VIDEO_URLS,
  LANDING_DEMO_DESKTOP_URL_PARAM,
  LANDING_DEMO_MOBILE_URL_PARAM,
  type LandingDemoVideoUrls,
} from "@/lib/landing-demo-video-constants";
import {
  ENTERPRISE_EMAIL_REMOTE_PARAM,
  ENTERPRISE_FORM_URL_REMOTE_PARAM,
  getEnterpriseConfigFromEnv,
  type EnterpriseConfig,
} from "@/lib/enterprise-config";

export type LandingRemoteConfig = {
  demoVideos: LandingDemoVideoUrls;
  enterprise: EnterpriseConfig;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const getMinimumFetchIntervalMillis = (): number => {
  const env = process.env.NEXT_PUBLIC_ENV;
  return env === "prod" ? 60 * 60 * 1000 : 60 * 1000;
};

let inflightFetch: Promise<LandingRemoteConfig> | null = null;

/** Demo video URLs + B2B enterprise form/email from Firebase Remote Config (env fallbacks). */
export async function fetchLandingRemoteConfig(): Promise<LandingRemoteConfig> {
  if (!inflightFetch) {
    inflightFetch = (async () => {
      const envEnterprise = getEnterpriseConfigFromEnv();
      const remoteConfig = getRemoteConfig(app);

      remoteConfig.settings = {
        fetchTimeoutMillis: 10 * 1000,
        minimumFetchIntervalMillis: getMinimumFetchIntervalMillis(),
      };
      remoteConfig.defaultConfig = {
        [LANDING_DEMO_MOBILE_URL_PARAM]: DEFAULT_LANDING_DEMO_VIDEO_URLS.mobile,
        [LANDING_DEMO_DESKTOP_URL_PARAM]: DEFAULT_LANDING_DEMO_VIDEO_URLS.desktop,
        [ENTERPRISE_FORM_URL_REMOTE_PARAM]: envEnterprise.formUrl ?? "",
        [ENTERPRISE_EMAIL_REMOTE_PARAM]: envEnterprise.enterpriseEmail,
      };

      try {
        await fetchAndActivate(remoteConfig);
      } catch {
        // Fall through to defaults and last cached values.
      }

      const mobile = getValue(
        remoteConfig,
        LANDING_DEMO_MOBILE_URL_PARAM,
      ).asString();
      const desktop = getValue(
        remoteConfig,
        LANDING_DEMO_DESKTOP_URL_PARAM,
      ).asString();
      const enterpriseFormUrl = getValue(
        remoteConfig,
        ENTERPRISE_FORM_URL_REMOTE_PARAM,
      ).asString();
      const enterpriseEmail = getValue(
        remoteConfig,
        ENTERPRISE_EMAIL_REMOTE_PARAM,
      ).asString();

      return {
        demoVideos: {
          mobile: isNonEmptyString(mobile)
            ? mobile
            : DEFAULT_LANDING_DEMO_VIDEO_URLS.mobile,
          desktop: isNonEmptyString(desktop)
            ? desktop
            : DEFAULT_LANDING_DEMO_VIDEO_URLS.desktop,
        },
        enterprise: {
          formUrl: isNonEmptyString(enterpriseFormUrl)
            ? enterpriseFormUrl.trim()
            : envEnterprise.formUrl,
          enterpriseEmail: isNonEmptyString(enterpriseEmail)
            ? enterpriseEmail.trim()
            : envEnterprise.enterpriseEmail,
        },
      };
    })().finally(() => {
      inflightFetch = null;
    });
  }

  return inflightFetch;
}

export async function fetchLandingDemoVideoUrlsFromRemoteConfig(): Promise<LandingDemoVideoUrls> {
  const { demoVideos } = await fetchLandingRemoteConfig();
  return demoVideos;
}

export async function fetchEnterpriseConfigFromRemoteConfig(): Promise<EnterpriseConfig> {
  const { enterprise } = await fetchLandingRemoteConfig();
  return enterprise;
}
