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
import type { SolutionPageData } from '@/lib/solutions-data';

type SolutionDetailClientProps = {
  page: SolutionPageData;
};

export function SolutionDetailClient({ page }: SolutionDetailClientProps) {
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

  const handlePilotCta = () => {
    trackPilotCta(page.analyticsLabel);
  };

  return (
    <SolutionMarketingShell>
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4" style={{ maxWidth: '900px' }}>
          <p
            className="text-sm font-semibold tracking-wide uppercase mb-4"
            style={{ color: LANDING_COLORS.primary }}
          >
            {page.title}
          </p>
          <h1
            className="text-4xl lg:text-5xl font-light tracking-tight mb-6"
            style={{ color: LANDING_COLORS.foreground }}
          >
            {page.headline}
            <br />
            <span className="font-bold" style={{ color: LANDING_COLORS.primary }}>
              {page.accent}
            </span>
          </h1>
          <p
            className="text-lg font-light leading-relaxed mb-10"
            style={{ color: LANDING_COLORS.mutedForeground }}
          >
            {page.problem}
          </p>

          <div
            className="rounded-2xl border p-6 mb-10"
            style={{
              borderColor: LANDING_COLORS.border,
              backgroundColor: 'rgba(20,20,28,0.5)',
            }}
          >
            <h2
              className="text-sm font-semibold uppercase tracking-wider mb-4"
              style={{ color: LANDING_COLORS.primary }}
            >
              How AssetMem helps today
            </h2>
            <ul className="space-y-3">
              {page.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-2 text-sm font-light leading-relaxed"
                  style={{ color: LANDING_COLORS.foreground }}
                >
                  <span style={{ color: LANDING_COLORS.primary }} aria-hidden>
                    ✓
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          {page.slug === 'insurance' ? (
            <p
              id="sample"
              className="text-sm font-light mb-10"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Sample insurance-purpose PDFs are available on request during a pilot
              conversation. See also our{' '}
              <Link href="/#reports" className="underline underline-offset-4">
                reports overview
              </Link>{' '}
              on the homepage.
            </p>
          ) : null}

          {/* Common Workflows Section */}
          <div className="mb-12">
            <h2
              className="text-2xl font-light tracking-tight mb-6"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Common workflows
            </h2>
            <div className="space-y-6">
              {page.workflows.map((workflow, idx) => (
                <div
                  key={workflow.title}
                  className="rounded-xl border p-6"
                  style={{
                    borderColor: LANDING_COLORS.border,
                    backgroundColor: 'rgba(20,20,28,0.4)',
                  }}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold"
                      style={{
                        backgroundColor: LANDING_COLORS.primary20,
                        color: LANDING_COLORS.primary,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <h3
                        className="text-lg font-semibold mb-1"
                        style={{ color: LANDING_COLORS.foreground }}
                      >
                        {workflow.title}
                      </h3>
                      <p
                        className="text-sm font-light"
                        style={{ color: LANDING_COLORS.mutedForeground }}
                      >
                        {workflow.description}
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2 ml-11">
                    {workflow.steps.map((step) => (
                      <li
                        key={step}
                        className="flex gap-2 text-sm font-light leading-relaxed"
                        style={{ color: LANDING_COLORS.foreground90 }}
                      >
                        <span
                          className="mt-0.5"
                          style={{ color: LANDING_COLORS.primary }}
                          aria-hidden
                        >
                          →
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <a
              href={pilotHref}
              target={pilotExternal ? '_blank' : undefined}
              rel={pilotExternal ? 'noopener noreferrer' : undefined}
              onClick={handlePilotCta}
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
