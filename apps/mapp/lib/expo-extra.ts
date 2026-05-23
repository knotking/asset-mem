import Constants from 'expo-constants';

/** Read expo.extra at call time (app.config.js values from the current Metro bundle). */
export function getExpoExtra(): Record<string, unknown> {
  return Constants.expoConfig?.extra ?? {};
}

export function getWebAppUrl(): string {
  return String(getExpoExtra().webAppUrl ?? '').trim();
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
