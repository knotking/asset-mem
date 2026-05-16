import {
  CHECKPOINT_OPTIONAL_AGENTS,
  type CheckpointOptionalAgent,
  type StructuredResponseData,
} from "../types";

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

function hasStructuredResponseKeys(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const obj = parsed as Record<string, unknown>;
  const analysis = obj.analysis;
  if (analysis && typeof analysis === "object") {
    const a = analysis as Record<string, unknown>;
    return !!(
      a.triageResult ||
      a.coverageResult ||
      a.diyResults ||
      a.serviceResults ||
      a.checkpointSummary ||
      a.checkpointDetails
    );
  }
  return !!(
    obj.triageResult ||
    obj.diyResults ||
    obj.serviceResults ||
    obj.coverageResult ||
    obj.checkpointSummary ||
    obj.checkpointDetails
  );
}

/** Parse dual-format assistant content into structured response JSON. */
export function parseStructuredResponseFromContent(
  content: string
): StructuredResponseData | null {
  const contentToParse = content.trim();
  if (!contentToParse) return null;

  try {
    let combinedMatch = contentToParse.match(
      /```markdown\s*\n([\s\S]*?)\n```\s*\n?```json\s*\n([\s\S]*?)\n```/
    );
    if (!combinedMatch) {
      combinedMatch = contentToParse.match(
        /```markdown\s*\n([\s\S]*?)```\s*\n?```json\s*\n([\s\S]*?)```/
      );
    }
    if (combinedMatch) {
      try {
        const parsed = JSON.parse(combinedMatch[2].trim());
        if (hasStructuredResponseKeys(parsed)) {
          return parsed as StructuredResponseData;
        }
      } catch {
        // continue
      }
    }

    const jsonMatch = contentToParse.match(/```json\s*\n?([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (hasStructuredResponseKeys(parsed)) {
          return parsed as StructuredResponseData;
        }
      } catch {
        // continue
      }
    }

    const anyCodeBlockMatch = contentToParse.match(/```\s*\n?([\s\S]*?)```/);
    if (anyCodeBlockMatch) {
      try {
        const parsed = JSON.parse(anyCodeBlockMatch[1].trim());
        if (hasStructuredResponseKeys(parsed)) {
          return parsed as StructuredResponseData;
        }
      } catch {
        // continue
      }
    }

    const parsed = JSON.parse(contentToParse);
    if (hasStructuredResponseKeys(parsed)) {
      return parsed as StructuredResponseData;
    }
  } catch {
    // not structured JSON
  }

  return null;
}

function analysisFromStructured(
  parsed: StructuredResponseData | null
): unknown {
  if (!parsed) return null;
  return parsed.analysis ?? parsed;
}

export function getCheckpointBranchProgressFromMessage(
  message: { role: string; content?: string | null } | null | undefined
): CheckpointBranchProgress | null {
  if (!message || message.role !== "assistant") return null;
  const content = typeof message.content === "string" ? message.content : "";
  if (!content.trim()) return null;
  const parsed = parseStructuredResponseFromContent(content);
  return getCheckpointBranchProgress(analysisFromStructured(parsed));
}

/** Latest assistant message with optional-agent analysis still in flight. */
export const DISPLAY_TITLE_GRADIENT_CLASS = "display-title-gradient-text";

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

export function getInFlightCheckpointProgressFromMessages(
  messages: Array<{ role: string; content?: string | null }>
): CheckpointBranchProgress | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const progress = getCheckpointBranchProgressFromMessage(msg);
    if (progress?.isInProgress) return progress;
    if (typeof msg.content === "string" && msg.content.trim()) {
      return null;
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
