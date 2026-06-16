/** Public marketing site constants (AssetMem AI). */

export const SITE_NAME = 'AssetMem AI';

/** Hero headline lines — keep in sync with landing page and Open Graph metadata. */
export const SITE_HERO_HEADLINE_PRIMARY = 'Your Complete';
export const SITE_HERO_HEADLINE_ACCENT = 'Property Care Platform';
export const SITE_TAGLINE = `${SITE_HERO_HEADLINE_PRIMARY} ${SITE_HERO_HEADLINE_ACCENT}`;

export const SITE_HERO_DESCRIPTION =
  'AI agents analyze your property photos and documents, rate condition over time, flag issues, generate formal PDF reports, and guide you on repairs and costs while connecting you with local pros.';

/** Default meta description for marketing pages and OG fallbacks. */
export const SITE_DESCRIPTION = SITE_HERO_DESCRIPTION;

export const SITE_KEYWORDS = [
  'home care',
  'property maintenance',
  'AI diagnostics',
  'smart home',
  'property management',
  'home inspection',
];

/** Canonical origin for metadata and OG URLs (no trailing slash). */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://asset-mem.com';
}

export function getSupportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@asset-mem.com';
}
