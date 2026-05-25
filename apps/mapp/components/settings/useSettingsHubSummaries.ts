import * as React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { db } from '@homeapp/common/firebase';
import { getUserDisplayLabel } from '@homeapp/common/lib/user-display';
import { formatTokensCompact } from '@homeapp/common/lib/format-tokens';
import { FREE_PLAN_TOKENS_PER_MONTH } from '@homeapp/common/lib/plan-defaults';
import { useLlmTokenUsage } from '@homeapp/common/contexts/llm-token-usage-context';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
import { inferPlanTierFromLimits, PLAN_NAMES } from '@/lib/plan-limits';

type BillingSummary = {
  subscriptionStatus?: string | null;
  monthlyTokenLimit?: number | null;
};

export function useSettingsHubSummaries() {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const {
    loading: usageLoading,
    periodTotalTokens,
    effectiveMonthlyLimit,
  } = useLlmTokenUsage();

  const [billingSummary, setBillingSummary] = React.useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setBillingSummary(null);
      setBillingLoading(false);
      return;
    }
    setBillingLoading(true);
    const ref = doc(db, 'users', user.uid, 'billing', 'summary');
    return onSnapshot(
      ref,
      (snap) => {
        setBillingSummary(snap.exists() ? (snap.data() as BillingSummary) : {});
        setBillingLoading(false);
      },
      () => setBillingLoading(false),
    );
  }, [user]);

  const accountSubtitle = user ? getUserDisplayLabel(user.displayName) : undefined;

  const status = (billingSummary?.subscriptionStatus || '').toLowerCase();
  const isPaid = status === 'active' || status === 'trialing';
  const currentTier = inferPlanTierFromLimits(billingSummary?.monthlyTokenLimit, isPaid);
  const billingSubtitle = billingLoading
    ? 'Loading…'
    : currentTier
      ? PLAN_NAMES[currentTier]
      : isPaid
        ? 'Paid plan'
        : PLAN_NAMES.free;

  const monthlyCap = effectiveMonthlyLimit ?? FREE_PLAN_TOKENS_PER_MONTH;
  const usageSubtitle = usageLoading
    ? 'Loading…'
    : monthlyCap > 0
      ? `${formatTokensCompact(periodTotalTokens)} of ${formatTokensCompact(monthlyCap)} this month`
      : 'No monthly cap';

  const comparisonEnabled = preferences?.checkpointComparison?.enabled ?? true;
  const checkpointsSubtitle = comparisonEnabled ? 'Automatic comparison on' : 'Automatic comparison off';

  return {
    accountSubtitle,
    billingSubtitle,
    usageSubtitle,
    checkpointsSubtitle,
  };
}
