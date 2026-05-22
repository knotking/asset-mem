'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import {
  createCheckoutRedirectUrl,
  createPortalRedirectUrl,
  type BillingCheckoutTier,
} from '@/lib/billing-client';
import { PlanPricingCards } from '@/components/billing/plan-pricing-cards';
import {
  inferPlanTierFromLimits,
  PLAN_CARDS,
  type PlanTierKey,
} from '@/components/billing/plan-pricing-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type BillingSummary = {
  subscriptionStatus?: string | null;
  priceId?: string | null;
  monthlyTokenLimit?: number | null;
  monthlyDocumentLimit?: number | null;
  monthlyCheckpointLimit?: number | null;
  stripeCustomerId?: string | null;
};

type SubscriptionSettingsProps = {
  /** After sign-in from landing pricing (?subscribe=plus|pro), start Checkout once. */
  resumeCheckoutTier?: BillingCheckoutTier | null;
};

export function SubscriptionSettings({
  resumeCheckoutTier = null,
}: SubscriptionSettingsProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const resumeCheckoutStarted = useRef(false);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkoutRedirectTier, setCheckoutRedirectTier] =
    useState<BillingCheckoutTier | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalActionTier, setPortalActionTier] = useState<PlanTierKey | null>(null);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    const ref = doc(db, 'users', user.uid, 'billing', 'summary');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setSummary(snap.exists() ? (snap.data() as BillingSummary) : {});
        setSummaryLoading(false);
      },
      () => {
        setSummaryLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const startCheckout = useCallback(
    async (tier: BillingCheckoutTier) => {
      if (!user) return;
      setActionError(null);
      setCheckoutRedirectTier(tier);
      try {
        const token = await user.getIdToken();
        window.location.replace(await createCheckoutRedirectUrl(token, tier));
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Checkout failed');
        setCheckoutRedirectTier(null);
      }
    },
    [user],
  );

  const openPortal = useCallback(
    async (fromTier?: PlanTierKey) => {
      if (!user) return;
      setActionError(null);
      setPortalBusy(true);
      setPortalActionTier(fromTier ?? null);
      try {
        const token = await user.getIdToken();
        window.location.replace(await createPortalRedirectUrl(token, '/home/settings'));
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Portal failed');
        setPortalBusy(false);
        setPortalActionTier(null);
      }
    },
    [user],
  );

  const status = (summary?.subscriptionStatus || '').toLowerCase();
  const isPaid = status === 'active' || status === 'trialing';
  const hasStripeCustomer = Boolean(summary?.stripeCustomerId);

  const currentTier = useMemo(
    () => inferPlanTierFromLimits(summary?.monthlyTokenLimit, isPaid),
    [summary?.monthlyTokenLimit, isPaid],
  );

  const activePlanLabel = useMemo(() => {
    if (currentTier) return PLAN_CARDS[currentTier].name;
    return isPaid ? 'Paid plan' : PLAN_CARDS.free.name;
  }, [currentTier, isPaid]);

  const showPaidStatusDetails = !summaryLoading && isPaid;

  useEffect(() => {
    if (!user || !resumeCheckoutTier || resumeCheckoutStarted.current) return;
    resumeCheckoutStarted.current = true;
    router.replace('/home/settings');
    if (isPaid) return;
    void startCheckout(resumeCheckoutTier);
  }, [user, resumeCheckoutTier, isPaid, router, startCheckout]);

  if (authLoading || !user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Plan &amp; billing
        </CardTitle>
        <CardDescription>
          Choose a plan for your home. Billed monthly through Stripe; limits reset at the start of
          each UTC calendar month.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={cn(
            'relative rounded-md border bg-muted/30 px-3 py-2.5 text-sm transition-all duration-300',
            summaryLoading ? 'opacity-90' : 'opacity-100',
            showPaidStatusDetails && 'min-h-[8.5rem]',
          )}
        >
          {summaryLoading ? (
            <div
              className="flex items-center justify-between gap-2"
              aria-busy="true"
              aria-label="Loading subscription status"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Current plan</span>
                <Badge variant="default" className="text-sm">
                  {activePlanLabel}
                </Badge>
              </div>
              {showPaidStatusDetails && (
                <>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">Billing status</span>
                    <span className="text-sm font-medium capitalize">{status || 'active'}</span>
                  </div>
                  {summary?.monthlyTokenLimit != null && summary.monthlyTokenLimit > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Included AI tokens (per UTC month):{' '}
                      <span className="font-mono">
                        {summary.monthlyTokenLimit.toLocaleString('en-US')}
                      </span>
                    </p>
                  )}
                  {summary?.monthlyDocumentLimit != null && summary.monthlyDocumentLimit > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Document analyses / month:{' '}
                      <span className="font-mono">
                        {summary.monthlyDocumentLimit.toLocaleString('en-US')}
                      </span>
                    </p>
                  )}
                  {summary?.monthlyCheckpointLimit != null && summary.monthlyCheckpointLimit > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Checkpoint AI runs / month:{' '}
                      <span className="font-mono">
                        {summary.monthlyCheckpointLimit.toLocaleString('en-US')}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            summaryLoading || hasStripeCustomer ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            {summaryLoading ? (
              <div className="space-y-2" aria-hidden>
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-4 w-full max-w-lg" />
              </div>
            ) : hasStripeCustomer ? (
              <div className="animate-in fade-in duration-300">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={portalBusy || checkoutRedirectTier != null}
                  onClick={() => void openPortal()}
                >
                  {portalBusy && portalActionTier == null
                    ? 'Opening billing…'
                    : 'Manage billing'}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Update payment method, view invoices, cancel, or switch plans in the Stripe customer
                  portal.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            'transition-opacity duration-300',
            summaryLoading ? 'opacity-60' : 'opacity-100',
          )}
        >
          <PlanPricingCards
            variant="settings"
            billingLoading={summaryLoading}
            currentTier={currentTier}
            isPaid={isPaid}
            checkoutRedirectTier={checkoutRedirectTier}
            checkoutError={actionError}
            onCheckout={startCheckout}
            portalActionTier={portalActionTier}
            portalBusy={portalBusy}
            onOpenPortal={
              isPaid && hasStripeCustomer ? (tier) => void openPortal(tier) : undefined
            }
            showPaidCheckout={!isPaid}
          />
        </div>
      </CardContent>
    </Card>
  );
}
