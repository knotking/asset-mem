import { FREE_PLAN_LIMITS } from '@/lib/plan-limits-public';

/**
 * Free-tier token cap for UI fallbacks when proxy returns unlimited (0) or is unreachable.
 * Webapp-local — does not use `@homeapp/common`. Prefer {@link FREE_PLAN_LIMITS} for new code.
 */
export function getPublicDefaultMonthlyTokenLimit(): number {
  return FREE_PLAN_LIMITS.tokensPerMonth ?? 1_000_000;
}
