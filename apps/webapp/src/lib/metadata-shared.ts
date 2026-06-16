import type { Metadata } from 'next';
import {
  getSiteUrl,
  SITE_DESCRIPTION,
  SITE_HERO_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TAGLINE,
} from '@/lib/site';

/** Homepage and `/landing` copy — set `path` per route. */
export const LANDING_PAGE_METADATA = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_HERO_DESCRIPTION,
} as const;

type BuildPageMetadataOptions = {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
};

/** Shared Open Graph / Twitter metadata for marketing and legal pages. */
export function buildPageMetadata(options: BuildPageMetadataOptions = {}): Metadata {
  const siteUrl = getSiteUrl();
  const title = options.title ?? SITE_NAME;
  const description = options.description ?? SITE_DESCRIPTION;
  const canonicalPath = options.path ?? '/';
  const url = `${siteUrl}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    keywords: SITE_KEYWORDS,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — ${SITE_DESCRIPTION.slice(0, 80)}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
    ...(options.noIndex
      ? {
          robots: {
            index: false,
            follow: false,
            googleBot: { index: false, follow: false },
          },
        }
      : {}),
  };
}
