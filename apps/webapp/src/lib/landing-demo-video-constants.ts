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
