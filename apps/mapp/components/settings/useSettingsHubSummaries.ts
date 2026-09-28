import * as React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
import { db } from '@asset-mem/common/firebase';
import { getUserDisplayLabel } from '@asset-mem/common/lib/user-display';
import { formatTokensCompact } from '@asset-mem/common/lib/format-tokens';
import { FREE_PLAN_TOKENS_PER_MONTH } from '@asset-mem/common/lib/plan-defaults';
import { useLlmTokenUsage } from '@asset-mem/common/contexts/llm-token-usage-context';
import { usePreferences } from '@asset-mem/common/contexts/preferences-context';
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

  const accountSubtitle = user ? getUserDisplayLabel(user) : undefined;

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

  const faqSubtitle = 'Checkpoints, chat modes, comparisons, and limits';
  const helpSubtitle = 'Contact support and legal';

  return {
    accountSubtitle,
    faqSubtitle,
    helpSubtitle,
    billingSubtitle,
    usageSubtitle,
    checkpointsSubtitle,
  };
}
