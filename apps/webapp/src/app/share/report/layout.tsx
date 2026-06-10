import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata-shared';

export const metadata: Metadata = buildPageMetadata({
  title: 'Shared property report — AssetMem AI',
  description: 'View a shared property report PDF.',
  path: '/share/report',
  noIndex: true,
});

export default function SharedReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
