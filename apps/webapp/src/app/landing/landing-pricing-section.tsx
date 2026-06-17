"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import {
  createCheckoutRedirectUrl,
  createPortalRedirectUrl,
  type BillingCheckoutTier,
} from "@/lib/billing-client";
import {
  PlanPricingCards,
  type LandingPricingPalette,
} from "@/components/billing/plan-pricing-cards";
import {
  inferPlanTierFromLimits,
  type PlanTierKey,
} from "@/components/billing/plan-pricing-data";
import { trackEnterpriseCta } from "@/lib/analytics";

type BillingSummary = {
  subscriptionStatus?: string | null;
  monthlyTokenLimit?: number | null;
  stripeCustomerId?: string | null;
};

export function LandingPricingSection({
  colors: c,
}: {
  colors: LandingPricingPalette;
}) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [checkoutRedirectTier, setCheckoutRedirectTier] =
    useState<BillingCheckoutTier | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalActionTier, setPortalActionTier] = useState<PlanTierKey | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      return;
    }
    const ref = doc(db, "users", user.uid, "billing", "summary");
    return onSnapshot(ref, (snap) => {
      setSummary(snap.exists() ? (snap.data() as BillingSummary) : {});
    });
  }, [user]);

  const status = (summary?.subscriptionStatus || "").toLowerCase();
  const isPaid = status === "active" || status === "trialing";
  const hasStripeCustomer = Boolean(summary?.stripeCustomerId);

  const currentTier = useMemo(
    () => inferPlanTierFromLimits(summary?.monthlyTokenLimit, isPaid),
    [summary?.monthlyTokenLimit, isPaid],
  );

  const checkout = useCallback(
    async (tier: BillingCheckoutTier) => {
      if (!user) return;
      setError(null);
      setCheckoutRedirectTier(tier);
      try {
        const token = await user.getIdToken();
        const url = await createCheckoutRedirectUrl(token, tier);
        window.location.replace(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed");
        setCheckoutRedirectTier(null);
      }
    },
    [user],
  );

  const openPortal = useCallback(
    async (tier: PlanTierKey) => {
      if (!user) return;
      setError(null);
      setPortalBusy(true);
      setPortalActionTier(tier);
      try {
        const token = await user.getIdToken();
        window.location.replace(
          await createPortalRedirectUrl(token, "/"),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Portal failed");
        setPortalBusy(false);
        setPortalActionTier(null);
      }
    },
    [user],
  );

  return (
    <section
      id="pricing"
      className="py-28 relative overflow-hidden w-full scroll-mt-24"
      style={{ backgroundColor: c.background }}
    >
      <div
        className="absolute inset-0 w-full opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(34,211,238,0.08), transparent 45%), radial-gradient(circle at 80% 60%, rgba(249,115,22,0.06), transparent 40%)",
        }}
      />
      <div
        className="container relative mx-auto px-4"
        style={{ maxWidth: "1400px" }}
      >
        <div className="text-center mb-14 space-y-3">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border"
            style={{
              backgroundColor: c.primaryLight,
              borderColor: c.primaryBorder,
            }}
          >
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: c.primary }}
            >
              PRICING
            </span>
          </div>
          <h2
            className="text-4xl lg:text-5xl font-light tracking-tight"
            style={{ color: c.foreground }}
          >
            Individuals start free.
            <br />
            <span className="font-medium" style={{ color: c.foreground }}>
              Enterprise — talk to us.
            </span>
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto font-light"
            style={{ color: c.mutedForeground }}
          >
            Simple monthly billing for homeowners and landlords. Each plan
            includes AI chat, document uploads, photo analysis, and property
            reports—you can always see what you have left in Settings.
          </p>
        </div>

        <PlanPricingCards
          variant="landing"
          landingColors={c}
          currentTier={currentTier}
          isPaid={isPaid}
          checkoutRedirectTier={checkoutRedirectTier}
          checkoutError={error}
          onCheckout={checkout}
          portalActionTier={portalActionTier}
          portalBusy={portalBusy}
          onOpenPortal={
            user && isPaid && hasStripeCustomer ? openPortal : undefined
          }
          showPaidCheckout={Boolean(user) && !isPaid}
          showSignupOnFree={!user}
          showEnterprisePricing
          onEnterpriseCta={() => trackEnterpriseCta("team_cta_pricing_enterprise")}
        />
      </div>
    </section>
  );
}
