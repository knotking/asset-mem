import { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export const metadata: Metadata = buildPageMetadata({
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    'Get instant property diagnostics, maintenance guidance, and expert recommendations powered by advanced AI technology.',
  path: '/',
});

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
