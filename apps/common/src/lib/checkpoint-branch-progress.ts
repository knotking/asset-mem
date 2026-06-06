import {
  CHECKPOINT_OPTIONAL_AGENTS,
  type AgentStep,
  type CheckpointOptionalAgent,
} from "../types";
import { serviceSearchFailed } from "./service-search-status";

export type CheckpointBranchStatus = "pending" | "running" | "completed";

export type CheckpointBranchProgressItem = {
  key: CheckpointOptionalAgent;
  label: string;
  status: CheckpointBranchStatus;
};

export type CheckpointBranchProgress = {
  items: CheckpointBranchProgressItem[];
  isInProgress: boolean;
  completedCount: number;
  totalCount: number;
  header: string;
  detail: string | null;
};

export type CheckpointBranchAccordionBadge = {
  kind: "pending" | "running" | "completed";
  label: string;
};

/** ``analysis.analysisStatus`` key for executive-summary synthesis (Orchestrator V2). */
export const CHECKPOINT_SYNTHESIS_ANALYSIS_STATUS_KEY = "synthesis";

export const SYNTHESIS_WRITING_LABEL = "Writing your summary…";

const SYNTHESIS_AGENT_STEP_NAME = "checkpoint_analysis_synthesis_agent";

const CHECKPOINT_OPTIONAL_AGENT_STEP_NAMES = new Set<string>([
  "coverage_agent",
  "diy_agent",
  "service_agent",
  "cost_agent",
]);

const BRANCH_LABELS: Record<CheckpointOptionalAgent, string> = {
  coverage: "Coverage",
  diy: "DIY",
  service: "Service",
  cost: "Cost",
};

const BRANCH_SECTION_KEYS: Record<CheckpointOptionalAgent, string> = {
  coverage: "coverageResult",
  diy: "diyResults",
  service: "serviceResults",
  cost: "costEstimationResults",
};

/** True when analysis JSON already includes rendered content for this branch. */
function branchSectionReady(
  analysis: Record<string, unknown>,
  branch: CheckpointOptionalAgent
): boolean {
  const section = analysis[BRANCH_SECTION_KEYS[branch]];
  if (!section || typeof section !== "object") {
    return false;
  }
  if (branch === "coverage") {
    const c = section as { warrantyInfo?: unknown; insuranceInfo?: unknown };
    const warranty =
      typeof c.warrantyInfo === "string" ? c.warrantyInfo.trim() : "";
    const insurance =
      typeof c.insuranceInfo === "string" ? c.insuranceInfo.trim() : "";
    return Boolean(warranty || insurance);
  }
  if (branch === "service") {
    const s = section as Record<string, unknown>;
    if (serviceSearchFailed(s)) return true;
    const localPros = s.localPros as Record<string, unknown> | undefined;
    const providerArrays = [
      localPros?.yelpAPIResults,
      localPros?.serpAPIResults,
      localPros?.googleSearchResults,
    ];
    return providerArrays.some((arr) => Array.isArray(arr) && arr.length > 0);
  }
  return Object.keys(section as object).length > 0;
}

function normalizeStatus(raw: unknown): CheckpointBranchStatus | null {
  if (raw === "pending" || raw === "running" || raw === "completed") {
    return raw;
  }
  return null;
}

/** Join branch labels for subtitles, e.g. "Service & coverage". */
export function formatCheckpointBranchList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function buildProgressDetail(items: CheckpointBranchProgressItem[]): string | null {
  const completed = items
    .filter((i) => i.status === "completed")
    .map((i) => i.label);
  const running = items.filter((i) => i.status === "running").map((i) => i.label);
  const pending = items.filter((i) => i.status === "pending").map((i) => i.label);

  if (running.length > 0) {
    const donePrefix = completed.length
      ? `${formatCheckpointBranchList(completed)} done, `
      : "";
    return `${donePrefix}${formatCheckpointBranchList(running)} in progress`;
  }
  if (pending.length > 0 && completed.length > 0) {
    return `${formatCheckpointBranchList(completed)} done, ${formatCheckpointBranchList(pending)} pending`;
  }
  if (pending.length > 0) {
    return `${formatCheckpointBranchList(pending)} pending`;
  }
  return null;
}

/**
 * Read optional-agent progress from chat ``analysis.analysisStatus``.
 * Returns null when absent or all branches are completed.
 */
