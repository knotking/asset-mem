import Constants from 'expo-constants';

/** Read expo.extra at call time (app.config.js values from the current Metro bundle). */
export function getExpoExtra(): Record<string, unknown> {
  return Constants.expoConfig?.extra ?? {};
}

const DEFAULT_WEB_APP_ORIGIN = 'https://asset-mem.com';

export function getWebAppUrl(): string {
  return String(getExpoExtra().webAppUrl ?? '').trim();
}

/** Canonical web app origin for marketing/deep links (no trailing slash). */
export function getWebAppOrigin(): string {
  const url = getWebAppUrl();
  return url ? url.replace(/\/$/, '') : DEFAULT_WEB_APP_ORIGIN;
}

export function getMobileWebHandoffUrl(): string {
  return String(getExpoExtra().mobileWebHandoffUrl ?? '').trim();
}

export function validateBillingWebConfig(): string | null {
  if (!getWebAppUrl()) {
    return 'Web app URL is not configured. Set WEB_APP_URL in apps/mapp/.env and restart Expo.';
  }
  if (!getMobileWebHandoffUrl()) {
    return 'Billing handoff URL is not configured. Set PROXY_BASE_URL in apps/mapp/.env and restart Expo.';
  }
  return null;
}
