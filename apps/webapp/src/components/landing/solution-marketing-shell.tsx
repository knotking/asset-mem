'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';
import {
  getEnterpriseConfigFromEnv,
  getEnterpriseMailtoHref,
  type EnterpriseConfig,
} from '@/lib/enterprise-config';
import { fetchLandingRemoteConfig } from '@/lib/landing-remote-config';
import { trackEnterpriseCta } from '@/lib/analytics';
import { LANDING_COLORS } from '@/lib/landing-theme';

type SolutionMarketingShellProps = {
  children: React.ReactNode;
  compactHub?: boolean;
};

export function SolutionMarketingShell({
  children,
  compactHub = false,
}: SolutionMarketingShellProps) {
  const pathname = usePathname();
  const isDetailPage =
    pathname !== '/solutions' && pathname.startsWith('/solutions/');
  const [enterprise, setEnterprise] = useState<EnterpriseConfig>(() =>
    getEnterpriseConfigFromEnv(),
  );

  useEffect(() => {
    let cancelled = false;
    void fetchLandingRemoteConfig().then((remote) => {
      if (!cancelled) setEnterprise(remote.enterprise);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`min-h-screen w-full ${compactHub ? 'flex flex-col' : ''}`}
      style={{ backgroundColor: LANDING_COLORS.background, color: LANDING_COLORS.foreground }}
    >
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          backgroundColor: LANDING_COLORS.backgroundOverlay,
          borderColor: LANDING_COLORS.borderOverlay,
        }}
      >
        <div
          className="container mx-auto flex h-16 items-center justify-between gap-4 px-4"
          style={{ maxWidth: '1200px' }}
        >
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <AssetMemBrandIcon variant="mark" size="sm" markTheme="landing" className="shrink-0" />
            <span className="truncate text-lg font-light">
              AssetMem <span className="font-bold">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link
              href="/"
              className="text-sm font-medium transition-colors"
              style={{ color: LANDING_COLORS.foreground70 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = LANDING_COLORS.foreground70;
              }}
            >
              Home
            </Link>
            {isDetailPage ? (
              <Link
                href="/solutions"
                className="text-sm font-medium transition-colors"
                style={{ color: LANDING_COLORS.foreground70 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = LANDING_COLORS.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = LANDING_COLORS.foreground70;
                }}
              >
                Solutions
              </Link>
            ) : null}
            <a
              href={getEnterpriseMailtoHref(enterprise.enterpriseEmail)}
              onClick={() => trackEnterpriseCta('team_cta_solutions_header')}
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: LANDING_COLORS.primary, color: '#0a0a0f' }}
            >
              Email our team
            </a>
          </div>
        </div>
      </header>

      <main className={compactHub ? 'flex-1 flex flex-col min-h-0' : undefined}>
        {children}
      </main>

      <footer
        className={compactHub ? 'border-t py-4 shrink-0' : 'border-t py-10'}
        style={{ borderColor: LANDING_COLORS.borderOverlay }}
      >
        <div
          className="container mx-auto px-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
          style={{ maxWidth: '1200px', color: LANDING_COLORS.mutedForeground }}
        >
          {isDetailPage ? (
            <Link href="/solutions" className="hover:underline">
              ← All solutions
            </Link>
          ) : null}
          <Link href="/" className="hover:underline">
            ← Back to homepage
          </Link>
        </div>
      </footer>
    </div>
  );
}
