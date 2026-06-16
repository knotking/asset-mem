import { app } from "@/lib/firebase";
import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
} from "firebase/remote-config";

export const LANDING_DEMO_MOBILE_URL_PARAM = "landing_demo_mobile_url";
export const LANDING_DEMO_DESKTOP_URL_PARAM = "landing_demo_desktop_url";

export const DEFAULT_LANDING_DEMO_VIDEO_URLS = {
  mobile: "https://youtu.be/vh0J8DWupkI",
  desktop: "https://youtu.be/OP4I2tkM8FE",
} as const;

export type LandingDemoVideoUrls = {
  mobile: string;
  desktop: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const getMinimumFetchIntervalMillis = (): number => {
  const env = process.env.NEXT_PUBLIC_ENV;
  return env === "prod" ? 60 * 60 * 1000 : 60 * 1000;
};

export const fetchLandingDemoVideoUrlsFromRemoteConfig =
  async (): Promise<LandingDemoVideoUrls> => {
    const remoteConfig = getRemoteConfig(app);

    remoteConfig.settings = {
      fetchTimeoutMillis: 10 * 1000,
      minimumFetchIntervalMillis: getMinimumFetchIntervalMillis(),
    };
    remoteConfig.defaultConfig = {
      [LANDING_DEMO_MOBILE_URL_PARAM]: DEFAULT_LANDING_DEMO_VIDEO_URLS.mobile,
      [LANDING_DEMO_DESKTOP_URL_PARAM]: DEFAULT_LANDING_DEMO_VIDEO_URLS.desktop,
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

    return {
      mobile: isNonEmptyString(mobile)
        ? mobile
        : DEFAULT_LANDING_DEMO_VIDEO_URLS.mobile,
      desktop: isNonEmptyString(desktop)
        ? desktop
        : DEFAULT_LANDING_DEMO_VIDEO_URLS.desktop,
    };
  };
