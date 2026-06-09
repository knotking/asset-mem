import type { AgentStep } from "../types";
import {
  getCheckpointBranchProgress,
  isSynthesisWorkInFlight,
  resolveStructuredAnalysis,
  SYNTHESIS_WRITING_LABEL,
} from "./checkpoint-branch-progress";

/** Shown when no specialist step is active yet. */
export const DEFAULT_THINKING_LABEL = "Working on it…";

/** Single label for the root property_agent orchestrator. */
export const COORDINATING_LABEL = "Understanding your request…";

export const ORCHESTRATOR_AGENT_NAMES = new Set<string>(["property_agent"]);

const ORCHESTRATOR_PIPELINE_ORDER = ["property_agent"] as const;

function orchestratorPipelineIndex(name: string): number {
  const idx = ORCHESTRATOR_PIPELINE_ORDER.indexOf(
    name as (typeof ORCHESTRATOR_PIPELINE_ORDER)[number],
  );
  return idx >= 0 ? idx : ORCHESTRATOR_PIPELINE_ORDER.length;
}

/** Internal tools that should never appear in the thinking ticker. */
const HIDDEN_TICKER_AGENTS = new Set<string>([]);

/** Rollup / progress rows superseded by optional specialists or ``analysisStatus``. */
const CHECKPOINT_ROLLUP_TICKER_AGENTS = new Set<string>([
  "run_checkpoint_pipeline",
  "checkpoint_analysis_agent",
  "checkpoint_optional_agents_parallel_runner",
  "checkpoint_analysis_progress",
]);

/** Checkpoint optional specialists (parallel branches). */
const CHECKPOINT_OPTIONAL_STEP_NAMES = new Set<string>([
  "coverage_agent",
  "diy_agent",
  "service_agent",
  "cost_agent",
]);

/** Shown when multiple optional branches are in flight (avoids "cost last" bias). */
export const CHECKPOINT_PARALLEL_ANALYSIS_LABEL = "Analyzing your checkpoints…";

/**
 * Human-readable labels for known ADK agent / tool names.
 *
 * Mirrors `_DISPLAY_NAME_MAP` in `gcp/proxy/api/services/vertex_service.py`.
 */
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
  report_retrieval: "Reading your saved report…",
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

/** Whether a step should appear in the expanded step list (webapp AgentStatus card). */
export function isStepVisibleInStatusList(step: AgentStep): boolean {
  if (isHiddenTickerAgent(step.name)) return false;
  if (isOrchestratorAgent(step.name)) return false;
  return true;
}

/**
 * Resolve a friendly label for an ADK agent/tool name.
 * Unknown names fall back to {@link DEFAULT_THINKING_LABEL} (never raw snake_case).
 */
export function prettifyAgentName(name: string | undefined | null): string {
  if (!name) return DEFAULT_THINKING_LABEL;
  if (isOrchestratorAgent(name)) return COORDINATING_LABEL;
  if (isHiddenTickerAgent(name)) return DEFAULT_THINKING_LABEL;
  return AGENT_DISPLAY_NAMES[name] ?? DEFAULT_THINKING_LABEL;
}

/**
 * Show {@link COORDINATING_LABEL} only while the first router (property_agent) is
 * in flight and no specialist work has started. Later hops use {@link DEFAULT_THINKING_LABEL}.
 */
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

/** User-facing label for a single agent step (ignores stale orchestrator displayNames). */
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

function isCheckpointRollupTickerAgent(name: string | undefined | null): boolean {
  return !!name && CHECKPOINT_ROLLUP_TICKER_AGENTS.has(name);
}

function isVisibleTickerStep(step: AgentStep): boolean {
  if (isHiddenTickerAgent(step.name)) return false;
  return step.status === "executing";
}

function resolveThinkingStatusAnalysis(
  options?: ThinkingStatusOptions,
): unknown {
  if (options?.accordionAnalysis) {
    return options.accordionAnalysis;
  }
  if (options?.messageContentJson) {
    return (
      resolveStructuredAnalysis(options.messageContentJson) ??
      options.messageContentJson
    );
  }
  return null;
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

/**
 * Pick the most relevant in-flight step for the thinking ticker.
 * Skips orchestrator hops when a specialist is also in flight.
 * Prefers the earliest executing specialist (not the last in the list).
 */
export function pickActiveAgentStep(
  steps: AgentStep[] | undefined | null,
): AgentStep | null {
  if (!steps || steps.length === 0) return null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (
      step.status === "executing" &&
      isVisibleTickerStep(step) &&
      !isOrchestratorAgent(step.name) &&
      !isCheckpointRollupTickerAgent(step.name)
    ) {
      return step;
    }
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (
      isVisibleTickerStep(step) &&
      !isOrchestratorAgent(step.name) &&
      !isCheckpointRollupTickerAgent(step.name)
    ) {
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
  /** Structured payload from message `contentJson`. */
  messageContentJson?: Record<string, unknown> | null;
  /** Branch-progress snapshot mapped for accordion / ticker rendering. */
  accordionAnalysis?: Record<string, unknown> | null;
  /** Local stream / Firestore in-flight turn for synthesis gap UX. */
  isTurnInFlight?: boolean;
};

/** Header + preview for the early thinking strip from agent steps and/or message JSON. */
export function getThinkingStatusFromSteps(
  steps: AgentStep[] | undefined | null,
  options?: ThinkingStatusOptions,
): ThinkingStatus {
  const analysis = resolveThinkingStatusAnalysis(options);
  const branchProgress = getCheckpointBranchProgress(analysis);
  if (branchProgress?.isInProgress) {
    return {
      header: branchProgress.header,
      preview: branchProgress.detail,
    };
  }

  if (
    isSynthesisWorkInFlight(analysis, steps, {
      isTurnInFlight: options?.isTurnInFlight,
    })
  ) {
    return { header: SYNTHESIS_WRITING_LABEL, preview: null };
  }

  const executingOptional = executingCheckpointOptionalSteps(steps);
  if (executingOptional.length >= 2) {
    return { header: CHECKPOINT_PARALLEL_ANALYSIS_LABEL, preview: null };
  }
  if (executingOptional.length === 1) {
    const step = executingOptional[0];
    return {
      header: getAgentStepDisplayLabel(step, steps),
      preview: step.preview?.trim() || null,
    };
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
