/** Public marketing site constants (AssetMem AI). */

export const SITE_NAME = 'AssetMem AI';

export const SITE_TAGLINE = 'Intelligent home care and property diagnostics';

export const SITE_DESCRIPTION =
  'Get instant property diagnostics, maintenance guidance, and expert recommendations powered by AI. Track checkpoints, documents, and chat with specialized home-care agents.';

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
