/**
 * Monthly document/checkpoint/report creation limits from /token-quota-status.
 * Use mergePlanLimitUsage with live Firestore period*Creations for UI display.
 */

import {
  CHECKPOINT_QUOTA_USER_MESSAGE,
  DOCUMENT_QUOTA_USER_MESSAGE,
  REPORT_QUOTA_USER_MESSAGE,
} from './document-analysis-errors';

export type PlanLimitKind = 'document' | 'checkpoint' | 'report';

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

/** Current UTC billing period key (`YYYY-MM`), aligned with backend `current_quota_period_key`. */
export function currentUtcQuotaPeriodKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Period creation count when Firestore `quotaPeriodKey` matches the current UTC month. */
export function effectivePeriodCreationCount(
  storedPeriodKey: string | null | undefined,
  periodCount: number,
  now = new Date(),
): number {
  if (!storedPeriodKey || storedPeriodKey !== currentUtcQuotaPeriodKey(now)) {
    return 0;
  }
  return periodCount;
}

/** Apply live Firestore period counter to a proxy-resolved cap slice. */
export function mergePlanLimitUsage(
  slice: PlanLimitSlice | null,
  periodCount: number,
  storedPeriodKey?: string | null,
): PlanLimitSlice | null {
  if (!slice) return null;
  return {
    ...slice,
    used: effectivePeriodCreationCount(storedPeriodKey, periodCount),
  };
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
  kind: PlanLimitKind,
  slice: PlanLimitSlice | null,
): string | null {
  if (!slice || slice.unlimited || !isAtPlanLimit(slice, 1)) return null;
  if (kind === 'document') return DOCUMENT_QUOTA_USER_MESSAGE;
  if (kind === 'checkpoint') return CHECKPOINT_QUOTA_USER_MESSAGE;
  return REPORT_QUOTA_USER_MESSAGE;
}

export function planLimitUsageHint(
  kind: PlanLimitKind,
  slice: PlanLimitSlice | null,
): string | null {
  if (!slice || slice.unlimited) return null;
  const label =
    kind === 'document'
      ? 'documents'
      : kind === 'checkpoint'
        ? 'checkpoints'
        : 'reports';
  return `${slice.used} of ${slice.limit} ${label} used this month`;
}
