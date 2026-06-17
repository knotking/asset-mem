/** Public marketing site constants (AssetMem AI). */

export const SITE_NAME = 'AssetMem AI';

/** Hero headline lines — keep in sync with landing page and Open Graph metadata. */
export const SITE_HERO_HEADLINE_PRIMARY = 'Your Complete';
export const SITE_HERO_HEADLINE_ACCENT = 'Property Care Platform';
export const SITE_TAGLINE = `${SITE_HERO_HEADLINE_PRIMARY} ${SITE_HERO_HEADLINE_ACCENT}`;

export const SITE_HERO_HEADLINE_PRIMARY_B2B = 'AI property intelligence';
export const SITE_HERO_HEADLINE_ACCENT_B2B =
  'for portfolios, claims, and field teams';

export const SITE_HERO_DESCRIPTION =
  'AI agents analyze your property photos and documents, rate condition over time, flag issues, generate formal PDF reports, and guide you on repairs and costs while connecting you with local pros.';

export const SITE_HERO_DESCRIPTION_B2B =
  'Capture evidence, generate audit-ready PDFs, and answer questions across properties—from one platform.';

/** Default meta description for marketing pages and OG fallbacks. */
export const SITE_DESCRIPTION = SITE_HERO_DESCRIPTION_B2B;

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
