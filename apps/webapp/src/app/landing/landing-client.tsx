"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLandingAuth } from "@/hooks/use-landing-auth";
import { LandingHeader } from "./landing-header";
import { LandingPricingSection } from "./landing-pricing-section";
import { trackLandingCta, trackEnterpriseCta } from "@/lib/analytics";
import {
  getEnterpriseConfigFromEnv,
  type EnterpriseConfig,
} from "@/lib/enterprise-config";
import { EnterpriseSection } from "@/components/landing/enterprise-section";
import { LandingHero } from "@/components/landing/landing-hero";
import { AssetMemWordmark } from "@/components/brand/asset-mem-wordmark";
import { LANDING_COLORS, LANDING_HEADER_OFFSET, LANDING_SECTION_HEADING_CLASS, LANDING_SECTION_HEADING_EMPHASIS_CLASS } from "@/lib/landing-theme";
import {
  DEFAULT_LANDING_DEMO_VIDEO_URLS,
  fetchLandingRemoteConfig,
  type LandingDemoVideoUrls,
} from "@/lib/landing-demo-video";
import { SITE_FOOTER_TAGLINE } from "@/lib/site";
import "./landing-animations.css";

function scrollToLandingSection(
  targetId: string,
  behavior: ScrollBehavior = "smooth",
  animate = true,
) {
  if (targetId === "#") {
    window.scrollTo({ top: 0, behavior });
    return;
  }

  const element = document.querySelector(targetId) as HTMLElement | null;
  if (!element) return;

  const elementPosition = element.getBoundingClientRect().top;
  const offsetPosition =
    elementPosition + window.pageYOffset - LANDING_HEADER_OFFSET;

  window.scrollTo({ top: offsetPosition, behavior });

  if (!animate || behavior !== "smooth") {
    return;
  }

  const runHighlight = () => {
    element.classList.remove("animate-highlight");
    // Force reflow so re-triggering the same section restarts the pulse.
    void element.offsetWidth;
    element.classList.add("animate-highlight");
    window.setTimeout(() => {
      element.classList.remove("animate-highlight");
    }, 2000);
  };

  if (!("onscrollend" in window)) {
    globalThis.setTimeout(runHighlight, 700);
    return;
  }

  window.addEventListener("scrollend", runHighlight, { once: true });
}

