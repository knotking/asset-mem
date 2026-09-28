/**
 * User-facing copy when plan limits or analysis failures block AI features.
 *
 * Local copy for Firebase App Hosting — webapp does not depend on `@asset-mem/common`.
 * Keep in sync with `apps/common/src/lib/document-analysis-errors.ts`.
 */

export const DOCUMENT_QUOTA_USER_MESSAGE =
  "Monthly document limit reached. Upgrade your plan or wait until next month.";

export const CHECKPOINT_QUOTA_USER_MESSAGE =
  "Monthly checkpoint limit reached. Upgrade your plan or wait until next month.";

export const REPORT_QUOTA_USER_MESSAGE =
  "Monthly report limit reached. Upgrade your plan or wait until next month.";

export const TOKEN_QUOTA_USER_MESSAGE =
  "Monthly AI token limit reached. Upgrade your plan or wait until next month.";

export type PlanLimitSlice = {
  used: number;
  limit: number;
  unlimited: boolean;
};

/** True when adding `countToAdd` creations would exceed the monthly cap. */
export function isAtPlanLimit(
  slice: PlanLimitSlice | null,
  countToAdd = 1,
): boolean {
  if (!slice || slice.unlimited) return false;
  return slice.used + countToAdd > slice.limit;
}

export function planLimitBlockMessage(
  kind: "document" | "checkpoint" | "report",
  slice: PlanLimitSlice | null,
): string | null {
  if (!slice || slice.unlimited) return null;
  if (isAtPlanLimit(slice, 1)) {
    if (kind === "document") return DOCUMENT_QUOTA_USER_MESSAGE;
    if (kind === "checkpoint") return CHECKPOINT_QUOTA_USER_MESSAGE;
    return REPORT_QUOTA_USER_MESSAGE;
  }
  return null;
}

export function planLimitUsageHint(
  kind: "document" | "checkpoint" | "report",
  slice: PlanLimitSlice | null,
): string | null {
  if (!slice || slice.unlimited) return null;
  const label =
    kind === "document"
      ? "documents"
      : kind === "checkpoint"
        ? "checkpoints"
        : "reports";
  return `${slice.used} of ${slice.limit} ${label} used this month`;
}

export function compareCheckpointsFailureMessage(
  status: number,
  body: string,
): string {
  const quota = planLimitMessageForErrorCode(parsePlanLimitErrorCode(body));
  if (quota) return quota;
  const lower = body.toLowerCase();
  if (
    status === 404 ||
    lower.includes("not_found") ||
    lower.includes("not found") ||
    lower.includes("gemini-3.1")
  ) {
    return "Checkpoint comparison is temporarily unavailable. Please try again shortly.";
  }
  if (status >= 500) {
    return "Checkpoint comparison could not be completed. Please try again later.";
  }
  return defaultPlanLimitFailureMessage("comparison");
}

export function isDocumentQuotaMessage(message: string | undefined): boolean {
  if (!message?.trim()) return false;
  return (
    normalizePlanLimitErrorMessage(message.trim()) ===
    DOCUMENT_QUOTA_USER_MESSAGE
  );
}

/** Parse proxy/agent error bodies for known codes (e.g. TOKEN_QUOTA_EXCEEDED). */
export function parsePlanLimitErrorCode(body: string): string | undefined {
  if (!body) return undefined;
  if (body.includes("TOKEN_QUOTA_EXCEEDED")) return "TOKEN_QUOTA_EXCEEDED";
  if (body.includes("DOCUMENT_QUOTA_EXCEEDED")) return "DOCUMENT_QUOTA_EXCEEDED";
  if (body.includes("CHECKPOINT_QUOTA_EXCEEDED")) return "CHECKPOINT_QUOTA_EXCEEDED";
  if (body.includes("REPORT_QUOTA_EXCEEDED")) return "REPORT_QUOTA_EXCEEDED";
  try {
    const parsed = JSON.parse(body) as {
      code?: string;
      detail?: { code?: string };
    };
    return parsed.code ?? parsed.detail?.code;
  } catch {
    return undefined;
  }
}

export function planLimitMessageForErrorCode(
  code: string | undefined,
): string | undefined {
  if (code === "DOCUMENT_QUOTA_EXCEEDED") return DOCUMENT_QUOTA_USER_MESSAGE;
  if (code === "CHECKPOINT_QUOTA_EXCEEDED") return CHECKPOINT_QUOTA_USER_MESSAGE;
  if (code === "REPORT_QUOTA_EXCEEDED") return REPORT_QUOTA_USER_MESSAGE;
  if (code === "TOKEN_QUOTA_EXCEEDED") return TOKEN_QUOTA_USER_MESSAGE;
  return undefined;
}

