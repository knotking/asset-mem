/**
 * Mirrors `apps/common/src/lib/feature-discovery.ts` for Firebase App Hosting.
 * Keep both files in sync.
 */

import type { PrimaryAgent, Property, UserPreferences } from "@/lib/types";
import {
  getOnboardingStepStates,
  resolveOnboardingPropertyId,
} from "@/lib/home-onboarding";

export type FeatureTipId =
  | "checkpoints_empty"
  | "checkpoints_compare"
  | "docs_linked_to_chat"
  | "chat_optional_agents"
  | "chat_multi_checkpoint"
  | "quota_limit"
  | "first_structured_response";

export type DiscoveryStepId =
  | "compare_checkpoints"
  | "use_optional_agent"
  | "multi_checkpoint_chat"
  | "review_ai_usage";

export type HelpArticleId =
  | "checkpoints"
  | "docs_vs_checkpoint"
  | "optional_agents"
  | "ai_usage"
  | "compare_checkpoints"
  | "chat_sessions";

export type HelpArticle = {
  id: HelpArticleId;
  title: string;
  summary: string;
  bullets: string[];
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "checkpoints",
    title: "Visual checkpoints & timeline",
    summary: "Photo-based condition history for each area of your property.",
    bullets: [
      "Create checkpoints from photos or videos on the Timeline tab.",
      "AI scores condition and flags issues (minor → critical).",
      "Attach checkpoints to chat for analysis, DIY steps, and cost estimates.",
    ],
  },
  {
    id: "docs_vs_checkpoint",
    title: "Docs vs Checkpoint chat",
    summary: "Choose how the AI should answer for this property.",
    bullets: [
      "Docs — answers from uploaded warranties, manuals, and receipts (RAG).",
      "Checkpoint — uses timeline photos plus optional coverage, DIY, service, and cost agents.",
      "Upload documents on the property Details tab; they power Docs mode automatically.",
    ],
  },
  {
    id: "optional_agents",
    title: "Optional agents (Checkpoint mode)",
    summary: "Add specialized analysis on top of your checkpoint context.",
    bullets: [
      "Coverage — warranty and insurance context.",
      "DIY — step-by-step fixes with videos and products.",
      "Service — local provider recommendations.",
      "Cost — repair cost estimates (DIY vs pro).",
    ],
  },
  {
    id: "compare_checkpoints",
    title: "Compare two checkpoints",
    summary: "See visual and semantic changes between two points in time.",
    bullets: [
      "On Timeline, tap Compare (web) or long-press to select two checkpoints (mobile).",
      "Review similarity, heatmaps, and AI-described changes.",
      "Use comparisons to prioritize repairs before they worsen.",
    ],
  },
  {
    id: "chat_sessions",
    title: "Chat sessions",
    summary: "Each conversation keeps its own history for a property.",
    bullets: [
      "Start a new session for a new topic; older sessions stay in the sidebar.",
      "Sessions remember messages and structured results (accordions, providers, costs).",
      "Switch Checkpoint/Docs mode and agents in chat settings before you send.",
    ],
  },
  {
    id: "ai_usage",
    title: "AI usage & limits",
    summary: "Monthly quotas for tokens, document extractions, and checkpoint analyses.",
    bullets: [
      "Token usage counts agent chat and worker AI (analysis, embeddings).",
      "Document extractions run when you upload files; checkpoint analyses run per analysis job.",
      "Review usage and plan limits under Settings → AI usage, Plan & billing, and FAQ.",
    ],
  },
];

/** Static new-chat empty state (web + mapp). Keep in sync with apps/common. */
export const CHAT_SESSION_EMPTY_INTRO = {
  title: "Ask about your timeline",
  subtitle:
    "Select checkpoints in chat settings, enable optional agents (coverage, DIY, service, cost), then send your question.",
} as const;

export const CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS = [
  "Give me a complete analysis of my issues",
  "Estimate repair costs for the issues you see",
] as const;

export const CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS_BY_AGENT: Record<
  PrimaryAgent,
  readonly string[]
> = {
  checkpoint: CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS,
  analysis: CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS,
  docs: [
    "What warranties and coverage do my uploaded documents mention?",
    "Summarize the key details from my property documents",
  ],
  report: ["Summarize this report", "What were the main findings?"],
};

export type SuggestedPromptContext = {
  primaryAgent: PrimaryAgent;
  checkpointCount?: number;
  documentCount?: number;
};

