/**
 * Mirrors `apps/common/src/lib/agent-display.ts` for Firebase App Hosting:
 * the webapp does not depend on `@homeapp/common`. Keep both files in sync.
 */

import type { AgentStep } from "@/lib/types";

/**
 * Orchestrator agents that route work between specialists. We pick from a
 * small pool of synonyms so repeated hand-offs don't all read as the same
 * "Coordinating" row. The server randomizes the pick at write time; this
 * fallback uses a deterministic hash by name so a given agent always renders
 * with the same label across React re-renders.
 */
const COORDINATING_AGENTS = new Set<string>([
  "property_agent",
  "doculink_agent",
]);

const COORDINATING_VARIANTS = [
  "Coordinating",
  "Orchestrating",
  "Planning the work",
  "Mapping the work",
  "Strategizing",
  "Sizing things up",
];

function hashIndex(input: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

/**
 * Human-readable labels for known ADK agent / tool names.
 *
 * Mirrors the server-side _DISPLAY_NAME_MAP in
 * gcp/proxy/api/services/vertex_service.py so that older messages (which
 * have no `displayName` baked in) still render with a friendly label.
 */
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  diagnostic_agent: "Diagnosing",
  ask_knowledge_base_agent: "Scanning HomeGeekAI catalog",
  ask_knowledge_base_retrieval: "Accessing HomeGeekAI catalog",
  ask_user_docs_agent: "Scanning your documents",
  ask_user_docs_retrieval: "Accessing your documents",
  analyse_multimodal_data: "Analyzing media",
  research_agent: "Researching solutions",
  service_provider_agent: "Finding local pros",
  service_agent: "Finding local pros",
  product_recommendations_agent: "Finding recommended products",
  shopping_agent: "Finding recommended products",
  cost_estimation_agent: "Estimating costs",
  cost_agent: "Estimating costs",
  coverage_agent: "Checking warranty & insurance",
  diy_agent: "Compiling DIY steps",
  checkpoint_agent: "Reviewing checkpoints",
  checkpoint_analysis_agent: "Analyzing checkpoints",
  checkpoint_analysis_synthesis_agent: "Putting it all together",
  checkpoint_optional_agents_parallel_runner: "Running analysis in parallel",
  transfer_to_agent: "Handing off",
  agent_stream: "Streaming response",
  agent_response: "Done",
};

/** Convert a snake_case name like "service_agent" to "Service Agent". */
function titleCase(name: string): string {
  if (!name) return "";
  return name
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Resolve a friendly label for an ADK agent/tool name. Falls back to a
 * Title Case version of the raw name so we never show snake_case to users.
 *
 * For orchestrator agents we pick from COORDINATING_VARIANTS via a
 * deterministic hash so each agent name renders with a stable but distinct
 * label without colliding on "Coordinating".
 */
export function prettifyAgentName(name: string | undefined | null): string {
  if (!name) return "";
  if (COORDINATING_AGENTS.has(name)) {
    return COORDINATING_VARIANTS[hashIndex(name, COORDINATING_VARIANTS.length)];
  }
  return AGENT_DISPLAY_NAMES[name] ?? titleCase(name);
}

/** Pick the most relevant in-flight step to display in a status ticker. */
export function pickActiveAgentStep(
  steps: AgentStep[] | undefined | null,
): AgentStep | null {
  if (!steps || steps.length === 0) return null;
  // Walk backwards so we surface the most recent activity.
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].status === "executing") return steps[i];
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].status === "transferredto") return steps[i];
  }
  return null;
}

/** Format `1.4s` style elapsed-time labels from optional epoch ms timestamps. */
export function formatAgentStepDuration(step: AgentStep): string | null {
  if (!step.startedAt) return null;
  const end = step.completedAt ?? Date.now();
  const ms = Math.max(0, end - step.startedAt);
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds - minutes * 60);
  return `${minutes}m ${remainder}s`;
}
