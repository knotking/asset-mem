/**
 * Monthly document/checkpoint/report creation limits from /token-quota-status.
 * Use mergePlanLimitUsage with live Firestore period*Creations for UI display.
 */

import {
  CHECKPOINT_QUOTA_USER_MESSAGE,
  DOCUMENT_QUOTA_USER_MESSAGE,
} from './document-analysis-errors';

export type PlanLimitSlice = {
  used: number;
  limit: number;
  unlimited: boolean;
};

export function toDisplayPlanLimit(
  raw: { used?: number; limit?: number; unlimited?: boolean } | undefined,
  freeDefault: number,
): PlanLimitSlice | null {
  if (!raw || typeof raw.used !== 'number') {
    return null;
  }
  const unlimited =
    Boolean(raw.unlimited) || (typeof raw.limit === 'number' && raw.limit <= 0);
  const limit =
    unlimited || typeof raw.limit !== 'number' ? freeDefault : raw.limit;
  return { used: raw.used, limit, unlimited: false };
}

/** Apply live Firestore period counter to a proxy-resolved cap slice. */
export function mergePlanLimitUsage(
  slice: PlanLimitSlice | null,
  periodCount: number,
): PlanLimitSlice | null {
  if (!slice) return null;
  return { ...slice, used: periodCount };
}

/** True when adding `countToAdd` creations would exceed the monthly cap. */
export function isAtPlanLimit(
  slice: PlanLimitSlice | null,
  countToAdd = 1,
): boolean {
  if (!slice || slice.unlimited) return false;
  return slice.used + countToAdd > slice.limit;
}

export function planLimitBlockMessage(
  kind: 'document' | 'checkpoint',
  slice: PlanLimitSlice | null,
): string | null {
  if (!slice || slice.unlimited || !isAtPlanLimit(slice, 1)) return null;
  return kind === 'document'
    ? DOCUMENT_QUOTA_USER_MESSAGE
    : CHECKPOINT_QUOTA_USER_MESSAGE;
}

export function planLimitUsageHint(
  kind: 'document' | 'checkpoint',
  slice: PlanLimitSlice | null,
): string | null {
  if (!slice || slice.unlimited) return null;
  const label = kind === 'document' ? 'documents' : 'checkpoints';
  return `${slice.used} of ${slice.limit} ${label} used this month`;
}
