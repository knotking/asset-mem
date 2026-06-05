/**
 * Mirrors `apps/common/src/lib/agent-display.ts` for Firebase App Hosting:
 * the webapp does not depend on `@homeapp/common`. Keep both files in sync.
 */

import type { AgentStep } from "@/lib/types";
import {
  getCheckpointBranchProgress,
} from "@/lib/checkpoint-branch-progress";

export const DEFAULT_THINKING_LABEL = "Working on it…";

export const COORDINATING_LABEL = "Understanding your request…";

export const ORCHESTRATOR_AGENT_NAMES = new Set<string>(["property_agent"]);

const ORCHESTRATOR_PIPELINE_ORDER = ["property_agent"] as const;

function orchestratorPipelineIndex(name: string): number {
  const idx = ORCHESTRATOR_PIPELINE_ORDER.indexOf(
    name as (typeof ORCHESTRATOR_PIPELINE_ORDER)[number],
  );
  return idx >= 0 ? idx : ORCHESTRATOR_PIPELINE_ORDER.length;
}

const HIDDEN_TICKER_AGENTS = new Set<string>([]);

const CHECKPOINT_OPTIONAL_STEP_NAMES = new Set<string>([
  "coverage_agent",
  "diy_agent",
  "service_agent",
  "cost_agent",
]);

export const CHECKPOINT_PARALLEL_ANALYSIS_LABEL = "Analyzing your checkpoints…";

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  diagnostic_agent: "Diagnosing the issue…",
  user_docs_retrieval: "Searching your documents…",
  analyse_multimodal_data: "Reviewing your photo or video…",
  research_agent: "Researching options…",
  service_provider_agent: "Finding pros near you…",
  service_agent: "Finding pros near you…",
  product_recommendations_agent: "Finding recommended products…",
  shopping_agent: "Finding recommended products…",
  cost_estimation_agent: "Estimating repair costs…",
  cost_agent: "Estimating repair costs…",
  coverage_agent: "Checking warranty & insurance…",
  diy_agent: "Building DIY steps…",
  run_checkpoint_pipeline: "Loading your checkpoints…",
  // Legacy stream authors (pre-V2); not root tools — see property_agent/ARCHITECTURE.md
  checkpoint_analysis_agent: "Analyzing your checkpoints…",
  checkpoint_analysis_synthesis_agent: "Writing your summary…",
  checkpoint_optional_agents_parallel_runner: "Finishing your analysis…",
  checkpoint_analysis_progress: "Updating your analysis…",
  agent_stream: "Almost done…",
  agent_response: "Done",
};

export function isOrchestratorAgent(name: string | undefined | null): boolean {
  return !!name && ORCHESTRATOR_AGENT_NAMES.has(name);
}

export function isHiddenTickerAgent(name: string | undefined | null): boolean {
  return !!name && HIDDEN_TICKER_AGENTS.has(name);
}

export function prettifyAgentName(name: string | undefined | null): string {
  if (!name) return DEFAULT_THINKING_LABEL;
  if (isOrchestratorAgent(name)) return COORDINATING_LABEL;
  if (isHiddenTickerAgent(name)) return DEFAULT_THINKING_LABEL;
  return AGENT_DISPLAY_NAMES[name] ?? DEFAULT_THINKING_LABEL;
}

export function shouldUseCoordinatingLabel(
  steps: AgentStep[] | undefined | null,
  activeStep?: AgentStep | null,
): boolean {
  if (!steps?.length) return true;

  const visible = steps.filter((s) => !isHiddenTickerAgent(s.name));
  if (visible.some((s) => !isOrchestratorAgent(s.name))) return false;

  const orchestrators = visible.filter((s) => isOrchestratorAgent(s.name));
  if (orchestrators.length === 0) return true;

  if (
    orchestrators.some(
      (s) =>
        (s.status === "completed" || s.status === "failed") &&
        isOrchestratorAgent(s.name),
    )
  ) {
    return false;
  }

  const inFlightOrchestrators = orchestrators.filter(
    (s) => s.status === "executing",
  );
  if (inFlightOrchestrators.length === 0) return false;

  const leadOrchestrator = inFlightOrchestrators.reduce((earliest, step) =>
    orchestratorPipelineIndex(step.name) < orchestratorPipelineIndex(earliest.name)
      ? step
      : earliest,
  );

  if (!activeStep || !isOrchestratorAgent(activeStep.name)) {
    return leadOrchestrator.name === ORCHESTRATOR_PIPELINE_ORDER[0];
  }

  return activeStep.name === leadOrchestrator.name;
}

export function getAgentStepDisplayLabel(
  step: AgentStep,
  steps?: AgentStep[] | undefined | null,
): string {
  if (isOrchestratorAgent(step.name)) {
    return shouldUseCoordinatingLabel(steps, step)
      ? COORDINATING_LABEL
      : DEFAULT_THINKING_LABEL;
  }
  if (isHiddenTickerAgent(step.name)) return DEFAULT_THINKING_LABEL;
  if (step.displayName && !isOrchestratorAgent(step.name)) {
    return step.displayName;
  }
  return prettifyAgentName(step.name);
}

function isVisibleTickerStep(step: AgentStep): boolean {
  if (isHiddenTickerAgent(step.name)) return false;
  return step.status === "executing";
}

function executingCheckpointOptionalSteps(
  steps: AgentStep[] | undefined | null,
): AgentStep[] {
  if (!steps?.length) return [];
  return steps.filter(
    (s) =>
      s.status === "executing" && CHECKPOINT_OPTIONAL_STEP_NAMES.has(s.name),
  );
}

export function pickActiveAgentStep(
  steps: AgentStep[] | undefined | null,
): AgentStep | null {
  if (!steps || steps.length === 0) return null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.status === "executing" && isVisibleTickerStep(step) && !isOrchestratorAgent(step.name)) {
      return step;
    }
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (isVisibleTickerStep(step)) return step;
  }
  return null;
}

export type ThinkingStatus = {
  header: string;
  preview: string | null;
};

export type ThinkingStatusOptions = {
  messageContentJson?: Record<string, unknown> | null;
  accordionAnalysis?: Record<string, unknown> | null;
};

export function getThinkingStatusFromSteps(
  steps: AgentStep[] | undefined | null,
  options?: ThinkingStatusOptions,
): ThinkingStatus {
  const analysis: unknown =
    options?.accordionAnalysis ?? options?.messageContentJson ?? null;
  const branchProgress = getCheckpointBranchProgress(analysis);
  if (branchProgress?.isInProgress) {
    return {
      header: branchProgress.header,
      preview: branchProgress.detail,
    };
  }

  const executingOptional = executingCheckpointOptionalSteps(steps);
  if (executingOptional.length >= 2) {
    return { header: CHECKPOINT_PARALLEL_ANALYSIS_LABEL, preview: null };
  }

  const active = pickActiveAgentStep(steps);
  if (!active) {
    return {
      header: shouldUseCoordinatingLabel(steps)
        ? COORDINATING_LABEL
        : DEFAULT_THINKING_LABEL,
      preview: null,
    };
  }
  return {
    header: getAgentStepDisplayLabel(active, steps),
    preview: active.preview?.trim() || null,
  };
}