export default function LandingPageClient() {
  const { isAuthenticated } = useLandingAuth();
  const [activeSection, setActiveSection] = useState<string>("");
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [demoVideoUrls, setDemoVideoUrls] = useState<LandingDemoVideoUrls>(
    DEFAULT_LANDING_DEMO_VIDEO_URLS,
  );
  const [enterpriseConfig, setEnterpriseConfig] = useState<EnterpriseConfig>(() =>
    getEnterpriseConfigFromEnv(),
  );

  useEffect(() => {
    let cancelled = false;
    const loadLandingRemoteConfig = async () => {
      const remote = await fetchLandingRemoteConfig();
      if (!cancelled) {
        setDemoVideoUrls(remote.demoVideos);
        setEnterpriseConfig(remote.enterprise);
      }
    };

    void loadLandingRemoteConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Only run on client side to avoid hydration issues
    if (typeof window === "undefined") return;

    // Detect mobile vs desktop for video links
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    // Next.js Link components automatically prefetch internal routes, so no manual prefetching needed

    // Check scroll position on mount and scroll events
    const checkScrollPosition = () => {
      const scrollY = window.scrollY;

      if (scrollY < 100) {
        setActiveSection((prev) => (prev === "" ? prev : ""));
        return;
      }

      // Order must match the on-page section order for the early-break below.
      const sections = [
        { id: "how-it-works", el: document.querySelector("#how-it-works") },
        { id: "ai-pipeline", el: document.querySelector("#ai-pipeline") },
        { id: "use-cases", el: document.querySelector("#use-cases") },
        { id: "enterprise", el: document.querySelector("#enterprise") },
        { id: "pricing", el: document.querySelector("#pricing") },
      ];

      for (const { id, el } of sections) {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom >= 150) {
            setActiveSection((prev) => (prev === id ? prev : id));
            return;
          }
          if (rect.top > 150) break; // Section below viewport, stop
        }
      }
      setActiveSection((prev) => (prev === "" ? prev : ""));
    };

    // Initial check
    checkScrollPosition();

    // Listen to scroll events with throttling for better performance
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          checkScrollPosition();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      // Clean up scroll listener and resize listener
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", checkIsMobile);
    };
  }, []);

  // External deep links (e.g. mapp "View plans on the web" → asset-mem.com#pricing)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash || hash === "#") return;

    const scrollToHash = () => scrollToLandingSection(hash, "auto", false);

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToHash);
    });
  }, []);

  const handleButtonClick = (
    _e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    label = "primary_cta",
  ) => {
    trackLandingCta(label);
  };

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string,
  ) => {
    e.preventDefault();
    scrollToLandingSection(targetId);
  };

  const handleEnterpriseNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    label: string,
  ) => {
    trackEnterpriseCta(label);
    handleNavClick(e, "#enterprise");
  };

  // IMPORTANT: All hooks must be called before any conditional returns (Rules of Hooks)

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        backgroundColor: LANDING_COLORS.background,
        color: LANDING_COLORS.foreground,
        width: "100%",
      }}
    >
      {/* Header/Navigation */}
      <LandingHeader
        isAuthenticated={isAuthenticated}
        activeSection={activeSection}
        onNavClick={(e, targetId) => {
          if (targetId === "#enterprise") {
            trackEnterpriseCta("team_cta_nav");
          }
          handleNavClick(e, targetId);
        }}
        onButtonClick={handleButtonClick}
        onEnterpriseNavClick={handleEnterpriseNavClick}
      />

      <div className="fade-in-up flex flex-col flex-1 w-full">
      <LandingHero
        colors={LANDING_COLORS}
        isAuthenticated={isAuthenticated}
        isMobile={isMobile}
        demoVideoUrls={demoVideoUrls}
        onPrimaryCta={handleButtonClick}
      />

      {/* How It Works */}
      <section
        id="how-it-works"
        className="relative w-full overflow-hidden py-16 sm:py-24 lg:py-32"
        style={{ backgroundColor: "#0f0f14" }}
      >
        <div
          className="absolute inset-0 w-full"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div
          className="container relative mx-auto px-4"
          style={{ maxWidth: "1400px" }}
        >
          <div className="text-center mb-16 space-y-4">
            <div
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-sm"
              style={{
                backgroundColor: LANDING_COLORS.primaryLight,
                borderColor: LANDING_COLORS.primaryBorder,
              }}
            >
              <span
                className="text-sm font-semibold tracking-wide"
                style={{ color: LANDING_COLORS.primary }}
              >
                THE WORKFLOW
              </span>
            </div>
            <h2
              className={LANDING_SECTION_HEADING_CLASS}
              style={{ color: LANDING_COLORS.foreground }}
            >
              From site visit to{" "}
              <span className="font-bold landing-gradient-text">
                evidence teams trust
              </span>
            </h2>
            <p
              className="text-lg max-w-2xl mx-auto font-light"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              One AI-assisted workflow for a single home or a portfolio—capture,
              understand, act, and share without losing context.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              {
                step: 1,
                title: "Capture the property",
                desc: "Structured photos and documents on site—per home or across a portfolio.",
              },
              {
                step: 2,
                title: "See what changed",
                desc: "AI condition scoring and answers grounded in your evidence.",
              },
              {
                step: 3,
                title: "Know what to do",
                desc: "AI-suggested costs, repair paths, and coverage context without tab-hopping.",
              },
              {
                step: 4,
                title: "Prove it later",
                desc: "Formal reports and share links for owners, tenants, or adjusters.",
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="relative flex flex-col items-center text-center animate-stagger-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 font-bold text-xl"
                  style={{
                    background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`,
                    color: LANDING_COLORS.white,
                  }}
                >
                  {item.step}
                </div>
                <h3
                  className="font-bold text-lg mb-2"
                  style={{ color: LANDING_COLORS.foreground }}
                >
                  {item.title}
                </h3>
                <p
                  className="mx-auto max-w-[17rem] text-sm font-light leading-relaxed [text-wrap:pretty] sm:max-w-[14.5rem] lg:max-w-none"
                  style={{ color: LANDING_COLORS.mutedForeground }}
                >
                  {item.desc}
                </p>
                {item.step < 4 && (
                  <div
                    className="hidden lg:block absolute top-8 -right-4 w-8 h-0.5"
                    style={{ backgroundColor: LANDING_COLORS.primary20 }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Intelligence Engine Section */}
      <section
        id="ai-pipeline"
        className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-24"
        style={{ backgroundColor: '#0a0a0f' }}
      >
        <div className="absolute inset-0 w-full" style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(34,211,238,0.07), transparent 65%)' }} />
        <div className="absolute inset-0 w-full" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="container relative mx-auto px-4" style={{ maxWidth: '1200px' }}>
          {/* Header */}
          <div className="text-center mb-14 space-y-5">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-sm" style={{ backgroundColor: LANDING_COLORS.primaryLight, borderColor: LANDING_COLORS.primaryBorder }}>
              <svg className="h-4 w-4 landing-subtle-pulse animate-pulse max-lg:animate-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.primary }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-semibold tracking-wide" style={{ color: LANDING_COLORS.primary }}>AI INTELLIGENCE LAYER</span>
            </div>
            <h2 className={LANDING_SECTION_HEADING_CLASS} style={{ color: LANDING_COLORS.foreground }}>
              Spot changes early.{' '}
              <span className="font-bold landing-gradient-text">
                Move with confidence.
              </span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto font-light" style={{ color: LANDING_COLORS.mutedForeground }}>
              Photos, documents, and questions feed one coordinated layer—from
              condition signals to prioritized next steps your team can act on.
            </p>
          </div>

          {/* Pipeline card */}
          <div className="landing-glass-strong rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(34,211,238,0.15)' }}>

            {/* Stage 1: Inputs */}
            <div className="border-b px-4 pt-6 pb-5 sm:px-6 lg:px-8" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: LANDING_COLORS.mutedForeground }}>Evidence in</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Field & inspection photos' },
                  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Policies & vendor records' },
                  { icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', label: 'Team questions' },
                  { icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', label: 'Condition over time' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs" style={{ borderColor: LANDING_COLORS.border, backgroundColor: 'rgba(20,20,28,0.8)', color: LANDING_COLORS.foreground }}>
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.mutedForeground }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Connector */}
            <div className="flex justify-center py-2.5">
              <div className="flex flex-col items-center">
                <div className="h-5 w-0.5 rounded-full" style={{ backgroundColor: 'rgba(34,211,238,0.5)' }} />
                <svg className="h-3.5 w-3.5 -mt-0.5" fill="currentColor" viewBox="0 0 10 6" style={{ color: LANDING_COLORS.primary }}>
                  <path d="M0 0l5 6 5-6z" />
                </svg>
              </div>
            </div>

            {/* Stage 2: Orchestrator */}
            <div className="mx-4 mb-3 rounded-xl border px-4 py-4 sm:mx-6 sm:px-5" style={{ borderColor: 'rgba(34,211,238,0.35)', backgroundColor: 'rgba(34,211,238,0.07)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(34,211,238,0.18)' }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.primary }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: '#a5f3fc' }}>AI smart coordination</div>
                    <div className="text-xs" style={{ color: 'rgba(165,243,252,0.6)' }}>Reads context across the property, surfaces what matters, routes to the right analysis</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {['Live analysis', 'Portfolio-ready'].map((tag) => (
                    <span key={tag} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'rgba(34,211,238,0.3)', color: '#67e8f9', backgroundColor: 'rgba(34,211,238,0.1)' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Connector */}
            <div className="flex justify-center py-2.5">
              <div className="flex flex-col items-center">
                <div className="h-5 w-0.5 rounded-full" style={{ backgroundColor: 'rgba(34,211,238,0.5)' }} />
                <svg className="h-3.5 w-3.5 -mt-0.5" fill="currentColor" viewBox="0 0 10 6" style={{ color: LANDING_COLORS.primary }}>
                  <path d="M0 0l5 6 5-6z" />
                </svg>
              </div>
            </div>

            {/* Stage 3: Agents */}
            <div className="border-b px-4 pt-0 pb-5 sm:px-6 lg:px-8" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: LANDING_COLORS.mutedForeground }}>Focused analysis</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                  { label: 'Coverage & policies', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
                  { label: 'Repair guidance', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                  { label: 'Vendor matches', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
                  { label: 'Cost outlook', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { label: 'Change detection', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', accent: true },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs"
                    style={{
                      borderColor: item.accent ? 'rgba(249,115,22,0.35)' : 'rgba(34,211,238,0.18)',
                      backgroundColor: item.accent ? 'rgba(249,115,22,0.07)' : 'rgba(20,20,28,0.8)',
                      color: item.accent ? '#fdba74' : LANDING_COLORS.foreground,
                    }}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: item.accent ? '#fb923c' : LANDING_COLORS.primary }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Connector */}
            <div className="flex justify-center py-2.5">
              <div className="flex flex-col items-center">
                <div className="h-5 w-0.5 rounded-full" style={{ backgroundColor: 'rgba(34,211,238,0.5)' }} />
                <svg className="h-3.5 w-3.5 -mt-0.5" fill="currentColor" viewBox="0 0 10 6" style={{ color: LANDING_COLORS.primary }}>
                  <path d="M0 0l5 6 5-6z" />
                </svg>
              </div>
            </div>

            {/* Stage 4: Output */}
            <div className="mx-4 mb-6 rounded-xl border px-4 py-4 sm:mx-6 sm:px-5" style={{ borderColor: 'rgba(34,211,238,0.25)', backgroundColor: 'rgba(34,211,238,0.04)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#67e8f9' }}>Clear outputs</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: 'Condition score', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                  { label: 'Fix first', icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12' },
                  { label: 'Repair playbook', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                  { label: 'Budget outlook', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { label: 'Trusted vendors', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
                  { label: 'Shareable reports', icon: 'M9 17v-4m3 4V7m3 10v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs"
                    style={{ borderColor: 'rgba(34,211,238,0.2)', backgroundColor: 'rgba(34,211,238,0.07)', color: '#a5f3fc' }}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.primary }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section
        id="use-cases"
        className="relative w-full overflow-hidden py-16 sm:py-24 lg:py-32"
        style={{ backgroundColor: LANDING_COLORS.background }}
      >
        <div
          className="absolute inset-0 w-full"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div
          className="container relative mx-auto px-4"
          style={{ maxWidth: "1400px" }}
        >
          <div className="text-center mb-20 space-y-6">
            <div
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-sm"
              style={{
                backgroundColor: LANDING_COLORS.primaryLight,
                borderColor: LANDING_COLORS.primaryBorder,
              }}
            >
              <span
                className="text-sm font-semibold tracking-wide"
                style={{ color: LANDING_COLORS.primary }}
              >
                REAL-WORLD APPLICATIONS
              </span>
            </div>
            <h2
              className={LANDING_SECTION_HEADING_EMPHASIS_CLASS}
              style={{ color: LANDING_COLORS.foreground }}
            >
              See How AssetMem
              <br />
              <span className="font-bold landing-gradient-text-muted">
                Solves Real Problems
              </span>
            </h2>
            <p
              className="text-xl max-w-3xl mx-auto font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              From routine walkthroughs to claims documentation, see how one
              evidence workflow supports single homes and multi-property
              operations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-7xl mx-auto">
            {[
              {
                title: "Portfolio inspection cadence",
                scenario: "Capture spring and fall walkthroughs for each area",
                icon: "M13 10V3L4 14h7v7l9-11h-7z",
                color: LANDING_COLORS.accent,
                steps: [
                  "Capture structured walkthrough photos for roof, exterior, basement, and HVAC",
                  "Track AI-scored condition shifts by area across each season",
                  "Highlight recurring moisture and weather-related wear",
                  "Build a clear maintenance backlog before issues escalate",
                ],
                result:
                  "Proactive portfolio plan that prevented in-season surprises",
              },
              {
                title: "Early risk detection across units",
                scenario:
                  "Monitor basement moisture over 6-month winter period",
                icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
                color: LANDING_COLORS.primary,
                steps: [
                  "Capture monthly walkthrough photos",
                  "AI detects condition score drop: 78 → 65 (attention needed)",
                  "AI highlights increased moisture and wall staining",
                  "Get preventive maintenance recommendations before major damage",
                ],
                result: "Caught water issue early, prevented $5,000+ damage",
              },
              {
                title: "Turnover documentation at scale",
                scenario:
                  "Document condition at lease start and end for security deposits",
                icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                color: LANDING_COLORS.accent,
                steps: [
                  "Capture move-in walkthroughs room by room",
                  "At move-out, generate a comparison report with before/after photos",
                  "Review issue tables and change callouts automatically",
                  "Share the report with your landlord or tenant",
                ],
                result:
                  "Resolved deposit dispute with dated, AI-verified evidence",
              },
              {
                title: "Claims evidence for adjusters",
                scenario: "Storm damage to roof requires insurance claim proof",
                icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                color: LANDING_COLORS.primary,
                steps: [
                  "Platform compares before/after evidence from prior walkthroughs",
                  "AI detects: missing shingles, damaged flashing, water damage",
                  "Generate a formal report with photos, issue tables, and change highlights",
                  "Share the report and comparisons with your insurance adjuster",
                ],
                result:
                  "Claim approved in 3 days with AI-verified documentation",
              },
              {
                title: "Vendor handoff",
                scenario:
                  "Share AI findings with contractors without granting account access",
                icon: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
                color: LANDING_COLORS.primary,
                steps: [
                  "Run issue analysis on captured evidence",
                  "Generate a formal report or share a secure evidence link",
                  "Contractor reviews evidence without a login",
                  "Everyone works from the same AI-verified source of truth",
                ],
                result: "Faster approvals with less back-and-forth email",
              },
              {
                title: "Renovation Progress Tracking",
                scenario:
                  "Track kitchen and bath updates across contractor visits",
                icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                color: LANDING_COLORS.accent,
                steps: [
                  "Capture before/after walkthroughs for each milestone",
                  "Use AI comparisons to track workmanship and finish quality over time",
                  "Attach invoices, warranties, and notes to each milestone",
                  "Share a secure evidence link with your contractor or family",
                ],
                result: "Kept everyone aligned with one source of truth",
              },
            ].map((useCase, i) => (
              <div
                key={useCase.title}
                className="landing-glass-card border rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 animate-stagger-in"
                style={{
                  borderColor: LANDING_COLORS.border,
                  animationDelay: `${i * 0.1}s`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                  e.currentTarget.style.boxShadow = `0 25px 50px -12px ${LANDING_COLORS.primary20}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = LANDING_COLORS.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Icon and Title */}
                <div className="flex items-start gap-4 mb-6">
                  <div
                    className="h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `linear-gradient(to right bottom, ${useCase.color}, ${useCase.color}99)`,
                    }}
                  >
                    <svg
                      className="h-7 w-7"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: LANDING_COLORS.white }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={useCase.icon}
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3
                      className="text-2xl font-bold mb-2"
                      style={{ color: LANDING_COLORS.foreground }}
                    >
                      {useCase.title}
                    </h3>
                    <p
                      className="text-sm font-medium"
                      style={{ color: LANDING_COLORS.mutedForeground }}
                    >
                      {useCase.scenario}
                    </p>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-3 mb-6">
                  {useCase.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: LANDING_COLORS.primary20,
                        }}
                      >
                        <span
                          className="text-xs font-bold"
                          style={{ color: LANDING_COLORS.primary }}
                        >
                          {idx + 1}
                        </span>
                      </div>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: LANDING_COLORS.foreground90 }}
                      >
                        {step}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div
                  className="pt-4 border-t"
                  style={{ borderColor: LANDING_COLORS.border }}
                >
                  <div className="flex items-start gap-2">
                    <svg
                      className="h-5 w-5 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: useCase.color }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: useCase.color }}
                    >
                      {useCase.result}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <EnterpriseSection
        colors={LANDING_COLORS}
        enterprise={enterpriseConfig}
      />

      <LandingPricingSection colors={LANDING_COLORS} enterprise={enterpriseConfig} />

      {/* Footer - dark */}
      <footer
        className="mt-auto border-t py-12 w-full"
        style={{
          borderColor: LANDING_COLORS.border,
          backgroundColor: LANDING_COLORS.background,
        }}
      >
        <div className="container mx-auto px-4" style={{ maxWidth: "1400px" }}>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
            <div className="space-y-4">
              <Link href="/" className="inline-flex">
                <AssetMemWordmark size="footer" />
              </Link>
              <p
                className="text-sm"
                style={{ color: LANDING_COLORS.mutedForeground }}
              >
                {SITE_FOOTER_TAGLINE}
              </p>
            </div>

            <div>
              <h3
                className="font-semibold mb-4"
                style={{ color: LANDING_COLORS.foreground }}
              >
                Product
              </h3>
              <ul
                className="space-y-2 text-sm"
                style={{ color: LANDING_COLORS.mutedForeground }}
              >
                <li>
                  <Link
                    href="#how-it-works"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link
                    href="#use-cases"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Use Cases
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pricing"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href={isAuthenticated ? '/home' : '/login'}
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    {isAuthenticated ? 'Dashboard' : 'Sign In'}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3
                className="font-semibold mb-4"
                style={{ color: LANDING_COLORS.foreground }}
              >
                Enterprise
              </h3>
              <ul
                className="space-y-2 text-sm"
                style={{ color: LANDING_COLORS.mutedForeground }}
              >
                <li>
                  <Link
                    href="/solutions"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Solutions
                  </Link>
                </li>
                <li>
                  <Link
                    href="#enterprise"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Contact Sales
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3
                className="font-semibold mb-4"
                style={{ color: LANDING_COLORS.foreground }}
              >
                Company
              </h3>
              <ul
                className="space-y-2 text-sm"
                style={{ color: LANDING_COLORS.mutedForeground }}
              >
                <li>
                  <Link
                    href="/about"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="#enterprise"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3
                className="font-semibold mb-4"
                style={{ color: LANDING_COLORS.foreground }}
              >
                Legal
              </h3>
              <ul
                className="space-y-2 text-sm"
                style={{ color: LANDING_COLORS.mutedForeground }}
              >
                <li>
                  <Link
                    href="/privacy"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/account-deletion"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Delete account
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div
            className="mt-8 pt-8 border-t text-center text-sm"
            style={{
              borderColor: LANDING_COLORS.border,
              color: LANDING_COLORS.mutedForeground,
            }}
          >
            © {new Date().getFullYear()} AssetMem AI. All rights reserved.
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
