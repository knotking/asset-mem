/**
 * Per-section avatar narration for the marketing landing page (~25s total).
 * Keep in sync with apps/webapp/scripts/recording/landing-narration.ts
 */

export type LandingSectionId =
  | "hero"
  | "how-it-works"
  | "ai-pipeline"
  | "use-cases"
  | "enterprise"
  | "pricing"
  | "footer";

export type LandingNarrationSection = {
  id: LandingSectionId;
  label: string;
  narration: string;
};

/**
 * Main spoken script (~25s) — full sentences for avatar delivery.
 * Sections 1–5 align with on-screen scroll; pricing/footer are brief closers.
 */
export const LANDING_SPOKEN_NARRATIVE = [
  "Welcome to AssetMem AI, timeline intelligence for property care.",
  "Capture, see what changed, know what to do, and prove it—discover AI-assisted workflow where photos and questions feed a single intelligence layer that spots changes early and tells you what to do next. See visual checkpoint timelines, shareable reports, and questions grounded in your property's evidence.",
  "At the AI intelligence layer, field photos, policies, and team questions route through coordinated analysis on coverage, repairs, vendors, costs, and change detection—turning condition signals into clear next steps.",
  "Explore use cases from routine walkthroughs to contractor handoffs and renovation tracking.",
  "Whether you manage one home or a whole portfolio, AssetMem helps you capture, understand, act, and prove.",
] as const;

/** One natural sentence per on-screen section. */
export const LANDING_NARRATION_SECTIONS: readonly LandingNarrationSection[] = [
  {
    id: "hero",
    label: "Hero",
    narration: LANDING_SPOKEN_NARRATIVE[0],
  },
  {
    id: "how-it-works",
    label: "How It Works",
    narration: LANDING_SPOKEN_NARRATIVE[1],
  },
  {
    id: "ai-pipeline",
    label: "AI Intelligence",
    narration: LANDING_SPOKEN_NARRATIVE[2],
  },
  {
    id: "use-cases",
    label: "Use Cases",
    narration: LANDING_SPOKEN_NARRATIVE[3],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    narration: LANDING_SPOKEN_NARRATIVE[4],
  },
  {
    id: "pricing",
    label: "Pricing",
    narration:
      "There is a plan for every team, from everyday home care to portfolio operations.",
  },
  {
    id: "footer",
    label: "Footer",
    narration: "Visit asset-mem.com to get started.",
  },
] as const;

export type NarrationSectionTiming = LandingNarrationSection & {
  startOffsetMs: number;
  endOffsetMs: number;
};

/** Full scene narration (~25s avatar read). */
export function getFullLandingNarration(): string {
  return LANDING_SPOKEN_NARRATIVE.join(" ");
}

/** Hero-only narration for the static landing scene. */
export function getLandingHeroNarration(): string {
  return LANDING_SPOKEN_NARRATIVE[0];
}

const MAESTRO_SECTION_WEIGHTS: Record<LandingSectionId, number> = {
  hero: 2,
  "how-it-works": 2,
  "ai-pipeline": 2,
  "use-cases": 6,
  enterprise: 2,
  pricing: 2,
  footer: 2,
};

/**
 * Approximate per-section timings for mapp Maestro flows when wall-clock segments
 * are not captured (weights mirror landing-page.yaml hold/swipe counts).
 */
export function buildEstimatedLandingSectionTimings(
  totalDurationMs: number,
): NarrationSectionTiming[] {
  const totalWeight = LANDING_NARRATION_SECTIONS.reduce(
    (sum, s) => sum + MAESTRO_SECTION_WEIGHTS[s.id],
    0,
  );
  let offsetMs = 0;
  return LANDING_NARRATION_SECTIONS.map((section) => {
    const weight = MAESTRO_SECTION_WEIGHTS[section.id];
    const durationMs = Math.round((totalDurationMs * weight) / totalWeight);
    const timing: NarrationSectionTiming = {
      ...section,
      startOffsetMs: offsetMs,
      endOffsetMs: offsetMs + durationMs,
    };
    offsetMs += durationMs;
    return timing;
  });
}
