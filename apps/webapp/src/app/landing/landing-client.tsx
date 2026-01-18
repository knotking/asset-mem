"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import AIGraphic from "./ai-graphic";
import { LandingHeader } from "./landing-header";
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

  useEffect(() => {
    // Only run on client side to avoid hydration issues
    if (typeof window === "undefined") return;

    // Next.js Link components automatically prefetch internal routes, so no manual prefetching needed

    // Check scroll position on mount and scroll events
    const checkScrollPosition = () => {
      const scrollY = window.scrollY;

      if (scrollY < 100) {
        setActiveSection("");
        return;
      }

      const sections = [
        { id: "top-things", el: document.querySelector("#top-things") },
        { id: "ai-agents", el: document.querySelector("#ai-agents") },
        { id: "timeline-feature", el: document.querySelector("#timeline-feature") },
        { id: "how-it-works", el: document.querySelector("#how-it-works") },
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

      {/* Hero Section - dark gradient and radial glows */}
      <section className="relative overflow-hidden w-full">
        <div
          className="absolute inset-0 w-full"
          style={{
            background: "linear-gradient(to bottom right, #0a0a0f, #0f172a, #0a0a0f)",
          }}
        />
        <div
          className="absolute inset-0 w-full"
          style={{
            background: "radial-gradient(circle at 30% 20%, rgba(34,211,238,0.12), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 w-full"
          style={{
            background: "radial-gradient(circle at 70% 80%, rgba(249,115,22,0.08), transparent 50%)",
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
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center text-base rounded-lg font-medium border-2 transition-all"
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
                </a>
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

      {/* Top Things Section */}
      <section
        id="top-things"
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
        <div className="container relative mx-auto px-4" style={{ maxWidth: "1400px" }}>
          <div className="text-center mb-20 space-y-6">
            <div
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-sm"
              style={{
                backgroundColor: LANDING_COLORS.primaryLight,
                borderColor: LANDING_COLORS.primaryBorder,
              }}
            >
              <span className="text-sm font-semibold tracking-wide" style={{ color: LANDING_COLORS.primary }}>
                PLATFORM FEATURES
              </span>
            </div>
            <h2 className="text-5xl lg:text-6xl font-light tracking-tight" style={{ color: LANDING_COLORS.foreground }}>
              The Top Things
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
                We Do for You
              </span>
            </h2>
            <p className="text-xl max-w-2xl mx-auto font-light" style={{ color: LANDING_COLORS.mutedForeground }}>
              Powerful AI-driven tools designed to simplify property maintenance and maximize efficiency
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {[
              {
                title: "Instant Diagnostics",
                desc: "Get AI-powered analysis of property issues in seconds.",
                icon: "M13 10V3L4 14h7v7l9-11h-7z",
              },
              {
                title: "Property Checkpoints",
                desc: "Visual timeline, condition scores, before/after comparison, and health metrics.",
                icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
              },
              {
                title: "Multimodal Analysis",
                desc: "Photos, videos, and documents analyzed by Gemini-powered AI.",
                icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z",
              },
              {
                title: "Document Intelligence",
                desc: "Your warranties, manuals, and receipts become a searchable RAG knowledge base.",
                icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
              },
              {
                title: "DIY + Service Discovery",
                desc: "Step-by-step guidance, local providers, and product recommendations.",
                icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
              },
              {
                title: "Cost Transparency",
                desc: "Compare DIY vs. professional costs and coverage.",
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
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.white }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ color: LANDING_COLORS.foreground }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed font-light" style={{ color: LANDING_COLORS.mutedForeground }}>
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
        <div className="container relative mx-auto px-4" style={{ maxWidth: "1400px" }}>
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
              <span className="text-sm font-semibold tracking-wide" style={{ color: LANDING_COLORS.primary }}>
                AI-POWERED INTELLIGENCE
              </span>
            </div>
            <h2 className="text-5xl lg:text-6xl font-light tracking-tight" style={{ color: LANDING_COLORS.foreground }}>
              Specialized AI Agents
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
                Working Together
              </span>
            </h2>
            <p className="text-xl max-w-3xl mx-auto font-light leading-relaxed" style={{ color: LANDING_COLORS.mutedForeground }}>
              Our multi-agent AI system orchestrates specialized agents that collaborate to analyze your property issues from every angle, delivering comprehensive and actionable solutions tailored to your needs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {[
              {
                title: "Triage Agent",
                desc: "Analyzes your issue to understand the problem, severity, and urgency. Identifies the affected property areas and determines the best course of action.",
                icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
              },
              {
                title: "Coverage Agent",
                desc: "Searches your warranties, insurance policies, and service contracts to determine if your issue is covered. Provides relevant policy details and claim guidance.",
                icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
              },
              {
                title: "DIY Agent",
                desc: "Provides step-by-step instructions for fixing issues yourself. Includes required tools, materials, safety precautions, and estimated time to complete.",
                icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
              },
              {
                title: "Service Agent",
                desc: "Finds qualified local service providers for your issue. Uses location-based search to recommend contractors, handymen, and specialists with ratings and reviews.",
                icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
              },
              {
                title: "Cost Agent",
                desc: "Provides transparent cost estimates comparing DIY vs. professional service options. Includes material costs, labor estimates, and potential savings.",
                icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              },
              {
                title: "Orchestration",
                desc: "All agents work in harmony, sharing insights and coordinating their analyses to provide you with a complete, unified solution that addresses every aspect of your property issue.",
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
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.white }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: LANDING_COLORS.foreground }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed font-light" style={{ color: LANDING_COLORS.mutedForeground }}>
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
        <div className="container relative mx-auto px-4" style={{ maxWidth: "1400px" }}>
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-10">
              <div>
                <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-4" style={{ color: LANDING_COLORS.foreground }}>
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
                <p className="text-lg font-light" style={{ color: LANDING_COLORS.mutedForeground }}>
                  Photos, scores, before/after—and health metrics that help you stay ahead.
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
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.primary }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={block.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold mb-1" style={{ color: LANDING_COLORS.foreground }}>
                      {block.title}
                    </h3>
                    <p className="text-sm font-light leading-relaxed" style={{ color: LANDING_COLORS.mutedForeground }}>
                      {block.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center lg:justify-end">
              <div
                className="w-full max-w-sm aspect-[4/3] rounded-2xl border flex items-center justify-center"
                style={{
                  borderColor: LANDING_COLORS.border,
                  backgroundColor: "rgba(20,20,28,0.6)",
                }}
              >
                <div className="text-center px-6">
                  <div
                    className="inline-flex h-16 w-16 rounded-2xl items-center justify-center mx-auto mb-4"
                    style={{
                      background: `linear-gradient(to right bottom, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`,
                    }}
                  >
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: LANDING_COLORS.white }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium" style={{ color: LANDING_COLORS.foreground }}>
                    Timeline
                  </p>
                  <p className="text-xs font-light mt-1" style={{ color: LANDING_COLORS.mutedForeground }}>
                    Before / After
                  </p>
                </div>
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
        <div className="container relative mx-auto px-4" style={{ maxWidth: "1400px" }}>
          <div className="text-center mb-16 space-y-4">
            <div
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-sm"
              style={{
                backgroundColor: LANDING_COLORS.primaryLight,
                borderColor: LANDING_COLORS.primaryBorder,
              }}
            >
              <span className="text-sm font-semibold tracking-wide" style={{ color: LANDING_COLORS.primary }}>
                SIMPLE FLOW
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight" style={{ color: LANDING_COLORS.foreground }}>
              How It Works
            </h2>
            <p className="text-lg max-w-2xl mx-auto font-light" style={{ color: LANDING_COLORS.mutedForeground }}>
              Four steps from your question to actionable recommendations
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { step: 1, title: "Upload or Ask", desc: "Share photos, videos, documents, or just type your question in chat." },
              { step: 2, title: "AI Analyzes", desc: "Multi-agent system: Triage, Coverage, DIY, Service, and Cost agents work together." },
              { step: 3, title: "Get Recommendations", desc: "Diagnosis, DIY steps, local providers, warranty info, and cost comparison." },
              { step: 4, title: "Take Action", desc: "Track changes in Checkpoints, share with contractors, or handle it yourself." },
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
                <h3 className="font-bold text-lg mb-2" style={{ color: LANDING_COLORS.foreground }}>
                  {item.title}
                </h3>
                <p className="text-sm font-light leading-relaxed" style={{ color: LANDING_COLORS.mutedForeground }}>
                  {item.desc}
                </p>
                {item.step < 4 && (
                  <div className="hidden lg:block absolute top-8 -right-4 w-8 h-0.5" style={{ backgroundColor: LANDING_COLORS.primary20 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - dark base and radial highlight */}
      <section className="py-32 relative overflow-hidden w-full">
        <div
          className="absolute inset-0 w-full"
          style={{
            background: "linear-gradient(to bottom right, #0a0a0f, #0f172a, #0a0a0f)",
          }}
        />
        <div
          className="absolute inset-0 w-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.12), transparent 70%)",
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
                  background: `linear-gradient(to right, ${LANDING_COLORS.primary}, ${LANDING_COLORS.primary}, rgba(34,211,238,0.6))`,
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
                href="#how-it-works"
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
                Schedule Demo
              </a>
            </div>
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
                    href="#top-things"
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
