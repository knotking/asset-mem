/**
 * Marketing plan copy (aligned with webapp plan-limits-public.ts).
 * Enforcement uses proxy STRIPE_B2C_PRICE_TOKEN_CAPS_JSON + Firestore billing/summary.
 */

import { formatTokensCompact } from '@homeapp/common/lib/format-tokens';

export const FREE_TOKENS_PER_MONTH = 1_000_000;
export const PLUS_TOKENS_PER_MONTH = 10_000_000;
export const PRO_TOKENS_PER_MONTH = 25_000_000;

export type PlanTierKey = 'free' | 'plus' | 'pro';

export type PlanMarketing = {
  name: string;
  pricePerMonthUsd: number;
  tokensPerMonth: number;
  documentsPerMonth: number;
  checkpointsPerMonth: number;
};

export const PLAN_MARKETING: Record<PlanTierKey, PlanMarketing> = {
  free: {
    name: 'Free',
    pricePerMonthUsd: 0,
    tokensPerMonth: FREE_TOKENS_PER_MONTH,
    documentsPerMonth: 2,
    checkpointsPerMonth: 5,
  },
  plus: {
    name: 'Plus',
    pricePerMonthUsd: 19,
    tokensPerMonth: PLUS_TOKENS_PER_MONTH,
    documentsPerMonth: 10,
    checkpointsPerMonth: 30,
  },
  pro: {
    name: 'Pro',
    pricePerMonthUsd: 39,
    tokensPerMonth: PRO_TOKENS_PER_MONTH,
    documentsPerMonth: 30,
    checkpointsPerMonth: 100,
  },
};

export const PLAN_NAMES: Record<PlanTierKey, string> = {
  free: PLAN_MARKETING.free.name,
  plus: PLAN_MARKETING.plus.name,
  pro: PLAN_MARKETING.pro.name,
};

export const PLAN_TIER_ORDER: PlanTierKey[] = ['free', 'plus', 'pro'];

export function formatPlanPriceUsd(amount: number): string {
  if (amount <= 0) return '$0';
  return `$${amount}`;
}

/** e.g. "Plus · $19/mo" */
export function planPriceLabel(tier: PlanTierKey): string {
  const plan = PLAN_MARKETING[tier];
  if (plan.pricePerMonthUsd <= 0) {
    return `${plan.name} · ${formatPlanPriceUsd(0)}`;
  }
  return `${plan.name} · ${formatPlanPriceUsd(plan.pricePerMonthUsd)}/mo`;
}

/** One-line limit summary for plan picker list. */
export function planLimitsOneLiner(tier: PlanTierKey): string {
  const p = PLAN_MARKETING[tier];
  return `${formatTokensCompact(p.tokensPerMonth)} AI tokens · ${p.documentsPerMonth} docs · ${p.checkpointsPerMonth} checkpoints / mo`;
}

/** Best-effort tier from Firestore billing caps (marketing defaults). */
export function inferPlanTierFromLimits(
  monthlyTokenLimit: number | null | undefined,
  isPaid: boolean,
): PlanTierKey | null {
  if (!isPaid) return 'free';
  if (monthlyTokenLimit == null || monthlyTokenLimit <= 0) return null;
  if (monthlyTokenLimit === PLUS_TOKENS_PER_MONTH) return 'plus';
  if (monthlyTokenLimit === PRO_TOKENS_PER_MONTH) return 'pro';
  return null;
}
