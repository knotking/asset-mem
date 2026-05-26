/**
 * Mirrors `apps/common/src/lib/agent-display.ts` for Firebase App Hosting:
 * the webapp does not depend on `@homeapp/common`. Keep both files in sync.
 */

import type { AgentStep } from "@/lib/types";
import {
  getCheckpointBranchProgress,
  parseStructuredResponseFromContent,
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

const HIDDEN_TICKER_AGENTS = new Set<string>(["transfer_to_agent"]);

const CHECKPOINT_OPTIONAL_STEP_NAMES = new Set<string>([
  "coverage_agent",
  "diy_agent",
  "service_agent",
  "cost_agent",
]);

export const CHECKPOINT_PARALLEL_ANALYSIS_LABEL = "Analyzing your checkpoints…";

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  diagnostic_agent: "Diagnosing the issue…",
  ask_knowledge_base_agent: "Searching repair guides…",
  ask_knowledge_base_retrieval: "Searching repair guides…",
  ask_user_docs_agent: "Searching your documents…",
  ask_user_docs_retrieval: "Searching your documents…",
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
  checkpoint_agent: "Loading your checkpoints…",
  checkpoint_analysis_agent: "Analyzing your checkpoints…",
  checkpoint_progress_agent: "Preparing your analysis…",
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

export function isStepVisibleInStatusList(step: AgentStep): boolean {
  if (step.status === "transferredto") return false;
  if (isHiddenTickerAgent(step.name)) return false;
  if (isOrchestratorAgent(step.name)) return false;
  return true;
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
    (s) => s.status === "executing" || s.status === "transferredto",
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
  return step.status === "executing" || step.status === "transferredto";
}

function analysisFromMessageContent(
  content: string | null | undefined,
): unknown {
  if (!content?.trim()) return null;
  const parsed = parseStructuredResponseFromContent(content);
  if (!parsed) return null;
  return parsed.analysis ?? parsed;
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
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.status === "transferredto" && isVisibleTickerStep(step) && !isOrchestratorAgent(step.name)) {
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
  messageContent?: string | null;
};

export function getThinkingStatusFromSteps(
  steps: AgentStep[] | undefined | null,
  options?: ThinkingStatusOptions,
): ThinkingStatus {
  const analysis = analysisFromMessageContent(options?.messageContent);
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
