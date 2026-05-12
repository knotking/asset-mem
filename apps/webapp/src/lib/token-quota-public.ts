/**
 * @deprecated Free-tier token cap comes from proxy POST /token-quota-status (resolved limit).
 * Landing page uses {@link FREE_PLAN_LIMITS} in plan-limits-public.ts for marketing copy.
 */
export function getPublicDefaultMonthlyTokenLimit(): number | null {
  return null;
}
