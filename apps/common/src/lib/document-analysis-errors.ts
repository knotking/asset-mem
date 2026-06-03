/**
 * User-facing copy when plan limits or analysis failures block AI features.
 *
 * Keep in sync with `apps/webapp/src/lib/plan-limit-errors.ts` (App Hosting local copy).
 */

export const DOCUMENT_QUOTA_USER_MESSAGE =
  'Monthly document limit reached. Upgrade your plan or wait until next month.';

export const CHECKPOINT_QUOTA_USER_MESSAGE =
  'Monthly checkpoint limit reached. Upgrade your plan or wait until next month.';

export const TOKEN_QUOTA_USER_MESSAGE =
  'Monthly AI token limit reached. Upgrade your plan or wait until next month.';

/** @deprecated Prefer TOKEN_QUOTA_USER_MESSAGE */
export const TOKEN_QUOTA_SHORT_USER_MESSAGE = 'Monthly AI usage limit reached.';

/** Parse proxy/agent error bodies for known codes (e.g. TOKEN_QUOTA_EXCEEDED). */
export function parseAgentErrorCode(body: string): string | undefined {
  if (!body) return undefined;
  if (body.includes('TOKEN_QUOTA_EXCEEDED')) return 'TOKEN_QUOTA_EXCEEDED';
  if (body.includes('DOCUMENT_QUOTA_EXCEEDED')) return 'DOCUMENT_QUOTA_EXCEEDED';
  if (body.includes('CHECKPOINT_QUOTA_EXCEEDED')) return 'CHECKPOINT_QUOTA_EXCEEDED';
  try {
    const parsed = JSON.parse(body) as { code?: string; detail?: { code?: string } };
    return parsed.code ?? parsed.detail?.code;
  } catch {
    return undefined;
  }
}

export function planLimitMessageForErrorCode(
  code: string | undefined
): string | undefined {
  if (code === 'DOCUMENT_QUOTA_EXCEEDED') return DOCUMENT_QUOTA_USER_MESSAGE;
  if (code === 'CHECKPOINT_QUOTA_EXCEEDED') return CHECKPOINT_QUOTA_USER_MESSAGE;
  if (code === 'TOKEN_QUOTA_EXCEEDED') return TOKEN_QUOTA_USER_MESSAGE;
  return undefined;
}

/** @deprecated Use planLimitMessageForErrorCode */
export const documentAnalysisMessageForErrorCode = planLimitMessageForErrorCode;

function normalizePlanLimitErrorMessage(msg: string): string | undefined {
  const trimmed = msg.trim();
  if (!trimmed) return undefined;

  const fromCode = planLimitMessageForErrorCode(parseAgentErrorCode(trimmed));
  if (fromCode) return fromCode;

  if (/monthly document limit/i.test(trimmed)) return DOCUMENT_QUOTA_USER_MESSAGE;
  if (/monthly checkpoint limit/i.test(trimmed)) return CHECKPOINT_QUOTA_USER_MESSAGE;
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
    if (!msg) return defaultPlanLimitFailureMessage('generic');

    if (msg.startsWith('Analysis failed:')) return msg;
    if (
      !msg.startsWith('Failed to queue document analysis') &&
      !msg.startsWith('Failed to analyze checkpoint') &&
      !msg.startsWith('Failed to compare checkpoints') &&
      !msg.startsWith('Failed to stream response')
    ) {
      return msg;
    }
  }

  if (typeof error === 'string') {
    return getPlanLimitFailureMessage(new Error(error));
  }

  return defaultPlanLimitFailureMessage('generic');
}

/** @deprecated Use getPlanLimitFailureMessage */
export const getDocumentAnalysisFailureMessage = getPlanLimitFailureMessage;

export function defaultDocumentAnalysisFailureMessage(): string {
  return defaultPlanLimitFailureMessage('document');
}

export function defaultCheckpointAnalysisFailureMessage(): string {
  return defaultPlanLimitFailureMessage('checkpoint');
}

export function defaultPlanLimitFailureMessage(
  kind: 'document' | 'checkpoint' | 'comparison' | 'generic'
): string {
  switch (kind) {
    case 'document':
      return 'Document analysis could not be completed. Please try again.';
    case 'checkpoint':
      return 'Checkpoint analysis could not be completed. Please try again.';
    case 'comparison':
      return 'Checkpoint comparison could not be completed. Please try again.';
    default:
      return 'This action could not be completed. Please try again.';
  }
}

export type CheckpointQuotaSignals = {
  analysisStatus?: string;
  analysisFailureSummary?: string;
  analysisQuotaExceeded?: boolean;
  analysisCreationQuotaExceeded?: boolean;
};

export function isCheckpointPlanLimitFailure(
  checkpoint: CheckpointQuotaSignals
): boolean {
  if (checkpoint.analysisCreationQuotaExceeded || checkpoint.analysisQuotaExceeded) {
    return true;
  }
  const summary = checkpoint.analysisFailureSummary?.trim();
  if (!summary) return false;
  return normalizePlanLimitErrorMessage(summary) != null;
}

export function checkpointFailureBadgeLabel(checkpoint: CheckpointQuotaSignals): string {
  return isCheckpointPlanLimitFailure(checkpoint) ? 'Plan limit' : 'Failed';
}

/** User-facing line for a Firestore doc with `status: failed`. */
export function getFailedDocumentSummary(doc: {
  status?: string;
  summary?: string;
}): string | null {
  if (doc.status !== 'failed') return null;
  const raw = doc.summary?.trim();
  if (raw) return getPlanLimitFailureMessage(new Error(raw));
  return defaultDocumentAnalysisFailureMessage();
}

export function getCheckpointAnalysisFailureMessage(
  checkpoint: CheckpointQuotaSignals
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
