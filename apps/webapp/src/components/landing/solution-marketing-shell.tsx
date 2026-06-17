'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AssetMemBrandIcon } from '@/components/brand/asset-mem-brand-icon';
import {
  getPilotConfigFromEnv,
  getPilotMailtoHref,
  type PilotConfig,
} from '@/lib/pilot-config';
import { fetchLandingRemoteConfig } from '@/lib/landing-remote-config';
import { trackPilotCta } from '@/lib/analytics';
import { LANDING_COLORS } from '@/lib/landing-theme';

type SolutionMarketingShellProps = {
  children: React.ReactNode;
};

export function SolutionMarketingShell({ children }: SolutionMarketingShellProps) {
  const [pilot, setPilot] = useState<PilotConfig>(() => getPilotConfigFromEnv());
  const [isDetailPage, setIsDetailPage] = useState(false);

  useEffect(() => {
    // Check if we're on a detail page (e.g. /solutions/property-managers)
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      setIsDetailPage(path !== '/solutions' && path.startsWith('/solutions/'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchLandingRemoteConfig().then((remote) => {
      if (!cancelled) setPilot(remote.pilot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pilotHref = pilot.formUrl ?? getPilotMailtoHref(pilot.pilotsEmail);
  const pilotExternal = Boolean(pilot.formUrl);

  return (
    <div
      className="min-h-screen w-full"
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
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href={pilotHref}
              target={pilotExternal ? '_blank' : undefined}
              rel={pilotExternal ? 'noopener noreferrer' : undefined}
              onClick={() => trackPilotCta('team_cta_solutions_header')}
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: LANDING_COLORS.primary, color: '#0a0a0f' }}
            >
              Talk to us
            </a>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer
        className="border-t py-10"
        style={{ borderColor: LANDING_COLORS.borderOverlay }}
      >
        <div
          className="container mx-auto px-4 flex items-center justify-center text-sm"
          style={{ maxWidth: '1200px', color: LANDING_COLORS.mutedForeground }}
        >
          <Link href={isDetailPage ? '/solutions' : '/'} className="hover:underline">
            ← Back to {isDetailPage ? 'solutions' : 'homepage'}
          </Link>
        </div>
      </footer>
    </div>
  );
}
