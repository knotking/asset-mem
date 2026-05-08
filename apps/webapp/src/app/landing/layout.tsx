import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AssetMem AI - Intelligent Home Care & Property Diagnostics',
  description: 'Get instant property diagnostics, maintenance guidance, and expert recommendations powered by advanced AI technology.',
  keywords: 'home care, property maintenance, AI diagnostics, smart home, property management',
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

