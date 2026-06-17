"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { LandingHeader } from "./landing-header";
import { LandingPricingSection } from "./landing-pricing-section";
import { trackLandingCta, trackPilotCta } from "@/lib/analytics";
import { getSupportEmail } from "@/lib/site";
import {
  getPilotConfigFromEnv,
  getPilotMailtoHref,
  type PilotConfig,
} from "@/lib/pilot-config";
import { PilotSection } from "@/components/landing/pilot-section";
import { LandingHero } from "@/components/landing/landing-hero";
import { LANDING_COLORS, LANDING_HEADER_OFFSET } from "@/lib/landing-theme";
import {
  DEFAULT_LANDING_DEMO_VIDEO_URLS,
  fetchLandingRemoteConfig,
  type LandingDemoVideoUrls,
} from "@/lib/landing-demo-video";
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

  if (animate && behavior === "smooth") {
    setTimeout(() => {
      element.classList.add("fade-in-up");
      element.classList.add("animate-highlight");
      setTimeout(() => {
        element.classList.remove("animate-highlight");
        element.classList.remove("fade-in-up");
      }, 2000);
    }, 300);
  }
}

export default function LandingPageClient() {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<string>("");
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [demoVideoUrls, setDemoVideoUrls] = useState<LandingDemoVideoUrls>(
    DEFAULT_LANDING_DEMO_VIDEO_URLS,
  );
  const [pilotConfig, setPilotConfig] = useState<PilotConfig>(() =>
    getPilotConfigFromEnv(),
  );

  useEffect(() => {
    let cancelled = false;
    const loadLandingRemoteConfig = async () => {
      const remote = await fetchLandingRemoteConfig();
      if (!cancelled) {
        setDemoVideoUrls(remote.demoVideos);
        setPilotConfig(remote.pilot);
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
        setActiveSection("");
        return;
      }

      // Order must match the on-page section order for the early-break below.
      const sections = [
        { id: "how-it-works", el: document.querySelector("#how-it-works") },
        { id: "ai-pipeline", el: document.querySelector("#ai-pipeline") },
        { id: "use-cases", el: document.querySelector("#use-cases") },
        {
          id: "timeline-feature",
          el: document.querySelector("#timeline-feature"),
        },
        { id: "docs-chat", el: document.querySelector("#docs-chat") },
        { id: "reports", el: document.querySelector("#reports") },
        { id: "pilot", el: document.querySelector("#pilot") },
        { id: "pricing", el: document.querySelector("#pricing") },
      ];

      for (const { id, el } of sections) {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom >= 150) {
            setActiveSection(id);
            return;
          }
          if (rect.top > 150) break; // Section below viewport, stop
        }
      }
      setActiveSection("");
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
  // arrive while auth is still loading, so the target section is not in the DOM yet.
  useEffect(() => {
    if (loading || typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash || hash === "#") return;

    const scrollToHash = () => scrollToLandingSection(hash, "auto", false);

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToHash);
    });
  }, [loading]);

  const handleButtonClick = (
    _e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    label = "primary_cta",
  ) => {
    trackLandingCta(label);
  };

  const supportEmail = getSupportEmail();

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string,
  ) => {
    e.preventDefault();
    scrollToLandingSection(targetId);
  };

  const handlePilotNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    label: string,
  ) => {
    trackPilotCta(label);
    handleNavClick(e, "#pilot");
  };

  const pilotFormUrl = pilotConfig.formUrl;
  const pilotContactHref =
    pilotFormUrl ?? getPilotMailtoHref(pilotConfig.pilotsEmail);
  const pilotContactExternal = Boolean(pilotFormUrl);
  const pilotsEmail = pilotConfig.pilotsEmail;

  // IMPORTANT: All hooks must be called before any conditional returns (Rules of Hooks)

  // While auth is loading, show minimal loading state to prevent flash
  // Once loading is complete, show landing page (which will handle button display)
  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ backgroundColor: LANDING_COLORS.background }}
      />
    );
  }

  // Auth check complete - show landing page
  // Landing page will show "Dashboard" for logged-in users or "Sign In" for others

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
        activeSection={activeSection}
        onNavClick={(e, targetId) => {
          if (targetId === "#pilot") {
            trackPilotCta("team_cta_nav");
          }
          handleNavClick(e, targetId);
        }}
        onButtonClick={handleButtonClick}
        onPilotNavClick={handlePilotNavClick}
      />

      <LandingHero
        colors={LANDING_COLORS}
        user={user}
        loading={loading}
        isMobile={isMobile}
        demoVideoUrls={demoVideoUrls}
        onPrimaryCta={handleButtonClick}
        onNavClick={handleNavClick}
      />

      {/* How It Works */}
      <section
        id="how-it-works"
        className="py-32 relative overflow-hidden w-full"
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
                GET STARTED IN MINUTES
              </span>
            </div>
            <h2
              className="text-4xl lg:text-5xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Four steps.{" "}
              <span
                className="font-bold"
                style={{
                  background: `linear-gradient(to right, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Full clarity.
              </span>
            </h2>
            <p
              className="text-lg max-w-2xl mx-auto font-light"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Add a property, ask a question, get a clear answer, stay
              organised. That&apos;s it.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              {
                step: 1,
                title: "Add Your Property",
                desc: "Create a property, snap your first photos, and upload any documents. Takes under five minutes.",
              },
              {
                step: 2,
                title: "Ask a Question",
                desc: "Chat with your photos or your paperwork — whichever fits your question. Switch modes anytime.",
              },
              {
                step: 3,
                title: "Get Clear Answers",
                desc: "Costs, repair steps, coverage checks, and matched local pros — one conversation, no tab-switching.",
              },
              {
                step: 4,
                title: "Stay on Top of It",
                desc: "Save pros, generate PDF reports, share links, and revisit your timeline whenever something changes.",
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
                  className="text-sm font-light leading-relaxed"
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
        className="py-24 relative overflow-hidden w-full"
        style={{ backgroundColor: '#0a0a0f' }}
      >
        <div className="absolute inset-0 w-full" style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(34,211,238,0.07), transparent 65%)' }} />
        <div className="absolute inset-0 w-full" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="container relative mx-auto px-4" style={{ maxWidth: '1200px' }}>
          {/* Header */}
          <div className="text-center mb-14 space-y-5">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-sm" style={{ backgroundColor: LANDING_COLORS.primaryLight, borderColor: LANDING_COLORS.primaryBorder }}>
              <svg className="h-4 w-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.primary }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-semibold tracking-wide" style={{ color: LANDING_COLORS.primary }}>AI INTELLIGENCE ENGINE</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight" style={{ color: LANDING_COLORS.foreground }}>
              See risk early.{' '}
              <span className="font-bold" style={{ background: `linear-gradient(to right, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Act with confidence.
              </span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto font-light" style={{ color: LANDING_COLORS.mutedForeground }}>
              Your property data flows into a coordinated AI pipeline — from ingestion through analysis, straight to a clear action plan.
            </p>
          </div>

          {/* Pipeline card */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(34,211,238,0.15)', backgroundColor: 'rgba(12,18,32,0.7)', backdropFilter: 'blur(8px)' }}>

            {/* Stage 1: Inputs */}
            <div className="px-8 pt-6 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: LANDING_COLORS.mutedForeground }}>Your data</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Checkpoint photos' },
                  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Docs & warranties' },
                  { icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', label: 'Your questions' },
                  { icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', label: 'Before / after history' },
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
            <div className="mx-6 mb-3 rounded-xl border px-5 py-4" style={{ borderColor: 'rgba(34,211,238,0.35)', backgroundColor: 'rgba(34,211,238,0.07)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(34,211,238,0.18)' }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.primary }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: '#a5f3fc' }}>AI Orchestrator</div>
                    <div className="text-xs" style={{ color: 'rgba(165,243,252,0.6)' }}>Understands context, prioritises what matters, dispatches specialists instantly</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {['Real-time analysis', 'Always-on'].map((tag) => (
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
            <div className="px-8 pt-0 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: LANDING_COLORS.mutedForeground }}>Specialist agents</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                  { label: 'Coverage', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
                  { label: 'DIY repair', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                  { label: 'Local pros', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
                  { label: 'Cost estimate', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { label: 'Trend analysis', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', accent: true },
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
            <div className="mx-6 mb-6 rounded-xl border px-5 py-4" style={{ borderColor: 'rgba(34,211,238,0.25)', backgroundColor: 'rgba(34,211,238,0.04)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#67e8f9' }}>Your action plan</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: 'Risk score', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
                  { label: 'Priority ranking', icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12' },
                  { label: 'Step-by-step repairs', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                  { label: 'Cost estimate', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { label: 'Matched local pros', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
                  { label: 'Monthly report', icon: 'M9 17v-4m3 4V7m3 10v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
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
        className="py-32 relative overflow-hidden w-full"
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
              className="text-5xl lg:text-6xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              See How AssetMem
              <br />
              <span
                className="font-bold"
                style={{
                  background: `linear-gradient(to right, ${LANDING_COLORS.primary}, ${LANDING_COLORS.foreground70})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Solves Real Problems
              </span>
            </h2>
            <p
              className="text-xl max-w-3xl mx-auto font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              From routine walkthroughs to claims documentation, see how
              checkpoint-driven workflows support single homes and multi-property
              operations
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
                  "Create checkpoints for roof, exterior, basement, and HVAC",
                  "Track condition shifts by area across each season",
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
                  "Create monthly checkpoints with photos",
                  "AI detects condition score drop: 78 → 65 (attention needed)",
                  "Platform identifies increased moisture + wall staining",
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
                  "Capture move-in checkpoints room by room",
                  "At move-out, generate a comparison report with before/after photos",
                  "Review issue tables and visual-diff callouts automatically",
                  "Share the PDF with your landlord or tenant",
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
                  "Platform auto-compares before/after checkpoint photos",
                  "AI detects: missing shingles, damaged flashing, water damage",
                  "Generate a formal PDF report with photos, issue tables, and change highlights",
                  "Share the report and comparisons with your insurance adjuster",
                ],
                result:
                  "Claim approved in 3 days with AI-verified documentation",
              },
              {
                title: "Home Inspection Follow-up",
                scenario: "50-page inspection report with 15 issues to address",
                icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
                color: LANDING_COLORS.primary,
                steps: [
                  "Upload inspection PDF → AI indexes all issues",
                  "Ask: 'What are the critical issues?' → Get prioritized list",
                  "Chat: 'Cost to fix the roof?' → $4,500-$7,200 estimate",
                  "Find local roofers, compare quotes, check warranty coverage",
                ],
                result:
                  "Prioritized repairs, negotiated 20% discount with quotes",
              },
              {
                title: "Vendor handoff",
                scenario:
                  "Share AI findings with contractors without granting account access",
                icon: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
                color: LANDING_COLORS.primary,
                steps: [
                  "Run checkpoint analysis or chat on property issues",
                  "Generate a formal PDF report or share a read-only chat link",
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
                  "Capture before/after checkpoints for each milestone",
                  "Compare workmanship and finish quality over time",
                  "Attach invoices, warranties, and notes to each checkpoint",
                  "Share a read-only chat link with your contractor or family",
                ],
                result: "Kept everyone aligned with one source of truth",
              },
            ].map((useCase, i) => (
              <div
                key={useCase.title}
                className="border rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 animate-stagger-in"
                style={{
                  backgroundColor: "rgba(20,20,28,0.6)",
                  backdropFilter: "blur(4px)",
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

      {/* Timeline Feature Details - Property Checkpoints */}
      <section
        id="timeline-feature"
        className="py-32 relative overflow-hidden w-full"
        style={{ backgroundColor: "#0a0a0f" }}
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
          <div className="max-w-4xl mx-auto">
            <div className="space-y-10">
              <div>
                <h2
                  className="text-4xl lg:text-5xl font-light tracking-tight mb-4"
                  style={{ color: LANDING_COLORS.foreground }}
                >
                  Property Checkpoints:
                  <br />
                  <span
                    className="font-bold"
                    style={{
                      background: `linear-gradient(to right, ${LANDING_COLORS.primary}, rgba(34,211,238,0.7))`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    Your Timeline
                  </span>
                </h2>
                <p
                  className="text-lg font-light"
                  style={{ color: LANDING_COLORS.mutedForeground }}
                >
                  Photos, scores, before/after—and health metrics that help you
                  stay ahead.
                </p>
              </div>
              {[
                {
                  title: "Timeline Capture",
                  desc: "Snap photos and videos over time, spot changes with before-and-after views, and let AI summarize what it sees.",
                  icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
                },
                {
                  title: "AI-Powered Analysis",
                  desc: "Get a simple condition score, see what looks damaged, and understand how serious each issue is.",
                  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 4a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v10a2 2 0 002 2zm0 0V5a2 2 0 012-2h2a2 2 0 012 2v14",
                },
                {
                  title: "Automatic Comparison",
                  desc: "Compare a new visit to an older one and see what changed—with settings you can adjust anytime.",
                  icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
                },
                {
                  title: "Timeline Comparisons",
                  desc: "Scroll through your history and open side-by-side views whenever you need proof of progress or damage.",
                  icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                },
                {
                  title: "Property Health Metrics",
                  desc: "See how your property is doing overall, which issues matter most, and whether things are getting better or worse.",
                  icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
                },
                {
                  title: "Always Up to Date",
                  desc: "New photos and results show up right away—no need to refresh or wait around.",
                  icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
                },
                {
                  title: "Property Reports",
                  desc: "Generate branded PDF snapshots or before/after comparison reports from your checkpoints—ready to share with insurers, tenants, or buyers.",
                  icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                },
              ].map((block, i) => (
                <div
                  key={block.title}
                  className="flex gap-4 p-4 rounded-lg border transition-all animate-stagger-in"
                  style={{
                    borderColor: LANDING_COLORS.border,
                    backgroundColor: "rgba(20,20,28,0.4)",
                    animationDelay: `${i * 0.1}s`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = LANDING_COLORS.border;
                  }}
                >
                  <div
                    className="h-12 w-12 rounded-lg flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary20}, ${LANDING_COLORS.primary10})`,
                    }}
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: LANDING_COLORS.primary }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={block.icon}
                      />
                    </svg>
                  </div>
                  <div>
                    <h3
                      className="font-bold mb-1"
                      style={{ color: LANDING_COLORS.foreground }}
                    >
                      {block.title}
                    </h3>
                    <p
                      className="text-sm font-light leading-relaxed"
                      style={{ color: LANDING_COLORS.mutedForeground }}
                    >
                      {block.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Document Chat Feature Showcase */}
      <section
        id="docs-chat"
        className="py-32 relative overflow-hidden w-full"
        style={{ backgroundColor: "#0f0f14" }}
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
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Visual representation */}
            <div className="order-2 lg:order-1">
              <div
                className="rounded-2xl border p-8 space-y-6"
                style={{
                  borderColor: LANDING_COLORS.border,
                  backgroundColor: "rgba(20,20,28,0.6)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {/* Chat Example */}
                <div className="space-y-4">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div
                      className="max-w-[80%] rounded-2xl px-4 py-3"
                      style={{
                        backgroundColor: LANDING_COLORS.primary,
                        color: LANDING_COLORS.background,
                      }}
                    >
                      <p className="text-sm font-medium">
                        What issues were found in my home inspection report?
                      </p>
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex justify-start">
                    <div
                      className="max-w-[85%] rounded-2xl px-4 py-3 border"
                      style={{
                        backgroundColor: LANDING_COLORS.card,
                        borderColor: LANDING_COLORS.border50,
                        color: LANDING_COLORS.foreground,
                      }}
                    >
                      <p className="text-sm leading-relaxed mb-3">
                        Based on your home inspection report, here are the key
                        issues found:
                      </p>
                      <ul
                        className="text-sm space-y-2 mb-3"
                        style={{ color: LANDING_COLORS.foreground90 }}
                      >
                        <li className="flex items-start gap-2">
                          <span style={{ color: LANDING_COLORS.accent }}>
                            •
                          </span>
                          <span>
                            <strong>Roof:</strong> Missing shingles on north
                            side, estimated 5-7 years remaining life
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span style={{ color: LANDING_COLORS.accent }}>
                            •
                          </span>
                          <span>
                            <strong>HVAC:</strong> Air handler showing signs of
                            wear, recommend service within 6 months
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span style={{ color: LANDING_COLORS.accent }}>
                            •
                          </span>
                          <span>
                            <strong>Plumbing:</strong> Minor leak detected under
                            kitchen sink
                          </span>
                        </li>
                      </ul>
                      <div
                        className="pt-2 border-t"
                        style={{ borderColor: LANDING_COLORS.border }}
                      >
                        <p
                          className="text-xs"
                          style={{ color: LANDING_COLORS.mutedForeground }}
                        >
                          📄 Citations: Home_Inspection_Report.pdf, Pages 3-7
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Follow-up question */}
                  <div className="flex justify-end">
                    <div
                      className="max-w-[80%] rounded-2xl px-4 py-3"
                      style={{
                        backgroundColor: LANDING_COLORS.primary,
                        color: LANDING_COLORS.background,
                      }}
                    >
                      <p className="text-sm font-medium">
                        What's the estimated cost to fix the roof?
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Description */}
            <div className="space-y-8 order-1 lg:order-2">
              <div>
                <div
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-sm mb-6"
                  style={{
                    backgroundColor: LANDING_COLORS.primaryLight,
                    borderColor: LANDING_COLORS.primaryBorder,
                  }}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: LANDING_COLORS.primary }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  <span
                    className="text-sm font-semibold tracking-wide"
                    style={{ color: LANDING_COLORS.primary }}
                  >
                    TWO WAYS TO CHAT
                  </span>
                </div>
                <h2
                  className="text-4xl lg:text-5xl font-light tracking-tight mb-4"
                  style={{ color: LANDING_COLORS.foreground }}
                >
                  Chat with Your
                  <br />
                  <span
                    className="font-bold"
                    style={{
                      background: `linear-gradient(to right, ${LANDING_COLORS.primary}, rgba(34,211,238,0.7))`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    Docs or Photos
                  </span>
                </h2>
                <p
                  className="text-lg font-light leading-relaxed"
                  style={{ color: LANDING_COLORS.mutedForeground }}
                >
                  <strong style={{ color: LANDING_COLORS.foreground90 }}>Docs mode</strong> answers
                  from your inspection reports, warranties, manuals, and policies—with sources
                  cited. <strong style={{ color: LANDING_COLORS.foreground90 }}>Timeline mode</strong>{" "}
                  uses your photos and optional repair, coverage, cost, and provider help. Pick the
                  mode that fits your question.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: "Home Inspection Reports",
                    desc: "Quickly find issues, recommendations, and cost estimates from lengthy inspection documents.",
                    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                  },
                  {
                    title: "Warranty Coverage",
                    desc: "Ask what's covered, expiration dates, and claim procedures without reading through pages of fine print.",
                    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                  },
                  {
                    title: "Appliance Manuals",
                    desc: "Get troubleshooting steps, maintenance schedules, and specifications instantly from your manuals.",
                    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
                  },
                  {
                    title: "Insurance Policies",
                    desc: "Understand your coverage, deductibles, and exclusions through simple conversational queries.",
                    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
                  },
                ].map((item, i) => (
                  <div
                    key={item.title}
                    className="flex gap-4 p-4 rounded-lg border transition-all animate-stagger-in"
                    style={{
                      borderColor: LANDING_COLORS.border,
                      backgroundColor: "rgba(20,20,28,0.4)",
                      animationDelay: `${i * 0.1}s`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(34,211,238,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = LANDING_COLORS.border;
                    }}
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{
                        background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary20}, ${LANDING_COLORS.primary10})`,
                      }}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: LANDING_COLORS.primary }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={item.icon}
                        />
                      </svg>
                    </div>
                    <div>
                      <h3
                        className="font-bold text-sm mb-1"
                        style={{ color: LANDING_COLORS.foreground }}
                      >
                        {item.title}
                      </h3>
                      <p
                        className="text-xs font-light leading-relaxed"
                        style={{ color: LANDING_COLORS.mutedForeground }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Property Reports Section */}
      <section
        id="reports"
        className="py-32 relative overflow-hidden w-full scroll-mt-24"
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
                FORMAL PDF REPORTS
              </span>
            </div>
            <h2
              className="text-5xl lg:text-6xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Turn Checkpoints Into
              <br />
              <span
                className="font-bold"
                style={{
                  background: `linear-gradient(to right, ${LANDING_COLORS.primary}, ${LANDING_COLORS.foreground70})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Shareable Reports
              </span>
            </h2>
            <p
              className="text-xl max-w-3xl mx-auto font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Generate branded PDFs from your timeline—frozen at generation time
              so what you share stays accurate. Pick a purpose, preview sections,
              then download or send a link.
            </p>
            <p
              className="text-sm max-w-2xl mx-auto font-light mt-6"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Insurance teams can request a redacted sample during a pilot — see{" "}
              <Link
                href="/solutions/insurance"
                className="underline underline-offset-4"
                style={{ color: LANDING_COLORS.primary }}
              >
                insurance solutions
              </Link>
              .
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                title: "Showing / listing",
                desc: "Single-date condition snapshot with executive summary, room status, and headline metrics—ideal before or after a showing.",
              },
              {
                title: "Move-in / move-out",
                desc: "Compare two periods with before/after photos, issue tables, and visual-diff callouts—built for security deposits and lease records.",
              },
              {
                title: "Insurance / claim",
                desc: "Document damage with photos, metrics, and change highlights in a formal PDF you can attach to a claim or share with an adjuster.",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="border rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 animate-stagger-in"
                style={{
                  backgroundColor: "rgba(20,20,28,0.6)",
                  backdropFilter: "blur(4px)",
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
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ color: LANDING_COLORS.foreground }}
                >
                  {item.title}
                </h3>
                <p
                  className="text-sm leading-relaxed font-light"
                  style={{ color: LANDING_COLORS.mutedForeground }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PilotSection colors={LANDING_COLORS} pilot={pilotConfig} />

      <LandingPricingSection colors={LANDING_COLORS} />

      {/* CTA Section - dark base and radial highlight */}
      <section className="py-32 relative overflow-hidden w-full">
        <div
          className="absolute inset-0 w-full"
          style={{
            background:
              "linear-gradient(to bottom right, #0a0a0f, #0f172a, #0a0a0f)",
          }}
        />
        <div
          className="absolute inset-0 w-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.12), transparent 70%)",
          }}
        />
        <div
          className="container relative mx-auto px-4"
          style={{ maxWidth: "1400px" }}
        >
          <div className="max-w-4xl mx-auto text-center space-y-10">
            <h2
              className="text-5xl lg:text-7xl font-light tracking-tight leading-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Experience the Complete
              <br />
              <span
                className="font-bold"
                style={{
                  background: `linear-gradient(to right, ${LANDING_COLORS.primary}, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Property Care Platform
              </span>
            </h2>
            <p
              className="text-xl max-w-2xl mx-auto font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              One unified platform for homeowners, landlords, and property
              managers to capture, understand, and act on everything their
              properties need.
            </p>
            <div className="flex flex-col sm:flex-row gap-5 justify-center pt-6">
              {user ? (
                <Link
                  href="/home"
                  onClick={handleButtonClick}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      LANDING_COLORS.primaryHover;
                    e.currentTarget.style.transform = "translateX(2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      LANDING_COLORS.primary;
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                  className="inline-flex items-center justify-center text-base px-12 py-8 rounded-lg font-medium shadow-2xl hover:shadow-primary/30 transition-all text-lg group"
                  style={{
                    backgroundColor: LANDING_COLORS.primary,
                    color: "#0a0a0f",
                  }}
                >
                  Dashboard
                  <svg
                    className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
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
                <Link
                  href="/login"
                  onClick={handleButtonClick}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      LANDING_COLORS.primaryHover;
                    e.currentTarget.style.transform = "translateX(2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      LANDING_COLORS.primary;
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                  className="inline-flex items-center justify-center text-base px-12 py-8 rounded-lg font-medium shadow-2xl hover:shadow-primary/30 transition-all text-lg group"
                  style={{
                    backgroundColor: LANDING_COLORS.primary,
                    color: "#0a0a0f",
                  }}
                >
                  Get Started
                  <svg
                    className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
              )}
              <a
                href="#contact"
                onClick={(e) => {
                  trackPilotCta("team_cta_footer");
                  handleNavClick(e, "#contact");
                }}
                className="inline-flex items-center justify-center rounded-lg font-medium border-2 transition-all"
                style={{
                  backgroundColor: "transparent",
                  borderColor: LANDING_COLORS.border,
                  color: LANDING_COLORS.foreground,
                  padding: "2rem 3rem",
                  fontSize: "1.125rem",
                  height: "auto",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    LANDING_COLORS.muted30)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                Talk to us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section
        id="contact"
        className="py-24 w-full border-t"
        style={{
          borderColor: LANDING_COLORS.border,
          backgroundColor: LANDING_COLORS.card,
        }}
      >
        <div className="container mx-auto px-4" style={{ maxWidth: "1400px" }}>
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2
              className="text-4xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Talk to our team
            </h2>
            <p
              className="text-lg font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Tell us about your portfolio, claims workflow, or field operations
              needs. We typically respond within one business day.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
              <a
                href={pilotContactHref}
                target={pilotContactExternal ? "_blank" : undefined}
                rel={pilotContactExternal ? "noopener noreferrer" : undefined}
                onClick={() => trackPilotCta("team_cta_contact")}
                className="inline-flex items-center justify-center rounded-lg px-8 py-4 text-base font-medium shadow-lg transition-all"
                style={{
                  backgroundColor: LANDING_COLORS.primary,
                  color: "#0a0a0f",
                }}
              >
                Get in touch
              </a>
              <a
                href={`mailto:${pilotsEmail}`}
                className="inline-flex items-center text-base font-medium underline underline-offset-4 transition-colors"
                style={{ color: LANDING_COLORS.primary }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = LANDING_COLORS.primaryHover)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = LANDING_COLORS.primary)
                }
              >
                {pilotsEmail}
              </a>
            </div>
            <p
              className="text-sm font-light pt-4"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              General questions?{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="underline underline-offset-2"
                style={{ color: LANDING_COLORS.foreground70 }}
              >
                {supportEmail}
              </a>
            </p>
          </div>
        </div>
      </section>

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
              <Link
                href="/"
                className="text-xl font-light tracking-tight"
                style={{ color: LANDING_COLORS.foreground }}
              >
                AssetMem <span className="font-bold">AI</span>
              </Link>
              <p
                className="text-sm"
                style={{ color: LANDING_COLORS.mutedForeground }}
              >
                Photos, documents, and AI intelligence for every property you manage.
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
                    href="#features"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="#reports"
                    className="transition-colors hover:text-foreground"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color =
                        LANDING_COLORS.mutedForeground)
                    }
                  >
                    Reports
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
                  {user ? (
                    <Link
                      href="/home"
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
                      Dashboard
                    </Link>
                  ) : (
                    <Link
                      href="/login"
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
                      Sign In
                    </Link>
                  )}
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
                    href="#pilot"
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
                    href="#contact"
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
  );
}
