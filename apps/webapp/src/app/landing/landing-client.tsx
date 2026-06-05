"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import AIGraphic from "./ai-graphic";
import { LandingHeader } from "./landing-header";
import { LandingPricingSection } from "./landing-pricing-section";
import { YouTubeModal } from "@/components/landing/youtube-modal";
import { trackLandingCta } from "@/lib/analytics";
import { getSupportEmail } from "@/lib/site";
import "./landing-animations.css";

// Dark theme - landing page only
const LANDING_COLORS = {
  primary: "#22d3ee",
  primaryHover: "rgba(34, 211, 238, 0.9)",
  primaryLight: "rgba(34, 211, 238, 0.1)",
  primaryBorder: "rgba(34, 211, 238, 0.2)",
  primary20: "rgba(34, 211, 238, 0.2)",
  primary10: "rgba(34, 211, 238, 0.1)",
  background: "#0a0a0f",
  backgroundOverlay: "rgba(10, 10, 15, 0.85)",
  background95: "rgba(10, 10, 15, 0.95)",
  foreground: "#fafafa",
  foreground90: "rgba(250, 250, 250, 0.9)",
  foreground70: "rgba(250, 250, 250, 0.7)",
  foreground60: "rgba(250, 250, 250, 0.6)",
  card: "#14141c",
  cardOverlay: "rgba(20, 20, 28, 0.5)",
  muted: "#14141c",
  muted30: "rgba(255, 255, 255, 0.08)",
  mutedForeground: "rgba(255, 255, 255, 0.65)",
  border: "rgba(255, 255, 255, 0.08)",
  borderOverlay: "rgba(255, 255, 255, 0.1)",
  border50: "rgba(255, 255, 255, 0.12)",
  secondary: "#22d3ee",
  secondaryLight: "rgba(34, 211, 238, 0.1)",
  secondaryBorder: "rgba(34, 211, 238, 0.2)",
  accent: "#f97316",
  accentLight: "rgba(249, 115, 22, 0.1)",
  accent10: "rgba(249, 115, 22, 0.1)",
  white: "rgb(255, 255, 255)",
};

