'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SolutionMarketingShell } from '@/components/landing/solution-marketing-shell';
import {
  getPilotConfigFromEnv,
  getPilotMailtoHref,
  type PilotConfig,
} from '@/lib/pilot-config';
import { fetchLandingRemoteConfig } from '@/lib/landing-remote-config';
import { trackPilotCta } from '@/lib/analytics';
import { LANDING_COLORS } from '@/lib/landing-theme';
import {
  SOLUTION_HUB_INTRO,
  SOLUTION_PAGES,
  SOLUTION_SLUGS,
} from '@/lib/solutions-data';
import { PortfolioHeroGraphic } from '@/app/landing/portfolio-hero-graphic';

export function SolutionsHubClient() {
  const [pilot, setPilot] = useState<PilotConfig>(() => getPilotConfigFromEnv());

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
    <SolutionMarketingShell>
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4" style={{ maxWidth: '1100px' }}>
          <div className="text-center mb-14 space-y-4">
            <p
              className="text-sm font-semibold tracking-wide uppercase"
              style={{ color: LANDING_COLORS.primary }}
            >
              Solutions
            </p>
            <h1
              className="text-4xl lg:text-5xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Property intelligence for{' '}
              <span className="font-bold" style={{ color: LANDING_COLORS.primary }}>
                every segment
              </span>
            </h1>
            <p
              className="text-lg max-w-2xl mx-auto font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              {SOLUTION_HUB_INTRO}
            </p>
          </div>

          {/* Portfolio Dashboard Preview */}
          <div className="mb-16 max-w-3xl mx-auto">
            <PortfolioHeroGraphic />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {SOLUTION_SLUGS.map((slug) => {
              const page = SOLUTION_PAGES[slug];
              return (
                <Link
                  key={slug}
                  href={page.path}
                  className="rounded-2xl border p-6 transition-all hover:-translate-y-1"
                  style={{
                    borderColor: LANDING_COLORS.border,
                    backgroundColor: 'rgba(20,20,28,0.6)',
                  }}
                >
                  <h2
                    className="text-xl font-semibold mb-2"
                    style={{ color: LANDING_COLORS.foreground }}
                  >
                    {page.title}
                  </h2>
                  <p
                    className="text-sm font-light leading-relaxed mb-4"
                    style={{ color: LANDING_COLORS.mutedForeground }}
                  >
                    {page.problem}
                  </p>
                  <span className="text-sm font-medium" style={{ color: LANDING_COLORS.primary }}>
                    Learn more →
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="text-center mt-14">
            <a
              href={pilotHref}
              target={pilotExternal ? '_blank' : undefined}
              rel={pilotExternal ? 'noopener noreferrer' : undefined}
              onClick={() => trackPilotCta('team_cta_solutions_hub')}
              className="inline-flex items-center rounded-lg px-8 py-3.5 text-base font-medium"
              style={{ backgroundColor: LANDING_COLORS.primary, color: '#0a0a0f' }}
            >
              Talk to us
            </a>
          </div>
        </div>
      </section>
    </SolutionMarketingShell>
  );
}
