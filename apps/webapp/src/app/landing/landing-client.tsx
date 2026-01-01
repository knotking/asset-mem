"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import AIGraphic from "./ai-graphic";
import { LandingHeader } from "./landing-header";
import "./landing-animations.css";

// Template colors from extracted design - used only in landing page
const LANDING_COLORS = {
  primary: "rgb(8, 142, 175)", // hsl(192, 91%, 36%)
  primaryHover: "rgba(8, 142, 175, 0.9)",
  primaryLight: "rgba(8, 142, 175, 0.1)",
  primaryBorder: "rgba(8, 142, 175, 0.2)",
  primary20: "rgba(8, 142, 175, 0.2)",
  primary10: "rgba(8, 142, 175, 0.1)",
  background: "rgb(250, 250, 250)", // hsl(0, 0%, 98%)
  backgroundOverlay: "rgba(250, 250, 250, 0.8)",
  background95: "rgba(250, 250, 250, 0.95)",
  foreground: "rgb(10, 10, 10)", // hsl(0, 0%, 4%)
  foreground90: "rgba(10, 10, 10, 0.9)",
  foreground70: "rgba(10, 10, 10, 0.7)",
  foreground60: "rgba(10, 10, 10, 0.6)",
  card: "hsl(192, 71%, 72%)",
  cardOverlay: "hsla(192, 71%, 72%, 0.3)",
  muted: "hsl(192, 71%, 72%)",
  muted30: "hsla(192, 71%, 72%, 0.3)",
  mutedForeground: "rgba(10, 10, 10, 0.6)",
  border: "hsl(191, 62%, 86%)",
  borderOverlay: "rgba(191, 219, 254, 0.4)",
  border50: "rgba(191, 219, 254, 0.5)",
  secondary: "rgb(8, 142, 175)", // Using primary for secondary
  secondaryLight: "rgba(8, 142, 175, 0.1)",
  secondaryBorder: "rgba(8, 142, 175, 0.2)",
  accent: "rgb(175, 42, 8)", // hsl(12, 91%, 36%)
  accentLight: "rgba(175, 42, 8, 0.05)",
  accent10: "rgba(175, 42, 8, 0.1)",
  white: "rgb(255, 255, 255)",
};

