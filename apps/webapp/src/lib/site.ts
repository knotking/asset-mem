/** Public marketing site constants (AssetMem AI). */

export const SITE_NAME = 'AssetMem AI';

/** Hero headline lines — keep in sync with landing page and Open Graph metadata. */
export const SITE_HERO_HEADLINE_PRIMARY = 'Timeline Intelligence';
export const SITE_HERO_HEADLINE_ACCENT = '';
export const SITE_TAGLINE = SITE_HERO_HEADLINE_PRIMARY;

export const SITE_HERO_HEADLINE_PRIMARY_B2B = 'AI property intelligence';
export const SITE_HERO_HEADLINE_ACCENT_B2B =
  'for portfolios, claims, and field teams';

export const SITE_HERO_DESCRIPTION =
  'Track every asset change with AI for repairs, claims, audits, and reports.';

/** Footer blurb — keep aligned with hero value proposition. */
export const SITE_FOOTER_TAGLINE = SITE_HERO_DESCRIPTION;

export const SITE_HERO_DESCRIPTION_B2B =
  'Capture evidence, generate audit-ready reports, and answer questions across properties—from one platform.';

/** Default meta description for marketing pages and OG fallbacks. */
export const SITE_DESCRIPTION = SITE_HERO_DESCRIPTION;

export const SITE_B2B_KEYWORDS = [
  'property inspection software',
  'insurance claims documentation',
  'AI property condition',
  'portfolio maintenance',
  'property management AI',
];

export const SITE_KEYWORDS = [
  'home care',
  'property maintenance',
  'AI diagnostics',
  'smart home',
  'property management',
  'home inspection',
  ...SITE_B2B_KEYWORDS,
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
