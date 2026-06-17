'use client';

import Link from 'next/link';
import { SolutionMarketingShell } from '@/components/landing/solution-marketing-shell';
import { LANDING_COLORS } from '@/lib/landing-theme';
import {
  SOLUTION_HUB_INTRO,
  SOLUTION_PAGES,
  SOLUTION_SLUGS,
} from '@/lib/solutions-data';
import { PortfolioHeroGraphic } from '@/app/landing/portfolio-hero-graphic';

export function SolutionsHubClient() {
  return (
    <SolutionMarketingShell compactHub>
      <section className="flex-1 flex flex-col justify-center py-10 md:py-12 xl:py-5">
        <div className="container mx-auto px-4 max-w-[1100px] xl:max-w-6xl">
          <div className="text-center mb-8 xl:mb-5 space-y-3 xl:space-y-2">
            <p
              className="text-sm font-semibold tracking-wide uppercase"
              style={{ color: LANDING_COLORS.primary }}
            >
              Solutions
            </p>
            <h1
              className="text-4xl lg:text-5xl xl:text-3xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Property intelligence for{' '}
              <span className="font-bold" style={{ color: LANDING_COLORS.primary }}>
                every segment
              </span>
            </h1>
            <p
              className="text-lg xl:text-base max-w-2xl mx-auto font-light leading-relaxed xl:leading-snug"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              {SOLUTION_HUB_INTRO}
            </p>
          </div>

          <div className="flex flex-col gap-10 xl:grid xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-6 xl:items-start">
            <div className="max-w-3xl mx-auto w-full xl:max-w-none xl:min-h-0 xl:flex xl:flex-col">
              <PortfolioHeroGraphic layout="sidebar" showConceptPreview />
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-1 xl:grid-rows-4 gap-4 xl:gap-3 xl:min-h-0 content-start">
              {SOLUTION_SLUGS.map((slug) => {
                const page = SOLUTION_PAGES[slug];
                return (
                  <Link
                    key={slug}
                    href={page.path}
                    className="rounded-xl xl:rounded-lg border p-5 xl:px-4 xl:py-3.5 transition-all hover:-translate-y-0.5 xl:flex xl:flex-col xl:justify-start xl:min-h-0"
                    style={{
                      borderColor: LANDING_COLORS.border,
                      backgroundColor: 'rgba(20,20,28,0.6)',
                    }}
                  >
                    <h2
                      className="text-xl xl:text-[0.95rem] xl:leading-snug font-semibold mb-2 xl:mb-1"
                      style={{ color: LANDING_COLORS.foreground }}
                    >
                      {page.title}
                    </h2>
                    <p
                      className="text-sm xl:text-xs font-light leading-relaxed xl:leading-snug mb-3 xl:mb-2"
                      style={{ color: LANDING_COLORS.mutedForeground }}
                    >
                      {page.problem}
                    </p>
                    <ul
                      className="space-y-1.5 xl:space-y-1 mb-4 xl:mb-2"
                      style={{ color: LANDING_COLORS.mutedForeground }}
                    >
                      {page.bullets.slice(0, 2).map((bullet) => (
                        <li
                          key={bullet}
                          className="flex gap-2 text-sm xl:text-[11px] font-light leading-snug"
                        >
                          <span
                            className="shrink-0"
                            style={{ color: LANDING_COLORS.primary }}
                            aria-hidden
                          >
                            ✓
                          </span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    <span
                      className="text-sm xl:text-xs font-medium mt-auto"
                      style={{ color: LANDING_COLORS.primary }}
                    >
                      Learn more →
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </SolutionMarketingShell>
  );
}