export function getCheckpointBranchProgress(
  analysis: unknown
): CheckpointBranchProgress | null {
  if (!analysis || typeof analysis !== "object") {
    return null;
  }
  const statusMap = (analysis as { analysisStatus?: unknown }).analysisStatus;
  if (!statusMap || typeof statusMap !== "object") {
    return null;
  }

  const analysisRecord = analysis as Record<string, unknown>;
  const items: CheckpointBranchProgressItem[] = [];
  for (const key of CHECKPOINT_OPTIONAL_AGENTS) {
    let status = normalizeStatus((statusMap as Record<string, unknown>)[key]);
    if (
      status &&
      status !== "completed" &&
      branchSectionReady(analysisRecord, key)
    ) {
      status = "completed";
    }
    if (status) {
      items.push({ key, label: BRANCH_LABELS[key], status });
    }
  }
  if (items.length === 0) {
    return null;
  }

  const completedCount = items.filter((i) => i.status === "completed").length;
  const totalCount = items.length;
  const isInProgress = items.some(
    (i) => i.status === "pending" || i.status === "running"
  );
  if (!isInProgress) {
    return null;
  }

  const header =
    completedCount > 0
      ? `Analyzing checkpoints… ${completedCount} of ${totalCount} complete`
      : "Analyzing checkpoints…";

  return {
    items,
    isInProgress,
    completedCount,
    totalCount,
    header,
    detail: buildProgressDetail(items),
  };
}

export function getCheckpointBranchProgressFromMessage(
  message:
    | {
        role: string;
        contentJson?: Record<string, unknown> | null;
      }
    | null
    | undefined
): CheckpointBranchProgress | null {
  if (!message || message.role !== "assistant") return null;
  if (!message.contentJson || typeof message.contentJson !== "object") return null;
  const root = message.contentJson as Record<string, unknown>;
  return getCheckpointBranchProgress(root.analysis ?? root);
}

/** Branch progress from Firestore-mapped accordion analysis (v2 hot path). */
export function getCheckpointBranchProgressFromAccordionAnalysis(
  accordionAnalysis: Record<string, unknown> | null | undefined
): CheckpointBranchProgress | null {
  if (!accordionAnalysis) return null;
  return getCheckpointBranchProgress(accordionAnalysis);
}

/** Latest assistant message with optional-agent analysis still in flight. */
/** Tailwind utility string (webapp); mapp uses native shimmer instead. */
export const DISPLAY_TITLE_GRADIENT_CLASS = "display-title-gradient-text";

export function getSynthesisAnalysisStatus(
  analysis: unknown
): CheckpointBranchStatus | null {
  if (!analysis || typeof analysis !== "object") {
    return null;
  }
  const statusMap = (analysis as { analysisStatus?: unknown }).analysisStatus;
  if (!statusMap || typeof statusMap !== "object") {
    return null;
  }
  return normalizeStatus(
    (statusMap as Record<string, unknown>)[CHECKPOINT_SYNTHESIS_ANALYSIS_STATUS_KEY]
  );
}

export function isSynthesisAnalysisInProgress(analysis: unknown): boolean {
  const status = getSynthesisAnalysisStatus(analysis);
  return status === "pending" || status === "running";
}

/** ``analysis`` from message ``contentJson`` or ``contentJson.analysis``. */
export function resolveStructuredAnalysis(
  structured: unknown
): Record<string, unknown> | null {
  if (!structured || typeof structured !== "object") {
    return null;
  }
  const root = structured as Record<string, unknown>;
  const inner = root.analysis;
  if (inner && typeof inner === "object") {
    return inner as Record<string, unknown>;
  }
  return root;
}

export function isSynthesisAgentStepExecuting(
  steps?: ReadonlyArray<Pick<AgentStep, "name" | "status">> | null
): boolean {
  return !!steps?.some(
    (step) =>
      step.name === SYNTHESIS_AGENT_STEP_NAME && step.status === "executing"
  );
}

/** Placeholder Summary accordion only while executive-summary synthesis is in flight. */
export function shouldShowSummaryAccordionPlaceholder(
  analysis: unknown,
  steps?: ReadonlyArray<Pick<AgentStep, "name" | "status">> | null
): boolean {
  return (
    isSynthesisAnalysisInProgress(analysis) ||
    isSynthesisAgentStepExecuting(steps)
  );
}

/**
 * Post-content status strip: optional branches or synthesis still running.
 * Ignores orchestrator / checkpoint-load steps so checkpoint-only turns do not duplicate status.
 */
