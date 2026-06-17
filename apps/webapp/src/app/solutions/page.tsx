import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { SITE_NAME } from '@/lib/site';
import { SolutionsHubClient } from '@/components/landing/solutions-hub-client';

export const metadata: Metadata = buildPageMetadata({
  title: `${SITE_NAME} — Solutions for property teams`,
  description:
    'Property intelligence for managers, insurers, field teams, and prop-tech platforms. AI checkpoints, formal PDFs, and document Q&A.',
  path: '/solutions',
});

export default function SolutionsHubPage() {
  return <SolutionsHubClient />;
}
