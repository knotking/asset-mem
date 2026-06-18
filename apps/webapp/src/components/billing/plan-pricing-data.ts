import { formatTokensCompact } from '@/lib/format-tokens';
import {
  FREE_PLAN_LIMITS,
  PLUS_PLAN_LIMITS,
  PRO_PLAN_LIMITS,
  formatMonthlyLimit,
  type PlanTierLimits,
} from '@/lib/plan-limits-public';

export type PlanTierKey = 'free' | 'plus' | 'pro';

export type EnterprisePricingCard = {
  name: string;
  priceLabel: string;
  blurb: string;
  bullets: string[];
};

export const ENTERPRISE_PRICING_CARD: EnterprisePricingCard = {
  name: 'Enterprise',
  priceLabel: 'Custom',
  blurb: 'For portfolios, claims workflows, and field operations at scale.',
  bullets: [
    'Dedicated onboarding and team support',
    'Custom portfolio limits',
    'Co-designed workflows and report templates',
    'Priority feedback channel',
  ],
};

export type PlanCard = {
  name: string;
  blurb: string;
  limits: PlanTierLimits;
  highlight?: boolean;
};

export const PLAN_CARDS: Record<PlanTierKey, PlanCard> = {
  free: {
    name: 'Free',
    blurb: 'Explore the app.',
    limits: FREE_PLAN_LIMITS,
  },
  plus: {
    name: 'Plus',
    blurb: 'For active homeowners using AI regularly.',
    limits: PLUS_PLAN_LIMITS,
    highlight: true,
  },
  pro: {
    name: 'Pro',
    blurb: 'For high-volume documents, inspections, and AI guidance.',
    limits: PRO_PLAN_LIMITS,
  },
};

export const PLAN_TIER_ORDER: PlanTierKey[] = ['free', 'plus', 'pro'];

export const PLAN_TIER_RANK: Record<PlanTierKey, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};

/** Label for a paid subscriber opening Stripe Customer Portal from a paid plan card. */
export function paidPortalActionLabel(
  currentTier: PlanTierKey | null,
  targetTier: PlanTierKey,
): string {
  const currentRank = PLAN_TIER_RANK[currentTier ?? 'free'];
  const targetRank = PLAN_TIER_RANK[targetTier];
  const name = PLAN_CARDS[targetTier].name;
  if (targetRank > currentRank) {
    return `Upgrade to ${name}`;
  }
  return `Switch to ${name}`;
}

export function freeTierTokenLabel(): string {
  const cap = FREE_PLAN_LIMITS.tokensPerMonth;
  if (cap == null) {
    return 'Starter AI tokens / month';
  }
  return `About ${formatTokensCompact(cap)} AI tokens / month`;
}

export function planLimitBullets(
  limits: PlanTierLimits,
  tier: PlanTierKey,
): string[] {
  const bullets: string[] = [];
  if (limits.tokensPerMonth != null) {
    bullets.push(
      `About ${formatTokensCompact(limits.tokensPerMonth)} AI tokens / month`,
    );
  } else {
    bullets.push(tier === 'free' ? freeTierTokenLabel() : '');
  }
  bullets.push(
    `${formatMonthlyLimit(limits.documentsPerMonth)} document AI analyses / month`,
  );
  bullets.push(
    `${formatMonthlyLimit(limits.checkpointsPerMonth)} checkpoint AI runs / month`,
  );
  bullets.push(
    `${formatMonthlyLimit(limits.reportsPerMonth)} property report generations / month`,
  );
  return bullets.filter(Boolean);
}

/** Best-effort tier from Firestore billing caps (marketing defaults). */
export function inferPlanTierFromLimits(
  monthlyTokenLimit: number | null | undefined,
  isPaid: boolean,
): PlanTierKey | null {
  if (!isPaid) return 'free';
  if (monthlyTokenLimit == null || monthlyTokenLimit <= 0) return null;
  if (monthlyTokenLimit === PLUS_PLAN_LIMITS.tokensPerMonth) return 'plus';
  if (monthlyTokenLimit === PRO_PLAN_LIMITS.tokensPerMonth) return 'pro';
  return null;
}