export default function LandingPageClient() {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<string>("");

  // Debug logging for auth state
  useEffect(() => {
    console.log("[LandingPage] Auth State Debug:", {
      user: user
        ? `Logged in: ${user.email || "No email"}`
        : "Not logged in (null/undefined)",
      loading,
      shouldShowSignIn: !loading && !user,
      shouldShowGoToApp: !loading && !!user,
    });
  }, [user, loading]);

  useEffect(() => {
    // Only run on client side to avoid hydration issues
    if (typeof window === "undefined") return;

    // Next.js Link components automatically prefetch internal routes, so no manual prefetching needed

    // Check scroll position on mount and scroll events
    const checkScrollPosition = () => {
      const scrollY = window.scrollY;

      // If at the top, set active section to empty (Home)
      if (scrollY < 100) {
        setActiveSection("");
        return;
      }

      // Check which section is in view
      const featuresEl = document.querySelector("#features");

      if (featuresEl) {
        const rect = featuresEl.getBoundingClientRect();
        // Check if features section is in the upper portion of viewport
        if (rect.top <= 150 && rect.bottom >= 150) {
          setActiveSection("features");
        } else if (rect.top > 150) {
          // If features is below viewport, we're still at home
          setActiveSection("");
        }
      }
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
      // Clean up scroll listener
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleButtonClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>
  ) => {
    // Track analytics if available
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "click", {
        event_category: "CTA",
        event_label: "Dashboard Button",
      });
    }
  };

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
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

      {/* Hero Section - matching source exactly */}
      <section className="relative overflow-hidden w-full">
        {/* Animated Background Gradient */}
        <div
          className="absolute inset-0 w-full"
          style={{
            background: `linear-gradient(to right bottom, ${LANDING_COLORS.primaryLight}, ${LANDING_COLORS.background}, ${LANDING_COLORS.accentLight})`,
          }}
        />
        <div
          className="absolute inset-0 w-full"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, rgba(8,145,178,0.1), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 w-full"
          style={{
            background:
              "radial-gradient(circle at 70% 80%, rgba(178,41,8,0.05), transparent 50%)",
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
                  HomeGeek
                  <br />
                  <span
                    className="font-bold"
                    style={{
                      background: `linear-gradient(to right, ${LANDING_COLORS.primary}, rgba(8, 142, 175, 0.6))`,
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
                  Intelligent Home Care &
                  <br />
                  <span className="font-medium">Property Diagnostics</span>
                </h2>
              </div>

              <p
                className="text-xl leading-relaxed max-w-xl font-light"
                style={{ color: LANDING_COLORS.foreground60 }}
              >
                Transform property maintenance with advanced AI diagnostics. Get
                instant insights, expert recommendations, and proactive
                guidance—powered by cutting-edge artificial intelligence.
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
                      color: LANDING_COLORS.white,
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
                      color: LANDING_COLORS.white,
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
                <button
                  className="inline-flex items-center justify-center text-base rounded-lg font-medium border-2 transition-all"
                  style={{
                    backgroundColor: "transparent",
                    borderColor: LANDING_COLORS.border,
                    color: LANDING_COLORS.foreground,
                    padding: "1.75rem 2.5rem", // py-7 px-10
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
              </div>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-8 pt-6">
                <div className="flex items-center gap-4 group cursor-default">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm"
                    style={{
                      background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary20}, ${LANDING_COLORS.primary10})`,
                    }}
                  >
                    <svg
                      className="h-7 w-7"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: LANDING_COLORS.primary }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div
                      className="text-3xl font-bold"
                      style={{
                        background: `linear-gradient(to right, ${LANDING_COLORS.foreground}, ${LANDING_COLORS.foreground70})`,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      10,000+
                    </div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: LANDING_COLORS.mutedForeground }}
                    >
                      Active Users
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 group cursor-default">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm"
                    style={{
                      background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary20}, ${LANDING_COLORS.primary10})`,
                    }}
                  >
                    <svg
                      className="h-7 w-7"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: LANDING_COLORS.primary }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                  <div>
                    <div
                      className="text-3xl font-bold"
                      style={{
                        background: `linear-gradient(to right, ${LANDING_COLORS.foreground}, ${LANDING_COLORS.foreground70})`,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      98%
                    </div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: LANDING_COLORS.mutedForeground }}
                    >
                      Accuracy Rate
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Hero Visual */}
            <AIGraphic />
          </div>
        </div>
      </section>

      {/* Features Section - matching source exactly */}
      <section
        id="features"
        className="py-32 relative overflow-hidden w-full transition-all duration-1000"
        style={{ backgroundColor: LANDING_COLORS.muted30 }}
      >
        <div
          className="absolute inset-0 w-full"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(128, 128, 128, 0.07) 1px, transparent 1px), linear-gradient(rgba(128, 128, 128, 0.07) 1px, transparent 1px)",
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
                PLATFORM FEATURES
              </span>
            </div>
            <h2
              className="text-5xl lg:text-6xl font-light tracking-tight"
              style={{ color: LANDING_COLORS.foreground }}
            >
              Everything You Need,
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
                Nothing You Don't
              </span>
            </h2>
            <p
              className="text-xl max-w-2xl mx-auto font-light"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Powerful AI-driven tools designed to simplify property maintenance
              and maximize efficiency
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Feature 1 */}
            <div
              className="border-2 rounded-lg transition-all duration-500 hover:-translate-y-2 group"
              style={{
                backgroundColor: `${LANDING_COLORS.background}80`,
                backdropFilter: "blur(4px)",
                borderColor: LANDING_COLORS.border,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${LANDING_COLORS.primary}80`;
                e.currentTarget.style.boxShadow = `0 25px 50px -12px ${LANDING_COLORS.primary}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = LANDING_COLORS.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="pt-12 pb-12 px-8 space-y-6">
                <div
                  className="h-20 w-20 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300"
                  style={{
                    background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary}, rgba(8, 142, 175, 0.6))`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.1) rotate(3deg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1) rotate(0deg)";
                  }}
                >
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: LANDING_COLORS.white }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <div className="space-y-4">
                  <h3
                    className="text-2xl font-bold transition-colors"
                    style={{ color: LANDING_COLORS.foreground }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.primary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                  >
                    AI-Powered Diagnostics
                  </h3>
                  <p
                    className="leading-relaxed font-light"
                    style={{ color: LANDING_COLORS.mutedForeground }}
                  >
                    Advanced multimodal AI analyzes images, videos, and sensor
                    data to identify issues before they become costly problems.
                    Get accurate assessments in seconds.
                  </p>
                </div>
                <div
                  className="flex items-center gap-2 font-semibold transition-all cursor-pointer"
                  style={{ color: LANDING_COLORS.primary }}
                  onMouseEnter={(e) => (e.currentTarget.style.gap = "1rem")}
                  onMouseLeave={(e) => (e.currentTarget.style.gap = "0.5rem")}
                >
                  Learn more{" "}
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div
              className="border-2 rounded-lg transition-all duration-500 hover:-translate-y-2 group"
              style={{
                backgroundColor: `${LANDING_COLORS.background}80`,
                backdropFilter: "blur(4px)",
                borderColor: LANDING_COLORS.border,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${LANDING_COLORS.primary}80`;
                e.currentTarget.style.boxShadow = `0 25px 50px -12px ${LANDING_COLORS.primary}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = LANDING_COLORS.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="pt-12 pb-12 px-8 space-y-6">
                <div
                  className="h-20 w-20 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300"
                  style={{
                    background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary}, rgba(8, 142, 175, 0.6))`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.1) rotate(3deg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1) rotate(0deg)";
                  }}
                >
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: LANDING_COLORS.white }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div className="space-y-4">
                  <h3
                    className="text-2xl font-bold transition-colors"
                    style={{ color: LANDING_COLORS.foreground }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.primary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                  >
                    Cross-Platform Access
                  </h3>
                  <p
                    className="leading-relaxed font-light"
                    style={{ color: LANDING_COLORS.mutedForeground }}
                  >
                    Seamlessly sync across web and mobile devices. Access your
                    property data, maintenance history, and AI insights
                    anywhere, anytime.
                  </p>
                </div>
                <div
                  className="flex items-center gap-2 font-semibold transition-all cursor-pointer"
                  style={{ color: LANDING_COLORS.primary }}
                  onMouseEnter={(e) => (e.currentTarget.style.gap = "1rem")}
                  onMouseLeave={(e) => (e.currentTarget.style.gap = "0.5rem")}
                >
                  Learn more{" "}
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div
              className="border-2 rounded-lg transition-all duration-500 hover:-translate-y-2 group"
              style={{
                backgroundColor: `${LANDING_COLORS.background}80`,
                backdropFilter: "blur(4px)",
                borderColor: LANDING_COLORS.border,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${LANDING_COLORS.primary}80`;
                e.currentTarget.style.boxShadow = `0 25px 50px -12px ${LANDING_COLORS.primary}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = LANDING_COLORS.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="pt-12 pb-12 px-8 space-y-6">
                <div
                  className="h-20 w-20 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300"
                  style={{
                    background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary}, rgba(8, 142, 175, 0.6))`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.1) rotate(3deg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1) rotate(0deg)";
                  }}
                >
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: LANDING_COLORS.white }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div className="space-y-4">
                  <h3
                    className="text-2xl font-bold transition-colors"
                    style={{ color: LANDING_COLORS.foreground }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.primary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = LANDING_COLORS.foreground)
                    }
                  >
                    Expert Recommendations
                  </h3>
                  <p
                    className="leading-relaxed font-light"
                    style={{ color: LANDING_COLORS.mutedForeground }}
                  >
                    Receive personalized maintenance guidance and connect with
                    verified service providers. Get the right help at the right
                    time.
                  </p>
                </div>
                <div
                  className="flex items-center gap-2 font-semibold transition-all cursor-pointer"
                  style={{ color: LANDING_COLORS.primary }}
                  onMouseEnter={(e) => (e.currentTarget.style.gap = "1rem")}
                  onMouseLeave={(e) => (e.currentTarget.style.gap = "0.5rem")}
                >
                  Learn more{" "}
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - matching source exactly */}
      <section className="py-32 relative overflow-hidden w-full">
        <div
          className="absolute inset-0 w-full"
          style={{
            background: `linear-gradient(to right bottom, ${LANDING_COLORS.primaryLight}, ${LANDING_COLORS.background}, ${LANDING_COLORS.accentLight})`,
          }}
        />
        <div
          className="absolute inset-0 w-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(8,145,178,0.15), transparent 70%)",
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
              Ready to Transform Your
              <br />
              <span
                className="font-bold"
                style={{
                  background: `linear-gradient(to right, ${LANDING_COLORS.primary}, ${LANDING_COLORS.primary}, rgba(8, 142, 175, 0.6))`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Property Management?
              </span>
            </h2>
            <p
              className="text-xl max-w-2xl mx-auto font-light leading-relaxed"
              style={{ color: LANDING_COLORS.mutedForeground }}
            >
              Join thousands of homeowners and property managers who trust
              HomeGeek AI
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
                    color: LANDING_COLORS.white,
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
                    color: LANDING_COLORS.white,
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
              <button
                className="inline-flex items-center justify-center rounded-lg font-medium border-2 transition-all"
                style={{
                  backgroundColor: "transparent",
                  borderColor: LANDING_COLORS.border,
                  color: LANDING_COLORS.foreground,
                  padding: "2rem 3rem", // py-8 px-12
                  fontSize: "1.125rem", // text-lg
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
                Schedule Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - matching source exactly */}
      <footer
        className="mt-auto border-t py-12 w-full"
        style={{
          borderColor: LANDING_COLORS.border,
          backgroundColor: LANDING_COLORS.cardOverlay,
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
                HomeGeek <span className="font-bold">AI</span>
              </Link>
              <p
                className="text-sm"
                style={{ color: LANDING_COLORS.mutedForeground }}
              >
                Your AI-powered home care assistant for intelligent property
                diagnostics and maintenance.
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
                    href="#about"
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
                    href="#"
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
                    href="#"
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
            © {new Date().getFullYear()} HomeGeek AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
