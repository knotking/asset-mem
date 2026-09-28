/**
 * Mirrors `apps/common/src/lib/checkpoint-branch-progress.ts` for Firebase App Hosting:
 * the webapp does not depend on `@asset-mem/common`. Keep both files in sync.
 */

import type { AgentStep } from "@/lib/types";

export type CheckpointOptionalAgent = "coverage" | "diy" | "service" | "cost";

const CHECKPOINT_OPTIONAL_AGENTS: CheckpointOptionalAgent[] = [
  "coverage",
  "diy",
  "service",
  "cost",
];

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

/** ``analysis.analysisStatus`` key for executive-summary synthesis (structured message schema). */
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
    if (
      String(s.searchStatus ?? "")
        .trim()
        .toLowerCase() === "failed"
    ) {
      return true;
    }
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

function formatCheckpointBranchList(names: string[]): string {
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

/** CSS utility in globals.css — gradient text with looping background-position animation. */
export const DISPLAY_TITLE_GRADIENT_CLASS = "display-title-gradient-text";

/**
 * True when raw ``analysisStatus`` has a branch still pending/running.
 * Unlike {@link getCheckpointBranchProgress}, does not treat section content as completed.
 */
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

export type SynthesisProgressOptions = {
  /** Local stream / Firestore in-flight turn — required for pre-synthesis gap UX. */
  isTurnInFlight?: boolean;
};

/** True when every optional branch in ``analysisStatus`` is completed. */
export function areAllOptionalBranchesCompleted(analysis: unknown): boolean {
  if (!analysis || typeof analysis !== "object") {
    return false;
  }
  const statusMap = (analysis as { analysisStatus?: unknown }).analysisStatus;
  if (!statusMap || typeof statusMap !== "object") {
    return false;
  }

  const analysisRecord = analysis as Record<string, unknown>;
  let tracked = 0;
  for (const key of CHECKPOINT_OPTIONAL_AGENTS) {
    let status = normalizeStatus((statusMap as Record<string, unknown>)[key]);
    if (
      status &&
      status !== "completed" &&
      branchSectionReady(analysisRecord, key)
    ) {
      status = "completed";
    }
    if (!status) continue;
    tracked += 1;
    if (status !== "completed") {
      return false;
    }
  }
  return tracked > 0;
}

/**
 * Server gap after optional branches finish but before ``analysisStatus.synthesis``
 * is patched — treat as synthesis in flight on the client while the turn is open.
 */
export function isSynthesisPendingAfterBranches(
  analysis: unknown,
  options?: SynthesisProgressOptions
): boolean {
  if (!options?.isTurnInFlight) {
    return false;
  }
  if (getSynthesisAnalysisStatus(analysis) === "completed") {
    return false;
  }
  if (isSynthesisAnalysisInProgress(analysis)) {
    return false;
  }
  return areAllOptionalBranchesCompleted(analysis);
}

export function isSynthesisWorkInFlight(
  analysis: unknown,
  steps?: ReadonlyArray<Pick<AgentStep, "name" | "status">> | null,
  options?: SynthesisProgressOptions
): boolean {
  return (
    isSynthesisAnalysisInProgress(analysis) ||
    isSynthesisAgentStepExecuting(steps) ||
    isSynthesisPendingAfterBranches(analysis, options)
  );
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
  steps?: ReadonlyArray<Pick<AgentStep, "name" | "status">> | null,
  options?: SynthesisProgressOptions
): boolean {
  return isSynthesisWorkInFlight(analysis, steps, options);
}

/**
 * Post-content status strip: optional branches or synthesis still running.
 * Ignores orchestrator / checkpoint-load steps so checkpoint-only turns do not duplicate status.
 */
export function hasPostContentPipelineWork(
  analysis: unknown,
  steps?: ReadonlyArray<Pick<AgentStep, "name" | "status">> | null,
  options?: SynthesisProgressOptions
): boolean {
  if (getCheckpointBranchProgress(analysis)?.isInProgress) {
    return true;
  }
  if (shouldShowSummaryAccordionPlaceholder(analysis, steps, options)) {
    return true;
  }
  return !!steps?.some(
    (step) =>
      step.status === "executing" &&
      CHECKPOINT_OPTIONAL_AGENT_STEP_NAMES.has(step.name)
  );
}

export function getSynthesisTurnProgress(
  analysis: unknown,
  options?: SynthesisProgressOptions
): CheckpointBranchProgress | null {
  if (
    !isSynthesisAnalysisInProgress(analysis) &&
    !isSynthesisPendingAfterBranches(analysis, options)
  ) {
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

export type InFlightCheckpointProgressOptions = {
  /** True while composer stream / send is open for the current turn. */
  isStreamActive?: boolean;
};

export function hasCheckpointAnalysisStatusInProgress(
  analysis: unknown
): boolean {
  if (getCheckpointBranchProgress(analysis)?.isInProgress) {
    return true;
  }
  return isSynthesisAnalysisInProgress(analysis);
}

/** Check nested or flat structured payload for in-flight checkpoint analysis. */
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
  const analysis = resolveStructuredAnalysis(input.structured ?? null);
  const hasTitle =
    typeof analysis?.title === "string" && analysis.title.trim().length > 0;

  if (input.isTurnInFlight) {
    return true;
  }

  // Title is written during the stream; after SSE closes keep it static while branches finish.
  if (hasTitle) {
    return false;
  }

  if (hasCheckpointDisplayTitleInProgress(input.structured)) {
    return true;
  }
  return hasPostContentPipelineWork(analysis, input.steps, {
    isTurnInFlight: input.isTurnInFlight,
  });
}

export function getInFlightCheckpointProgressFromMessages(
  messages: Array<{
    role: string;
    content?: string | null;
    contentJson?: Record<string, unknown> | null;
  }>,
  options?: InFlightCheckpointProgressOptions
): CheckpointBranchProgress | null {
  let seenAssistant = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const isLatestAssistant = !seenAssistant;
    seenAssistant = true;

    const progress = getCheckpointBranchProgressFromMessage(msg);
    if (progress?.isInProgress) return progress;
    if (msg.contentJson && typeof msg.contentJson === "object") {
      const root = msg.contentJson as Record<string, unknown>;
      const synthesis = getSynthesisTurnProgress(root.analysis ?? root, {
        isTurnInFlight: isLatestAssistant && !!options?.isStreamActive,
      });
      if (synthesis) return synthesis;
    }
  }
  return null;
}

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
