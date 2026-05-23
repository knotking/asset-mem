/**
 * Free-tier limits for UI fallbacks when proxy returns unlimited (0) or is unreachable.
 * Keep in sync with apps/webapp/src/lib/plan-limits-public.ts and apps/mapp/lib/plan-limits.ts.
 */
export const FREE_PLAN_TOKENS_PER_MONTH = 1_000_000;
export const FREE_PLAN_DOCUMENTS_PER_MONTH = 2;
export const FREE_PLAN_CHECKPOINTS_PER_MONTH = 5;
