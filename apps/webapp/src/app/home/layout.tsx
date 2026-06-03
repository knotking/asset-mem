import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata-shared';
import HomeLayoutClient from './home-layout-client';

export const metadata: Metadata = buildPageMetadata({
  title: 'Dashboard — AssetMem AI',
  description: 'Signed-in AssetMem AI workspace. Not intended for public indexing.',
  path: '/home',
  noIndex: true,
});

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HomeLayoutClient>{children}</HomeLayoutClient>;
}
