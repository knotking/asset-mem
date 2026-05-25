import Constants from 'expo-constants';

/** Canonical legal site for Privacy Policy and Terms (App Store / Play compliance). */
const LEGAL_SITE_ORIGIN = 'https://asset-mem.com';

function normalizeOrigin(url: string | undefined): string {
  const trimmed = url?.trim();
  if (!trimmed) return LEGAL_SITE_ORIGIN;
  return trimmed.replace(/\/$/, '');
}

/** Origin used for /privacy and /terms links in Settings. */
export function getLegalSiteOrigin(): string {
  const webAppUrl = Constants.expoConfig?.extra?.webAppUrl as string | undefined;
  const env = Constants.expoConfig?.extra?.appEnv as string | undefined;
  if (env === 'prod') {
    return normalizeOrigin(webAppUrl) || LEGAL_SITE_ORIGIN;
  }
  return LEGAL_SITE_ORIGIN;
}

export function getPrivacyPolicyUrl(): string {
  return `${getLegalSiteOrigin()}/privacy`;
}

export function getTermsOfServiceUrl(): string {
  return `${getLegalSiteOrigin()}/terms`;
}

/** Public help page for App Store / Play Console account-deletion URL. */
export function getAccountDeletionHelpUrl(): string {
  return `${getLegalSiteOrigin()}/account-deletion`;
}
