import { Metadata } from 'next';
import { buildPageMetadata, LANDING_PAGE_METADATA } from '@/lib/metadata-shared';

export const metadata: Metadata = buildPageMetadata({
  ...LANDING_PAGE_METADATA,
  path: '/landing',
});

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
