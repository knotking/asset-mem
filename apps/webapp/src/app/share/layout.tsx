import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata-shared';

export const metadata: Metadata = buildPageMetadata({
  title: 'Shared chat — AssetMem AI',
  description: 'Read-only shared property assistant conversation.',
  path: '/share',
  noIndex: true,
});

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
