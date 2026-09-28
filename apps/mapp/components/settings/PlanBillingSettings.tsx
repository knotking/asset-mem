import * as React from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { CreditCard } from 'lucide-react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
import { db } from '@asset-mem/common/firebase';
import { formatTokensCompact } from '@asset-mem/common/lib/format-tokens';
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
import { validateBillingWebConfig } from '@/lib/expo-extra';
import { createWebBillingHandoffUrl, createWebBillingPortalHandoffUrl } from '@/lib/auth-handoff';
import { openExternalWebUrl } from '@/lib/open-external-url';
import {
  IOS_FREE_PLAN_HINT,
  IOS_PLAN_BILLING_DESCRIPTION,
  isIosAppStoreBillingRestricted,
  planSettingsScreenTitle,
} from '@/lib/ios-billing-compliance';
import { createLogger } from '@/lib/logger';

const billingLog = createLogger('billing');

type BillingSummary = {
  subscriptionStatus?: string | null;
  monthlyTokenLimit?: number | null;
  monthlyDocumentLimit?: number | null;
  monthlyCheckpointLimit?: number | null;
  monthlyReportGenerationsLimit?: number | null;
  stripeCustomerId?: string | null;
};

function PlanOptionRow({
  tier,
  isCurrent,
  showPrice,
}: {
  tier: PlanTierKey;
  isCurrent: boolean;
  showPrice: boolean;
}) {
  return (
    <View
      className={cn(
        'rounded-md border px-3 py-2.5 gap-0.5',
        isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-background',
      )}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-sm font-semibold text-foreground">
          {showPrice ? planPriceLabel(tier) : PLAN_NAMES[tier]}
        </Text>
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
  const iosBillingRestricted = isIosAppStoreBillingRestricted();
  const screenTitle = planSettingsScreenTitle();
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
    !iosBillingRestricted && currentTier != null
      ? planPriceLabel(currentTier)
      : !iosBillingRestricted && isPaid
        ? null
        : !iosBillingRestricted
          ? planPriceLabel('free')
          : null;

  const openWebBilling = async () => {
    setError(null);
    setBusy('web');
    try {
      const configError = validateBillingWebConfig();
      if (configError) {
        setError(configError);
        return;
      }
      const theme = colorScheme === 'light' ? 'light' : 'dark';
      const url = await createWebBillingHandoffUrl(WEB_SETTINGS_BILLING_PATH, theme);
      if (!url) {
        setError('Web app URL is not configured for this build.');
        return;
      }
      billingLog.debug('openWebBilling', { urlPrefix: url.slice(0, 80) });
      await openExternalWebUrl(url);
    } catch (e) {
      billingLog.warn('openWebBilling.failed', {
        cause: e instanceof Error ? e.message : String(e),
      });
      setError(e instanceof Error ? e.message : 'Could not open browser');
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setError(null);
    setBusy('portal');
    try {
      const configError = validateBillingWebConfig();
      if (configError) {
        setError(configError);
        return;
      }
      const theme = colorScheme === 'light' ? 'light' : 'dark';
      const url = await createWebBillingPortalHandoffUrl(theme);
      if (!url) {
        setError('Web app URL is not configured for this build.');
        return;
      }
      billingLog.debug('openPortal', { urlPrefix: url.slice(0, 80) });
      await openExternalWebUrl(url);
    } catch (e) {
      billingLog.warn('openPortal.failed', {
        cause: e instanceof Error ? e.message : String(e),
      });
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
            <CardTitle>{screenTitle}</CardTitle>
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
          <CardTitle>{screenTitle}</CardTitle>
        </View>
        <CardDescription>
          {iosBillingRestricted
            ? IOS_PLAN_BILLING_DESCRIPTION
            : 'Subscriptions are billed through Stripe. Limits reset at the start of each UTC month.'}
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
          ) : iosBillingRestricted ? (
            <Text className="text-sm text-muted-foreground">{IOS_FREE_PLAN_HINT}</Text>
          ) : (
            <Text className="text-sm text-muted-foreground">
              Upgrade to {planPriceLabel('plus')} or {planPriceLabel('pro')} on the web app.
            </Text>
          )}
          {(isPaid || iosBillingRestricted) &&
          summary?.monthlyTokenLimit != null &&
          summary.monthlyTokenLimit > 0 ? (
            <Text className="text-xs text-muted-foreground pt-1">
              Your allowance: {formatTokensCompact(summary.monthlyTokenLimit)} AI tokens
              {summary.monthlyDocumentLimit != null && summary.monthlyDocumentLimit > 0
                ? ` · ${summary.monthlyDocumentLimit.toLocaleString('en-US')} documents`
                : ''}
              {summary.monthlyCheckpointLimit != null && summary.monthlyCheckpointLimit > 0
                ? ` · ${summary.monthlyCheckpointLimit.toLocaleString('en-US')} checkpoint AI runs`
                : ''}
              {summary.monthlyReportGenerationsLimit != null &&
              summary.monthlyReportGenerationsLimit > 0
                ? ` · ${summary.monthlyReportGenerationsLimit.toLocaleString('en-US')} reports`
                : ''}{' '}
              per month
            </Text>
          ) : null}
          {!isPaid && iosBillingRestricted ? (
            <Text className="text-xs text-muted-foreground pt-1">
              Free plan includes monthly AI, document, checkpoint, and report limits. Open AI usage
              under Settings to see your consumption.
            </Text>
          ) : null}
        </View>

        {!iosBillingRestricted ? (
          <View className="gap-2">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isPaid ? 'Available plans' : 'Plans'}
            </Text>
            {PLAN_TIER_ORDER.map((tier) => (
              <PlanOptionRow
                key={tier}
                tier={tier}
                showPrice
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
        ) : null}

        {error ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {!iosBillingRestricted && !isPaid ? (
          <Button className="w-full" disabled={busy != null} onPress={() => void openWebBilling()}>
            <Text className="font-semibold text-primary-foreground">
              {busy === 'web' ? 'Opening…' : 'Upgrade to Plus or Pro on web'}
            </Text>
          </Button>
        ) : null}

        {!iosBillingRestricted && isPaid && hasStripeCustomer ? (
          <Button className="w-full" disabled={busy != null} onPress={() => void openPortal()}>
            <Text className="font-semibold text-primary-foreground">
              {busy === 'portal' ? 'Opening billing…' : 'Manage subscription'}
            </Text>
          </Button>
        ) : null}

        {!iosBillingRestricted && isPaid ? (
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

        {!iosBillingRestricted ? (
          <Text className="text-xs leading-snug text-muted-foreground">
            {!isPaid
              ? 'Checkout runs in your browser with the same account. '
              : 'Change plan, payment method, or cancel in Stripe. '}
            Plan changes are handled securely in Stripe.
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