function normalizePlanLimitErrorMessage(msg: string): string | undefined {
  const trimmed = msg.trim();
  if (!trimmed) return undefined;

  const fromCode = planLimitMessageForErrorCode(parsePlanLimitErrorCode(trimmed));
  if (fromCode) return fromCode;

  if (/monthly document limit/i.test(trimmed)) return DOCUMENT_QUOTA_USER_MESSAGE;
  if (/monthly checkpoint limit/i.test(trimmed)) return CHECKPOINT_QUOTA_USER_MESSAGE;
  if (/monthly report limit/i.test(trimmed)) return REPORT_QUOTA_USER_MESSAGE;
  if (/monthly ai token limit/i.test(trimmed)) return TOKEN_QUOTA_USER_MESSAGE;
  if (/monthly ai usage limit/i.test(trimmed)) return TOKEN_QUOTA_USER_MESSAGE;

  return undefined;
}

/** Map a thrown value or API body to a short user-facing message. */
export function getPlanLimitFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    const normalized = normalizePlanLimitErrorMessage(error.message);
    if (normalized) return normalized;

    const msg = error.message.trim();
    if (!msg) return defaultPlanLimitFailureMessage("generic");

    if (msg.startsWith("Analysis failed:")) return msg;
    if (
      !msg.startsWith("Failed to queue document analysis") &&
      !msg.startsWith("Failed to analyze checkpoint") &&
      !msg.startsWith("Failed to compare checkpoints") &&
      !msg.startsWith("Failed to stream response")
    ) {
      return msg;
    }
  }

  if (typeof error === "string") {
    return getPlanLimitFailureMessage(new Error(error));
  }

  return defaultPlanLimitFailureMessage("generic");
}

export const getDocumentAnalysisFailureMessage = getPlanLimitFailureMessage;

export function defaultDocumentAnalysisFailureMessage(): string {
  return defaultPlanLimitFailureMessage("document");
}

export function defaultCheckpointAnalysisFailureMessage(): string {
  return defaultPlanLimitFailureMessage("checkpoint");
}

export function defaultPlanLimitFailureMessage(
  kind: "document" | "checkpoint" | "comparison" | "generic",
): string {
  switch (kind) {
    case "document":
      return "Document analysis could not be completed. Please try again.";
    case "checkpoint":
      return "Checkpoint analysis could not be completed. Please try again.";
    case "comparison":
      return "Checkpoint comparison could not be completed. Please try again.";
    default:
      return "This action could not be completed. Please try again.";
  }
}

export type CheckpointQuotaSignals = {
  analysisStatus?: string;
  analysisFailureSummary?: string;
  analysisQuotaExceeded?: boolean;
  analysisCreationQuotaExceeded?: boolean;
};

export function isCheckpointPlanLimitFailure(
  checkpoint: CheckpointQuotaSignals,
): boolean {
  if (
    checkpoint.analysisCreationQuotaExceeded ||
    checkpoint.analysisQuotaExceeded
  ) {
    return true;
  }
  const summary = checkpoint.analysisFailureSummary?.trim();
  if (!summary) return false;
  return normalizePlanLimitErrorMessage(summary) != null;
}

export function checkpointFailureBadgeLabel(
  checkpoint: CheckpointQuotaSignals,
): string {
  return isCheckpointPlanLimitFailure(checkpoint) ? "Plan limit" : "Failed";
}

/** User-facing line for a Firestore doc with `status: failed`. */
export function getFailedDocumentSummary(doc: {
  status?: string;
  summary?: string;
}): string | null {
  if (doc.status !== "failed") return null;
  const raw = doc.summary?.trim();
  if (raw) return getPlanLimitFailureMessage(new Error(raw));
  return defaultDocumentAnalysisFailureMessage();
}

export function getCheckpointAnalysisFailureMessage(
  checkpoint: CheckpointQuotaSignals,
): string {
  const summary = checkpoint.analysisFailureSummary?.trim();
  if (summary) {
    return normalizePlanLimitErrorMessage(summary) ?? summary;
  }
  if (checkpoint.analysisCreationQuotaExceeded) {
    return CHECKPOINT_QUOTA_USER_MESSAGE;
  }
  if (checkpoint.analysisQuotaExceeded) {
    return TOKEN_QUOTA_USER_MESSAGE;
  }
  return defaultCheckpointAnalysisFailureMessage();
}