export default function LandingPageClient() {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<string>("");
  const [isMobile, setIsMobile] = useState<boolean>(false);

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

      const sections = [
        { id: "use-cases", el: document.querySelector("#use-cases") },
        { id: "features", el: document.querySelector("#features") },
        { id: "ai-agents", el: document.querySelector("#ai-agents") },
        {
          id: "timeline-feature",
          el: document.querySelector("#timeline-feature"),
        },
        { id: "how-it-works", el: document.querySelector("#how-it-works") },
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

    if (targetId === "#") {
      // Scroll to top for Home with smooth animation
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } else {
      const element = document.querySelector(targetId) as HTMLElement;
      if (element) {
        const headerOffset = 80; // Account for sticky header
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition =
          elementPosition + window.pageYOffset - headerOffset;

        // Smooth scroll to the element
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });

        // Add fade-in animation to the section when scrolled to
        setTimeout(() => {
          element.classList.add("fade-in-up");
          // Add highlight animation
          element.classList.add("animate-highlight");

          // Remove animations after they complete
          setTimeout(() => {
            element.classList.remove("animate-highlight");
            element.classList.remove("fade-in-up");
          }, 2000);
        }, 300); // Small delay to sync with scroll
      }
    }
  };

  // IMPORTANT: All hooks must be called before any conditional returns (Rules of Hooks)

  // While auth is loading, show minimal loading state to prevent flash
  // Once loading is complete, show landing page (which will handle button display)
  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ backgroundColor: LANDING_COLORS.background }}
      >
        {/* Minimal spinner - matches landing page design */}
        {/* <div className="flex flex-col items-center gap-3">
          <div 
            className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" 
            style={{ borderColor: LANDING_COLORS.primary }}
          ></div>
        </div> */}
      </div>
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
        onNavClick={handleNavClick}
        onButtonClick={handleButtonClick}
      />

      {/* Hero Section - dark gradient and radial glows */}
      <section className="relative overflow-hidden w-full">
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
              "radial-gradient(circle at 30% 20%, rgba(34,211,238,0.12), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 w-full"
          style={{
            background:
              "radial-gradient(circle at 70% 80%, rgba(249,115,22,0.08), transparent 50%)",
          }}
        />

        <div
          className="container relative mx-auto px-4 py-24 lg:py-40"
          style={{ maxWidth: "1400px" }}
        >
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            {/* Left: Text Content */}
            <div className="space-y-10">
              <div
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-sm hover:shadow-md transition-shadow"
                style={{
                  backgroundColor: LANDING_COLORS.primaryLight,
                  borderColor: LANDING_COLORS.primaryBorder,
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 animate-pulse"
                  style={{ color: LANDING_COLORS.primary }}
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span
                  className="text-sm font-semibold tracking-wide"
                  style={{ color: LANDING_COLORS.primary }}
                >
                  AI-POWERED INNOVATION
                </span>
              </div>

              <div className="space-y-6">
                <h1
                  className="text-6xl lg:text-8xl font-light tracking-tight leading-none"
                  style={{ color: LANDING_COLORS.foreground }}
                >
                  AssetMem
                  <br />
                  <span
                    className="font-bold"
                    style={{
                      background: `linear-gradient(to right, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    AI
                  </span>
                </h1>
                <h2
                  className="text-3xl lg:text-4xl font-light leading-tight"
                  style={{ color: LANDING_COLORS.foreground90 }}
                >
                  Your Complete
                  <br />
                  <span className="font-medium">Home Care Platform</span>
                </h2>
              </div>

              <p
                className="text-xl leading-relaxed max-w-xl font-light"
                style={{ color: LANDING_COLORS.foreground60 }}
              >
                A comprehensive platform centered on property checkpoints,
                condition timelines, document intelligence, and service
                planning, all working together to simplify your home care
                journey.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
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
                    className="inline-flex items-center text-base px-10 py-7 rounded-lg font-medium shadow-xl hover:shadow-2xl transition-all group"
                    style={{
                      backgroundColor: LANDING_COLORS.primary,
                      color: "#0a0a0f",
                    }}
                  >
                    Dashboard
                    <svg
                      className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
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
                    className="inline-flex items-center text-base px-10 py-7 rounded-lg font-medium shadow-xl hover:shadow-2xl transition-all group"
                    style={{
                      backgroundColor: LANDING_COLORS.primary,
                      color: "#0a0a0f",
                    }}
                  >
                    Get Started
                    <svg
                      className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
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
                <YouTubeModal
                  url={
                    isMobile
                      ? "https://youtu.be/vn03juDFkss"
                      : "https://youtu.be/3AM-hzbMOL4"
                  }
                  trigger={
                    <button
                      className="inline-flex items-center justify-center text-base rounded-lg font-medium border-2 transition-all cursor-pointer"
                      style={{
                        backgroundColor: "transparent",
                        borderColor: LANDING_COLORS.border,
                        color: LANDING_COLORS.foreground,
                        padding: "1.75rem 2.5rem",
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
                      Watch Demo
                    </button>
                  }
                />
              </div>
            </div>

            {/* Right: Hero Visual */}
            <AIGraphic />
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
              From routine walkthroughs to seasonal planning, see how
              checkpoint-driven workflows help homeowners stay ahead
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-7xl mx-auto">
            {[
              {
                title: "Seasonal Property Walkthrough",
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
                  "Built a proactive plan that prevented in-season surprises",
              },
              {
                title: "Property Condition Tracking",
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
                title: "Insurance Claim Documentation",
                scenario: "Storm damage to roof requires insurance claim proof",
                icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
                color: LANDING_COLORS.primary,
                steps: [
                  "Platform auto-compares before/after checkpoint photos",
                  "AI detects: missing shingles, damaged flashing, water damage",
                  "Generates professional comparison report with timestamps",
                  "Export PDF with visual evidence for insurance adjuster",
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
                title: "Renovation Progress Tracking",
                scenario:
                  "Track kitchen and bath updates across contractor visits",
                icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                color: LANDING_COLORS.accent,
                steps: [
                  "Capture before/after checkpoints for each milestone",
                  "Compare workmanship and finish quality over time",
                  "Attach invoices, warranties, and notes to each checkpoint",
                  "Share one visual timeline with your contractor and family",
                ],
                result: "Kept everyone aligned with one source of truth",
              },
              {
                title: "Preventive Maintenance Planning",
                scenario: "Proactive property care to avoid costly repairs",
                icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
                color: LANDING_COLORS.primary,
                steps: [
                  "Monthly checkpoints show kitchen cabinet condition declining",
                  "Platform tracks deterioration rate: -0.5 points/month",
                  "AI suggests: 'Consider refinishing in 3-6 months'",
                  "Share timeline with contractor, get quote, plan budget",
                ],
                result: "Refinished cabinets for $1,200 vs $8,000 replacement",
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

      {/* Features Section */}
      <section
        id="features"
        className="py-32 relative overflow-hidden w-full transition-all duration-1000"
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
                INTEGRATED PLATFORM SERVICES
              </span>
            </div>
            <h2
              className="text-5xl lg:text-6xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Everything You Need
              <br />
              <span
                className="font-bold"
                style={{
                  background: `linear-gradient(to right, ${LANDING_COLORS.foreground}, ${LANDING_COLORS.foreground70})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                In One Platform
              </span>
            </h2>
            <p
              className="text-xl max-w-2xl mx-auto font-light"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              A unified platform where checkpoints, timeline insights,
              document management, and service planning work together
              seamlessly
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {[
              {
                title: "Checkpoint Timeline",
                desc: "Capture recurring walkthroughs, compare before/after states, and maintain a clear visual history for every area.",
                icon: "M13 10V3L4 14h7v7l9-11h-7z",
              },
              {
                title: "Property Checkpoints",
                desc: "Condition scoring and trend tracking that help you prioritize repairs and preventive tasks.",
                icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
              },
              {
                title: "Chat with Your Documents",
                desc: "Ask questions about your warranties, manuals, inspection reports, and policies—get instant answers with citations.",
                icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
              },
              {
                title: "Photo and Video Comparisons",
                desc: "Review changes across checkpoints with visual diffs, similarity scoring, and contextual notes.",
                icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z",
              },
              {
                title: "Document Intelligence",
                desc: "AI-powered property care that connects checkpoint analysis, your documents, and maintenance recommendations.",
                icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
              },
              {
                title: "Service Marketplace",
                desc: "Discover and connect with local providers based on checkpoint findings and maintenance priorities.",
                icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
              },
              {
                title: "Maintenance Planning",
                desc: "Turn checkpoint trends into repair priorities, budget forecasts, and scheduling plans.",
                icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="border rounded-lg transition-all duration-500 hover:-translate-y-2 p-6 animate-stagger-in"
                style={{
                  backgroundColor: "rgba(20,20,28,0.6)",
                  backdropFilter: "blur(4px)",
                  borderColor: LANDING_COLORS.border,
                  animationDelay: `${i * 0.08}s`,
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
                <div
                  className="h-14 w-14 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`,
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
                      d={item.icon}
                    />
                  </svg>
                </div>
                <h3
                  className="text-xl font-bold mb-2"
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

      {/* AI Agents Section */}
      <section
        id="ai-agents"
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                style={{ color: LANDING_COLORS.primary }}
              >
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2Z" />
              </svg>
              <span
                className="text-sm font-semibold tracking-wide"
                style={{ color: LANDING_COLORS.primary }}
              >
                CHECKPOINT-POWERED INTELLIGENCE
              </span>
            </div>
            <h2
              className="text-5xl lg:text-6xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Platform Intelligence
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
                Powered by AI Agents
              </span>
            </h2>
            <p
              className="text-xl max-w-3xl mx-auto font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Our multi-agent system is anchored on checkpoint intelligence:
              retrieve relevant property history first, then orchestrate
              coverage, DIY, service, and cost planning from the same
              checkpoint context.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {[
              {
                title: "Checkpoint Agent",
                desc: "Retrieves relevant checkpoints using semantic vector search, then orchestrates coverage, DIY, service, and cost planning from the same checkpoint context.",
                icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
              },
              {
                title: "Coverage Agent",
                desc: "Checks warranties, insurance policies, and service contracts using checkpoint context and supporting documents.",
                icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
              },
              {
                title: "DIY Agent",
                desc: "Provides step-by-step repair guidance aligned to checkpoint findings, required tools, safety notes, and effort estimates.",
                icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
              },
              {
                title: "Service Agent",
                desc: "Finds local providers based on checkpoint location and condition details, with relevance for the required work.",
                icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
              },
              {
                title: "Cost Agent",
                desc: "Estimates costs from checkpoint evidence, comparing DIY and professional options with clearer budget planning.",
                icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              },
              {
                title: "Platform Orchestration",
                desc: "All agents share insights across the platform, connecting your diagnostics, documents, checkpoints, and services into one unified intelligence system.",
                icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 17a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM14 17a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1v-2z",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="border rounded-lg transition-all duration-500 hover:-translate-y-2 p-6 animate-stagger-in"
                style={{
                  backgroundColor: "rgba(20,20,28,0.6)",
                  backdropFilter: "blur(4px)",
                  borderColor: LANDING_COLORS.border,
                  animationDelay: `${i * 0.08}s`,
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
                <div
                  className="h-14 w-14 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`,
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
                      d={item.icon}
                    />
                  </svg>
                </div>
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
                    Your Visual Timeline
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
                  title: "Visual Timeline",
                  desc: "Capture photos/videos of property areas over time; track condition with before/after comparisons; AI-powered analysis; automatic room/area detection.",
                  icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
                },
                {
                  title: "AI-Powered Analysis",
                  desc: "Condition scoring (0–100); damage detection and severity; detected items/features; issue categories (critical, major, moderate, minor); cost estimates.",
                  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 4a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v10a2 2 0 002 2zm0 0V5a2 2 0 012-2h2a2 2 0 012 2v14",
                },
                {
                  title: "Automatic Comparison",
                  desc: "Intelligent comparison with previous checkpoints; visual diff and similarity scoring; change detection; configurable comparison preferences.",
                  icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
                },
                {
                  title: "Timeline (Before/After)",
                  desc: "Visual timeline showing checkpoint changes over time with before/after comparisons and condition context.",
                  icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                },
                {
                  title: "Property Health Metrics",
                  desc: "Overall condition score and trend; issues summary by severity; deterioration rate; predictive maintenance insights.",
                  icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
                },
                {
                  title: "Real-Time & Scalable",
                  desc: "Non-blocking creation; real-time UI updates; built to scale.",
                  icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
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
                    INTELLIGENT DOCUMENT CHAT
                  </span>
                </div>
                <h2
                  className="text-4xl lg:text-5xl font-light tracking-tight mb-4"
                  style={{ color: LANDING_COLORS.foreground }}
                >
                  Talk to Your
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
                    Documents
                  </span>
                </h2>
                <p
                  className="text-lg font-light leading-relaxed"
                  style={{ color: LANDING_COLORS.mutedForeground }}
                >
                  Upload your home inspection reports, warranties, manuals, and
                  policies—then chat with them naturally. Get instant answers
                  with precise citations.
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
                PLATFORM WORKFLOW
              </span>
            </div>
            <h2
              className="text-4xl lg:text-5xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              How the Platform Works
            </h2>
            <p
              className="text-lg max-w-2xl mx-auto font-light"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              From checkpoint capture to maintenance planning, everything
              connected in one unified platform
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              {
                step: 1,
                title: "Upload & Connect",
                desc: "Add documents, photos, videos, and create property checkpoints. Everything syncs to your unified platform.",
              },
              {
                step: 2,
                title: "Platform Intelligence",
                desc: "Platform intelligence analyzes your checkpoint history and documents to highlight maintenance priorities.",
              },
              {
                step: 3,
                title: "Unified Insights",
                desc: "Get comprehensive answers: compare checkpoints, chat with documents, and plan services with full context.",
              },
              {
                step: 4,
                title: "Manage & Track",
                desc: "Monitor property health, share with contractors, and keep everything organized in one place.",
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
                Home Care Platform
              </span>
            </h2>
            <p
              className="text-xl max-w-2xl mx-auto font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Join thousands of homeowners and property managers using our
              unified platform for all their home care needs
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
                  className="inline-flex items-center text-base px-12 py-8 rounded-lg font-medium shadow-2xl hover:shadow-primary/30 transition-all text-lg group"
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
                  className="inline-flex items-center text-base px-12 py-8 rounded-lg font-medium shadow-2xl hover:shadow-primary/30 transition-all text-lg group"
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
                onClick={(e) => handleNavClick(e, "#contact")}
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
                Contact us
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
              Get in touch
            </h2>
            <p
              className="text-lg font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Questions about AssetMem AI, partnerships, or enterprise use — we&apos;d love to hear
              from you.
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center text-lg font-medium underline underline-offset-4 transition-colors"
              style={{ color: LANDING_COLORS.primary }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = LANDING_COLORS.primaryHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = LANDING_COLORS.primary)
              }
            >
              {supportEmail}
            </a>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
                Your complete home care platform for checkpoint tracking,
                property documentation, and service planning in one unified
                solution.
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
