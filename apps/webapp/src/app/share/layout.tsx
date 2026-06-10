import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata-shared';

export const metadata: Metadata = buildPageMetadata({
  path: '/share',
  noIndex: true,
});

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Belt-and-suspenders full-width shell (root SidebarProvider is flex-col; see app/layout.tsx).
  return <div className="flex min-h-svh w-full min-w-0 flex-col">{children}</div>;
}
