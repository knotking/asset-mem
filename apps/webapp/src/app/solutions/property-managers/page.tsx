import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata-shared';
import { SITE_NAME } from '@/lib/site';
import { SolutionDetailClient } from '@/components/landing/solution-detail-client';
import { SOLUTION_PAGES } from '@/lib/solutions-data';

const page = SOLUTION_PAGES['property-managers'];

export const metadata: Metadata = buildPageMetadata({
  title: `${SITE_NAME} — ${page.title}`,
  description: page.problem,
  path: page.path,
});

export default function PropertyManagersSolutionPage() {
  return <SolutionDetailClient page={page} />;
}