export function getSuggestedPrompts(ctx?: SuggestedPromptContext): string[] {
  const agent = ctx?.primaryAgent ?? "checkpoint";
  return [...CHAT_SESSION_EMPTY_SUGGESTED_PROMPTS_BY_AGENT[agent]];
}

export type ChatIntroContext = {
  hasOpenedChatFromOnboarding: boolean;
  checkpointCount: number;
  documentCount: number;
};

export function getDefaultChatIntroCopy(): { title: string; subtitle: string } {
  return { ...CHAT_SESSION_EMPTY_INTRO };
}

export function getChatIntroCopy(_ctx?: ChatIntroContext): {
  title: string;
  subtitle: string;
} {
  return { ...CHAT_SESSION_EMPTY_INTRO };
}

/** Use the higher of live lists vs property card aggregates (contextual tips only). */
export function resolveChatDiscoveryCounts(
  property: Property | undefined,
  loadedCheckpointCount: number,
  loadedDocumentCount: number
): { checkpointCount: number; documentCount: number } {
  return {
    checkpointCount: Math.max(loadedCheckpointCount, propertyCheckpointCount(property)),
    documentCount: Math.max(loadedDocumentCount, propertyDocumentCount(property)),
  };
}

export function isFeatureTipDismissed(
  preferences: UserPreferences | null | undefined,
  tipId: FeatureTipId
): boolean {
  return !!preferences?.featureTipsDismissed?.[tipId];
}

export function shouldShowFeatureTip(
  preferences: UserPreferences | null | undefined,
  tipId: FeatureTipId
): boolean {
  return !isFeatureTipDismissed(preferences, tipId);
}

export function hasDismissedFeatureTips(
  preferences: UserPreferences | null | undefined
): boolean {
  const dismissed = preferences?.featureTipsDismissed;
  if (!dismissed) return false;
  return Object.values(dismissed).some((value) => value === true);
}

export type DiscoveryStepState = {
  id: DiscoveryStepId;
  done: boolean;
};

export function getDiscoveryStepStates(
  preferences: UserPreferences | null | undefined
): {
  steps: DiscoveryStepState[];
  completedCount: number;
  totalSteps: number;
  allDone: boolean;
} {
  const totalSteps = 4;
  const steps: DiscoveryStepState[] = [
    { id: "compare_checkpoints", done: !!preferences?.discoveryCompareDone },
    { id: "use_optional_agent", done: !!preferences?.discoveryOptionalAgentUsed },
    {
      id: "multi_checkpoint_chat",
      done: !!preferences?.discoveryMultiCheckpointChat,
    },
    { id: "review_ai_usage", done: !!preferences?.discoveryAiUsageViewed },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  return {
    steps,
    completedCount,
    totalSteps,
    allDone: steps.every((s) => s.done),
  };
}

/** Show the post-onboarding discovery checklist on the home dashboard. */
export function shouldShowDiscoveryChecklist(
  properties: Property[],
  preferences: UserPreferences | null | undefined
): boolean {
  if (properties.length === 0) return false;
  if (preferences?.discoveryChecklistDismissed) return false;

  const onboarding = getOnboardingStepStates(properties, preferences);
  const onboardingFinished =
    onboarding.allDone || !!preferences?.onboardingChecklistDismissed;
  return onboardingFinished;
}

export function propertyDocumentCount(property: Property | undefined): number {
  if (!property) return 0;
  const withCounts = property as Property & { docs?: number };
  return withCounts.docs ?? property.documents?.length ?? 0;
}

export function propertyCheckpointCount(property: Property | undefined): number {
  if (!property) return 0;
  const withCounts = property as Property & { checks?: number };
  return withCounts.checks ?? property.checksCount ?? 0;
}

export function resolveDiscoveryProperty(
  properties: Property[],
  preferences: UserPreferences | null | undefined
): Property | undefined {
  const id = resolveOnboardingPropertyId(properties, preferences);
  return id ? properties.find((p) => p.id === id) : properties[0];
}

export function messageHasStructuredAssistantContent(
  message: { role?: string; contentJson?: Record<string, unknown> | null } | null | undefined
): boolean {
  if (!message || message.role !== "assistant") return false;
  const json = message.contentJson;
  if (!json || typeof json !== "object") return false;
  return Object.keys(json).length > 0;
}

/** Two-line labels for property card stat columns (consistent height). */
export const PROPERTY_STAT_LABELS = {
  docs: ["Uploaded", "files"] as const,
  services: ["Saved", "providers"] as const,
  checkpoints: ["Timeline", "entries"] as const,
} as const;

export type PropertyStatKind = keyof typeof PROPERTY_STAT_LABELS;
