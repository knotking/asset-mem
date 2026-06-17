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

type LandingHeroProps = {
  colors: LandingColorPalette;
  user: { uid: string } | null;
  loading: boolean;
  isMobile: boolean;
  demoVideoUrls: LandingDemoVideoUrls;
  onPrimaryCta: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, label?: string) => void;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => void;
};

export function LandingHero({
  colors: c,
  user,
  loading,
  isMobile,
  demoVideoUrls,
  onPrimaryCta,
  onNavClick,
}: LandingHeroProps) {
  const headlinePrimary = SITE_HERO_HEADLINE_PRIMARY;
  const headlineAccent = SITE_HERO_HEADLINE_ACCENT;
  const description = SITE_HERO_DESCRIPTION;

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
    padding: '1.75rem 2.5rem',
    height: 'auto',
  };

  return (
    <section className="relative overflow-hidden w-full">
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

      <div
        className="container relative mx-auto px-4 py-24 lg:py-40"
        style={{ maxWidth: '1400px' }}
      >
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="space-y-10">
            <div className="space-y-6">
              <h1
                className="text-6xl lg:text-8xl font-light tracking-tight leading-none"
                style={{ color: c.foreground }}
              >
                AssetMem
                <br />
                <span
                  className="font-bold"
                  style={{
                    background: `linear-gradient(to right, ${c.primary}, rgba(34,211,238,0.6))`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  AI
                </span>
              </h1>
              <h2
                className="text-3xl lg:text-4xl font-light leading-tight"
                style={{ color: c.foreground90 }}
              >
                {headlinePrimary}
                <br />
                <span className="font-medium">{headlineAccent}</span>
              </h2>
            </div>

            <p
              className="text-xl leading-relaxed max-w-xl font-light"
              style={{ color: c.foreground60 }}
            >
              {description}
            </p>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-4">
                {user ? (
                  <Link
                    href="/home"
                    onClick={(e) => onPrimaryCta(e, 'primary_cta')}
                    onMouseEnter={(e) => applyPrimaryHover(e, true)}
                    onMouseLeave={(e) => applyPrimaryHover(e, false)}
                    className="inline-flex items-center justify-center text-base px-10 py-7 rounded-lg font-medium shadow-xl hover:shadow-2xl transition-all group"
                    style={primaryButtonStyle}
                  >
                    Dashboard
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
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={(e) => onPrimaryCta(e, 'primary_cta')}
                      onMouseEnter={(e) => applyPrimaryHover(e, true)}
                      onMouseLeave={(e) => applyPrimaryHover(e, false)}
                      className="inline-flex items-center justify-center text-base px-10 py-7 rounded-lg font-medium shadow-xl hover:shadow-2xl transition-all group"
                      style={primaryButtonStyle}
                    >
                      Get Started
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
                    </Link>
                    <YouTubeModal
                      url={isMobile ? demoVideoUrls.mobile : demoVideoUrls.desktop}
                      trigger={
                        <button
                          type="button"
                          className="inline-flex items-center justify-center text-base rounded-lg font-medium border-2 transition-all cursor-pointer"
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
                  </>
                )}
              </div>

              {!user ? (
                <div className="pt-2">
                  <Link
                    href="/solutions"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border text-sm font-medium transition-all"
                    style={{
                      borderColor: c.borderOverlay,
                      color: c.foreground,
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = c.muted30;
                      e.currentTarget.style.borderColor = c.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = c.borderOverlay;
                    }}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    For property teams → View solutions
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          <AIGraphic variant="homeowner" />
        </div>
      </div>
    </section>
  );
}
