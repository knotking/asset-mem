/**
 * Marketing / UI defaults for monthly creation limits (UTC month).
 * Enforcement uses proxy `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` (tiers plus/pro); keep marketing copy in sync.
 */

export type PlanTierLimits = {
  documentsPerMonth: number;
  checkpointsPerMonth: number;
  tokensPerMonth: number | null;
  /** List price in USD per month (Stripe). */
  pricePerMonthUsd: number;
};

/** Free tier when no active subscription (proxy env defaults). */
export const FREE_PLAN_LIMITS: PlanTierLimits = {
  documentsPerMonth: 2,
  checkpointsPerMonth: 5,
  tokensPerMonth: 1_000_000,
  pricePerMonthUsd: 0,
};

export const PLUS_PLAN_LIMITS: PlanTierLimits = {
  documentsPerMonth: 10,
  checkpointsPerMonth: 30,
  tokensPerMonth: 10_000_000,
  pricePerMonthUsd: 19,
};

export const PRO_PLAN_LIMITS: PlanTierLimits = {
  documentsPerMonth: 30,
  checkpointsPerMonth: 100,
  tokensPerMonth: 25_000_000,
  pricePerMonthUsd: 39,
};

export function formatPlanPriceUsd(amount: number): string {
  if (amount <= 0) return '$0';
  return `$${amount}`;
}

export function formatMonthlyLimit(n: number): string {
  return n.toLocaleString('en-US');
}