export function hasPostContentPipelineWork(
  analysis: unknown,
  steps?: ReadonlyArray<Pick<AgentStep, "name" | "status">> | null
): boolean {
  if (getCheckpointBranchProgress(analysis)?.isInProgress) {
    return true;
  }
  if (shouldShowSummaryAccordionPlaceholder(analysis, steps)) {
    return true;
  }
  return !!steps?.some(
    (step) =>
      step.status === "executing" &&
      CHECKPOINT_OPTIONAL_AGENT_STEP_NAMES.has(step.name)
  );
}

export function getSynthesisTurnProgress(
  analysis: unknown
): CheckpointBranchProgress | null {
  if (!isSynthesisAnalysisInProgress(analysis)) {
    return null;
  }
  return {
    items: [],
    isInProgress: true,
    completedCount: 0,
    totalCount: 0,
    header: SYNTHESIS_WRITING_LABEL,
    detail: null,
  };
}

export function hasCheckpointAnalysisStatusInProgress(
  analysis: unknown
): boolean {
  if (!analysis || typeof analysis !== "object") {
    return false;
  }
  const statusMap = (analysis as { analysisStatus?: unknown }).analysisStatus;
  if (!statusMap || typeof statusMap !== "object") {
    return false;
  }
  if (isSynthesisAnalysisInProgress(analysis)) {
    return true;
  }
  for (const key of CHECKPOINT_OPTIONAL_AGENTS) {
    const st = normalizeStatus((statusMap as Record<string, unknown>)[key]);
    if (st === "pending" || st === "running") {
      return true;
    }
  }
  return false;
}

export function hasCheckpointDisplayTitleInProgress(structured: unknown): boolean {
  if (!structured || typeof structured !== "object") {
    return false;
  }
  const root = structured as Record<string, unknown>;
  if (hasCheckpointAnalysisStatusInProgress(root)) {
    return true;
  }
  const inner = root.analysis;
  if (inner && typeof inner === "object") {
    return hasCheckpointAnalysisStatusInProgress(inner);
  }
  return false;
}

export type DisplayTitleGradientInput = {
  structured?: unknown;
  steps?: ReadonlyArray<Pick<AgentStep, "name" | "status">> | null;
  /** Local SSE or Firestore-observed in-flight turn (includes post-synthesis stream tail). */
  isTurnInFlight?: boolean;
};

/** Shimmer the structured title card while checkpoint pipeline work is still running. */
export function shouldShowDisplayTitleGradient(
  input: DisplayTitleGradientInput
): boolean {
  if (input.isTurnInFlight) {
    return true;
  }
  if (hasCheckpointDisplayTitleInProgress(input.structured)) {
    return true;
  }
  const analysis = resolveStructuredAnalysis(input.structured ?? null);
  return hasPostContentPipelineWork(analysis, input.steps);
}

export function getInFlightCheckpointProgressFromMessages(
  messages: Array<{
    role: string;
    content?: string | null;
    contentJson?: Record<string, unknown> | null;
  }>
): CheckpointBranchProgress | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const progress = getCheckpointBranchProgressFromMessage(msg);
    if (progress?.isInProgress) return progress;
    if (msg.contentJson && typeof msg.contentJson === "object") {
      const root = msg.contentJson as Record<string, unknown>;
      const synthesis = getSynthesisTurnProgress(root.analysis ?? root);
      if (synthesis) return synthesis;
    }
  }
  return null;
}

/** Accordion trigger badge while checkpoint optional agents are still running. */
export function getCheckpointBranchAccordionBadge(
  branch: CheckpointOptionalAgent,
  analysis: unknown,
  sectionReady?: boolean
): CheckpointBranchAccordionBadge | null {
  if (!getCheckpointBranchProgress(analysis)) {
    return null;
  }
  if (!analysis || typeof analysis !== "object") {
    return null;
  }
  const analysisRecord = analysis as Record<string, unknown>;
  if (sectionReady || branchSectionReady(analysisRecord, branch)) {
    return null;
  }
  const statusMap = (analysis as { analysisStatus?: unknown }).analysisStatus;
  if (!statusMap || typeof statusMap !== "object") {
    return null;
  }
  const status = normalizeStatus((statusMap as Record<string, unknown>)[branch]);
  if (!status) return null;
  if (status === "completed") {
    return { kind: "completed", label: "Done" };
  }
  if (status === "running") {
    return { kind: "running", label: "Analyzing…" };
  }
  if (status === "pending") {
    return { kind: "pending", label: "Pending" };
  }
  return null;
}
