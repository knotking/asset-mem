"use client";

import {
  getPilotMailtoHref,
  isEmbeddablePilotFormUrl,
  type PilotConfig,
} from "@/lib/pilot-config";
import { trackPilotCta } from "@/lib/analytics";
import type { LandingPricingPalette } from "@/components/billing/plan-pricing-cards";

const SEGMENTS = [
  {
    title: "Property managers",
    desc: "Portfolio inspections, turnover docs, and maintenance triage.",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    title: "Insurers & adjusters",
    desc: "Claims evidence packs with photos, metrics, and formal PDFs.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    title: "Service & field teams",
    desc: "Mobile capture, AI analysis, and shareable handoffs to the office.",
    icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    title: "Prop-tech platforms",
    desc: "Property intelligence layer for your product roadmap.",
    icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 17a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM14 17a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1v-2z",
  },
] as const;

const INCLUDED_TODAY = [
  "Checkpoint capture with AI condition scoring",
  "Formal PDF reports (insurance, move-in/out, listing)",
  "Document Q&A on inspections, policies, and warranties",
  "Shareable evidence links for reports and AI chat",
] as const;

const CO_DESIGNED = [
  "Workflow templates for your team",
  "Portfolio rollups and reporting cadence",
  "Integrations with your existing tools",
] as const;

type PilotSectionProps = {
  colors: LandingPricingPalette;
  pilot: PilotConfig;
};

export function PilotSection({ colors: c, pilot }: PilotSectionProps) {
  const formUrl = pilot.formUrl;
  const mailtoHref = getPilotMailtoHref(pilot.pilotsEmail);
  const showEmbed = formUrl && isEmbeddablePilotFormUrl(formUrl);

  const handlePilotCta = (label: string) => {
    trackPilotCta(label);
  };

  const ctaHref = formUrl ?? mailtoHref;
  const ctaExternal = Boolean(formUrl);
  const ctaLabel = formUrl ? "Request a pilot" : "Email us about a pilot";

  return (
    <section
      id="pilot"
      className="py-28 relative overflow-hidden w-full scroll-mt-24"
      style={{ backgroundColor: "#0f0f14" }}
    >
      <div
        className="absolute inset-0 w-full opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 30%, rgba(34,211,238,0.08), transparent 45%), radial-gradient(circle at 85% 70%, rgba(249,115,22,0.06), transparent 40%)",
        }}
      />
      <div
        className="container relative mx-auto px-4"
        style={{ maxWidth: "1200px" }}
      >
        <div className="text-center mb-14 space-y-4">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border"
            style={{
              backgroundColor: c.primaryLight,
              borderColor: c.primaryBorder,
            }}
          >
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: c.primary }}
            >
              PILOT PROGRAM
            </span>
          </div>
          <h2
            className="text-4xl lg:text-5xl font-light tracking-tight"
            style={{ color: c.foreground }}
          >
            90-day pilot for{" "}
            <span className="font-bold" style={{ color: c.primary }}>
              property operators
            </span>
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto font-light leading-relaxed"
            style={{ color: c.mutedForeground }}
          >
            Partner with us to validate AI-powered condition tracking and
            documentation at scale—using what ships today, with room to
            co-design what comes next.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {SEGMENTS.map((segment) => (
            <div
              key={segment.title}
              className="rounded-xl border p-5"
              style={{
                borderColor: c.border,
                backgroundColor: "rgba(20,20,28,0.6)",
              }}
            >
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: c.primaryLight }}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color: c.primary }}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={segment.icon}
                  />
                </svg>
              </div>
              <h3
                className="font-semibold text-sm mb-1"
                style={{ color: c.foreground }}
              >
                {segment.title}
              </h3>
              <p
                className="text-xs leading-relaxed font-light"
                style={{ color: c.mutedForeground }}
              >
                {segment.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
          <div
            className="rounded-2xl border p-6"
            style={{
              borderColor: c.border,
              backgroundColor: "rgba(20,20,28,0.5)",
            }}
          >
            <h3
              className="text-sm font-semibold uppercase tracking-wider mb-4"
              style={{ color: c.primary }}
            >
              Included today
            </h3>
            <ul className="space-y-2">
              {INCLUDED_TODAY.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm font-light"
                  style={{ color: c.foreground }}
                >
                  <span style={{ color: c.primary }} aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div
            className="rounded-2xl border p-6"
            style={{
              borderColor: c.border,
              backgroundColor: "rgba(20,20,28,0.5)",
            }}
          >
            <h3
              className="text-sm font-semibold uppercase tracking-wider mb-4"
              style={{ color: c.mutedForeground }}
            >
              Co-designed in pilot
            </h3>
            <ul className="space-y-2">
              {CO_DESIGNED.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm font-light"
                  style={{ color: c.mutedForeground }}
                >
                  <span aria-hidden>→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p
              className="text-xs mt-4 font-light"
              style={{ color: c.mutedForeground }}
            >
              Typical shape: 10–50 properties, 3–5 users, 8–12 weeks with weekly
              feedback.
            </p>
          </div>
        </div>

        <div className="text-center space-y-6">
          <a
            href={ctaHref}
            target={ctaExternal ? "_blank" : undefined}
            rel={ctaExternal ? "noopener noreferrer" : undefined}
            onClick={() => handlePilotCta("pilot_cta_section")}
            className="inline-flex items-center justify-center rounded-lg px-10 py-4 text-base font-medium shadow-xl transition-all"
            style={{ backgroundColor: c.primary, color: "#0a0a0f" }}
          >
            {ctaLabel}
          </a>
          <p className="text-sm font-light" style={{ color: c.mutedForeground }}>
            We typically respond within one business day.
          </p>
        </div>

        {showEmbed && formUrl ? (
          <div className="mt-10 max-w-2xl mx-auto rounded-xl overflow-hidden border min-h-[480px]">
            <iframe
              src={formUrl}
              title="AssetMem AI pilot request form"
              className="w-full min-h-[480px] border-0"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
