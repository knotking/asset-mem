import type { Metadata } from 'next';
import { buildPageMetadata, LANDING_PAGE_METADATA } from '@/lib/metadata-shared';
import LandingPage from './landing/page';

export const metadata: Metadata = buildPageMetadata({
  ...LANDING_PAGE_METADATA,
  path: '/',
});

export default function RootPage() {
  // Show landing page for all users (logged-in users will see "Dashboard" button)
  return <LandingPage />;
}
