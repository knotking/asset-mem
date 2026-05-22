import * as React from 'react';
import { Linking, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { CreditCard } from 'lucide-react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { db } from '@homeapp/common/firebase';
import { formatTokensCompact } from '@homeapp/common/lib/format-tokens';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  inferPlanTierFromLimits,
  PLAN_NAMES,
  PLAN_TIER_ORDER,
  planLimitsOneLiner,
  planPriceLabel,
  type PlanTierKey,
} from '@/lib/plan-limits';
import { WEB_SETTINGS_BILLING_PATH } from '@/lib/api';
import { createWebBillingHandoffUrl, createWebBillingPortalHandoffUrl } from '@/lib/auth-handoff';

type BillingSummary = {
  subscriptionStatus?: string | null;
  monthlyTokenLimit?: number | null;
  monthlyDocumentLimit?: number | null;
  monthlyCheckpointLimit?: number | null;
  stripeCustomerId?: string | null;
};

function PlanOptionRow({
  tier,
  isCurrent,
}: {
  tier: PlanTierKey;
  isCurrent: boolean;
}) {
  return (
    <View
      className={cn(
        'rounded-md border px-3 py-2.5 gap-0.5',
        isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-background',
      )}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-sm font-semibold text-foreground">{planPriceLabel(tier)}</Text>
        {isCurrent ? (
          <View className="rounded-full bg-primary px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-primary-foreground">Current</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-xs text-muted-foreground">{planLimitsOneLiner(tier)}</Text>
    </View>
  );
}

export function PlanBillingSettings() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const [summary, setSummary] = React.useState<BillingSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<'portal' | 'web' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, 'users', user.uid, 'billing', 'summary');
    return onSnapshot(
      ref,
      (snap) => {
        setSummary(snap.exists() ? (snap.data() as BillingSummary) : {});
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [user]);

  const status = (summary?.subscriptionStatus || '').toLowerCase();
  const isPaid = status === 'active' || status === 'trialing';
  const hasStripeCustomer = Boolean(summary?.stripeCustomerId);
  const currentTier = inferPlanTierFromLimits(summary?.monthlyTokenLimit, isPaid);
  const activePlanLabel = currentTier
    ? PLAN_NAMES[currentTier]
    : isPaid
      ? 'Paid plan'
      : PLAN_NAMES.free;
  const activePriceLabel =
    currentTier != null ? planPriceLabel(currentTier) : isPaid ? null : planPriceLabel('free');

  const openWebBilling = async () => {
    setError(null);
    setBusy('web');
    try {
      const theme = colorScheme === 'light' ? 'light' : 'dark';
      const url = await createWebBillingHandoffUrl(WEB_SETTINGS_BILLING_PATH, theme);
      if (!url) {
        setError('Web app URL is not configured for this build.');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open browser');
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setError(null);
    setBusy('portal');
    try {
      const theme = colorScheme === 'light' ? 'light' : 'dark';
      const url = await createWebBillingPortalHandoffUrl(theme);
      if (!url) {
        setError('Web app URL is not configured for this build.');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open billing portal');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <View className="flex-row items-center gap-2">
            <Icon as={CreditCard} className="size-5 text-foreground" />
            <CardTitle>Plan &amp; billing</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <Icon as={CreditCard} className="size-5 text-foreground" />
          <CardTitle>Plan &amp; billing</CardTitle>
        </View>
        <CardDescription>
          Subscriptions are billed through Stripe. Limits reset at the start of each UTC month.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        <View className="rounded-md border border-border bg-muted/30 px-3 py-3 gap-2">
          <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current plan
          </Text>
          <Text className="text-xl font-semibold text-foreground">{activePlanLabel}</Text>
          {activePriceLabel ? (
            <Text className="text-sm text-muted-foreground">{activePriceLabel}</Text>
          ) : null}
          {isPaid ? (
            <Text className="text-sm text-muted-foreground capitalize">
              Status: {status || 'active'}
            </Text>
          ) : (
            <Text className="text-sm text-muted-foreground">
              Upgrade to {planPriceLabel('plus')} or {planPriceLabel('pro')} on the web app.
            </Text>
          )}
          {isPaid && summary?.monthlyTokenLimit != null && summary.monthlyTokenLimit > 0 ? (
            <Text className="text-xs text-muted-foreground pt-1">
              Your allowance: {formatTokensCompact(summary.monthlyTokenLimit)} AI tokens
              {summary.monthlyDocumentLimit != null && summary.monthlyDocumentLimit > 0
                ? ` · ${summary.monthlyDocumentLimit.toLocaleString('en-US')} documents`
                : ''}
              {summary.monthlyCheckpointLimit != null && summary.monthlyCheckpointLimit > 0
                ? ` · ${summary.monthlyCheckpointLimit.toLocaleString('en-US')} checkpoint AI runs`
                : ''}{' '}
              per month
            </Text>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isPaid ? 'Available plans' : 'Plans'}
          </Text>
          {PLAN_TIER_ORDER.map((tier) => (
            <PlanOptionRow
              key={tier}
              tier={tier}
              isCurrent={
                currentTier != null
                  ? currentTier === tier
                  : !isPaid
                    ? tier === 'free'
                    : false
              }
            />
          ))}
        </View>

        {error ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {!isPaid ? (
          <Button className="w-full" disabled={busy != null} onPress={() => void openWebBilling()}>
            <Text className="font-semibold text-primary-foreground">
              {busy === 'web' ? 'Opening…' : 'Upgrade to Plus or Pro on web'}
            </Text>
          </Button>
        ) : null}

        {isPaid && hasStripeCustomer ? (
          <Button className="w-full" disabled={busy != null} onPress={() => void openPortal()}>
            <Text className="font-semibold text-primary-foreground">
              {busy === 'portal' ? 'Opening billing…' : 'Manage subscription'}
            </Text>
          </Button>
        ) : null}

        {isPaid ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={busy != null}
            onPress={() => void openWebBilling()}>
            <Text className="font-semibold text-foreground">
              {busy === 'web' ? 'Opening…' : 'Compare plans on web'}
            </Text>
          </Button>
        ) : null}

        <Text className="text-xs leading-snug text-muted-foreground">
          {!isPaid
            ? 'Checkout runs in your browser with the same account. '
            : 'Change plan, payment method, or cancel in Stripe. '}
          Plan changes are handled securely in Stripe.
        </Text>
      </CardContent>
    </Card>
  );
}
