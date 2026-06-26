'use client';

import Link from 'next/link';
import { YouTubeModal } from '@/components/landing/youtube-modal';
import type { LandingColorPalette } from '@/lib/landing-theme';
import type { LandingDemoVideoUrls } from '@/lib/landing-demo-video';
import {
  SITE_HERO_DESCRIPTION,
  SITE_HERO_HEADLINE_ACCENT,
  SITE_HERO_HEADLINE_PRIMARY,
} from '@/lib/site';
import AIGraphic from '@/app/landing/ai-graphic';
import { AssetMemWordmark } from '@/components/brand/asset-mem-wordmark';

/** Visible area below sticky header (h-20). dvh tracks mobile browser chrome. */
const MOBILE_HERO_SCREEN_MIN = 'min-h-[calc(100dvh-5rem)]';

const MOBILE_HEADLINE =
  'text-[3.25rem] leading-[3.625rem] font-light tracking-tight text-center';
const MOBILE_DESCRIPTION =
  'mx-auto max-w-[340px] text-lg leading-7 font-light text-center';
const MOBILE_CTA =
  'flex w-full items-center justify-center rounded-xl py-[18px] px-8 text-base font-semibold transition-all';
const MOBILE_CTA_SECONDARY =
  'flex w-full items-center justify-center rounded-xl border-2 py-[18px] px-6 text-base font-medium transition-all cursor-pointer';

type LandingHeroProps = {
  colors: LandingColorPalette;
  isAuthenticated: boolean;
  isMobile: boolean;
  demoVideoUrls: LandingDemoVideoUrls;
  onPrimaryCta: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, label?: string) => void;
};

export function LandingHero({
  colors: c,
  isAuthenticated,
  isMobile,
  demoVideoUrls,
  onPrimaryCta,
}: LandingHeroProps) {
  const headlinePrimary = SITE_HERO_HEADLINE_PRIMARY;
  const headlineAccent = SITE_HERO_HEADLINE_ACCENT;
  const description = SITE_HERO_DESCRIPTION;
  const [headlineFirst, ...headlineRestWords] = headlinePrimary.trim().split(/\s+/);
  const headlineSecond = headlineRestWords.join(' ');

  const primaryButtonStyle = {
    backgroundColor: c.primary,
    color: '#0a0a0f',
  };

  const applyPrimaryHover = (e: React.MouseEvent<HTMLElement>, enter: boolean) => {
    e.currentTarget.style.backgroundColor = enter ? c.primaryHover : c.primary;
    e.currentTarget.style.transform = enter ? 'translateX(2px)' : 'translateX(0)';
  };

  const secondaryButtonStyle = {
    backgroundColor: 'transparent',
    borderColor: c.border,
    color: c.foreground,
  };

  const headlineBlock = (
    <h1
      className={`${MOBILE_HEADLINE} lg:text-6xl lg:leading-[1.05] lg:text-left xl:text-7xl`}
      style={{ color: c.foreground }}
    >
      <span className="block">{headlineFirst}</span>
      {headlineSecond ? <span className="block lg:pl-3.5">{headlineSecond}</span> : null}
      {headlineAccent ? (
        <span
          className="mt-3 block text-base sm:text-lg font-light"
          style={{ color: c.foreground60 }}
        >
          {headlineAccent}
        </span>
      ) : null}
    </h1>
  );

  const descriptionBlock = (
    <p
      className={`${MOBILE_DESCRIPTION} lg:mx-0 lg:max-w-none lg:text-left lg:text-xl lg:leading-relaxed`}
      style={{ color: c.foreground60 }}
    >
      {description}
    </p>
  );

  const primaryCtaLabel = isAuthenticated ? 'Dashboard' : 'Get Started';
  const primaryCtaHref = isAuthenticated ? '/home' : '/login';

  const arrowIcon = (
    <svg
      className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  );

  const mobileCtaBlock = (
    <div className="flex w-full shrink-0 flex-col gap-3 lg:hidden">
      <Link
        href={primaryCtaHref}
        onClick={(e) => onPrimaryCta(e, 'primary_cta')}
        onMouseEnter={(e) => applyPrimaryHover(e, true)}
        onMouseLeave={(e) => applyPrimaryHover(e, false)}
        className={`${MOBILE_CTA} group shadow-xl hover:shadow-2xl`}
        style={primaryButtonStyle}
      >
        {primaryCtaLabel}
        {arrowIcon}
      </Link>
      <YouTubeModal
        url={isMobile ? demoVideoUrls.mobile : demoVideoUrls.desktop}
        trigger={
          <button
            type="button"
            className={MOBILE_CTA_SECONDARY}
            style={secondaryButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = c.muted30;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Watch Demo
          </button>
        }
      />
    </div>
  );

  const desktopCtaBlock = (
    <div className="hidden flex-col gap-4 pt-1 lg:flex lg:flex-row lg:justify-start">
      <Link
        href={primaryCtaHref}
        onClick={(e) => onPrimaryCta(e, 'primary_cta')}
        onMouseEnter={(e) => applyPrimaryHover(e, true)}
        onMouseLeave={(e) => applyPrimaryHover(e, false)}
        className="inline-flex items-center justify-center rounded-lg px-10 py-7 text-base font-medium shadow-xl transition-all group hover:shadow-2xl"
        style={primaryButtonStyle}
      >
        {primaryCtaLabel}
        {arrowIcon}
      </Link>
      <YouTubeModal
        url={isMobile ? demoVideoUrls.mobile : demoVideoUrls.desktop}
        trigger={
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border-2 px-10 py-7 text-base font-medium transition-all"
            style={{
              ...secondaryButtonStyle,
              padding: '1.75rem 2.5rem',
              height: 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = c.muted30;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Watch Demo
          </button>
        }
      />
    </div>
  );

  return (
    <section className="relative w-full overflow-hidden">
      <div
        className="absolute inset-0 w-full"
        style={{
          background: 'linear-gradient(to bottom right, #0a0a0f, #0f172a, #0a0a0f)',
        }}
      />
      <div
        className="absolute inset-0 w-full"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(34,211,238,0.12), transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 w-full"
        style={{
          background:
            'radial-gradient(circle at 70% 80%, rgba(249,115,22,0.08), transparent 50%)',
        }}
      />

      <div className="relative mx-auto" style={{ maxWidth: '1400px' }}>
        {/* Mobile: first screen, then graphic on scroll */}
        <div className="lg:hidden">
          <div
            className={`flex flex-col gap-6 px-6 pb-9 pt-5 ${MOBILE_HERO_SCREEN_MIN}`}
          >
            <div className="flex flex-col gap-6 py-4 text-center">
              {headlineBlock}
              {descriptionBlock}
            </div>
            {mobileCtaBlock}
          </div>
          <div className="mx-auto w-full max-w-xl px-6 pb-12 pt-2">
            <AIGraphic variant="homeowner" />
          </div>
        </div>

        {/* Desktop */}
        <div className="container relative mx-auto hidden grid-cols-2 items-center gap-16 px-4 py-28 lg:grid">
          <div className="flex max-w-xl flex-col gap-8 text-left">
            <div className="flex w-full flex-col items-start space-y-4">
              <AssetMemWordmark
                size="eyebrow"
                foregroundColor={c.foreground60}
              />
              {headlineBlock}
            </div>
            {descriptionBlock}
            {desktopCtaBlock}
          </div>

          <div className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
            <AIGraphic variant="homeowner" />
          </div>
        </div>
      </div>
    </section>
  );
}
