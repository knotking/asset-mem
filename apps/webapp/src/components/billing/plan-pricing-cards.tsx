"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { BillingCheckoutTier } from "@/lib/billing-client";
import { authPathForCheckoutTier } from "@/lib/pending-checkout";
import { formatPlanPriceUsd } from "@/lib/plan-limits-public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PLAN_CARDS,
  PLAN_TIER_ORDER,
  paidPortalActionLabel,
  type PlanTierKey,
  planLimitBullets,
} from "./plan-pricing-data";

export type LandingPricingPalette = {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryBorder: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  card: string;
  muted30: string;
  background: string;
};

const STRIPE_PORTAL_HELPER =
  "Plan changes and cancellation are handled securely in Stripe.";

type PlanPricingCardsProps = {
  variant: "landing" | "settings";
  landingColors?: LandingPricingPalette;
  currentTier?: PlanTierKey | null;
  isPaid?: boolean;
  checkoutRedirectTier?: BillingCheckoutTier | null;
  checkoutError?: string | null;
  onCheckout?: (tier: BillingCheckoutTier) => void;
  portalActionTier?: PlanTierKey | null;
  portalBusy?: boolean;
  onOpenPortal?: (tier: PlanTierKey) => void;
  /** Landing only: signed-in free user — show Checkout on paid tiers */
  showPaidCheckout?: boolean;
  /** Landing only: show sign-up link on free when logged out */
  showSignupOnFree?: boolean;
};

function portalButtonVariant(
  currentTier: PlanTierKey | null,
  targetTier: PlanTierKey,
): "default" | "outline" {
  if (targetTier === "free") {
    return "outline";
  }
  const current = currentTier ?? "free";
  if (targetTier === "pro" && (current === "free" || current === "plus")) {
    return "default";
  }
  return "outline";
}

function PlanCardActions({
  tier,
  variant,
  landingColors: c,
  currentTier,
  isPaid,
  checkoutRedirectTier,
  portalActionTier,
  portalBusy,
  onCheckout,
  onOpenPortal,
  showPaidCheckout,
  showSignupOnFree,
}: {
  tier: PlanTierKey;
  variant: "landing" | "settings";
  landingColors?: LandingPricingPalette;
  currentTier?: PlanTierKey | null;
  isPaid?: boolean;
  checkoutRedirectTier?: BillingCheckoutTier | null;
  portalActionTier?: PlanTierKey | null;
  portalBusy?: boolean;
  onCheckout?: (tier: BillingCheckoutTier) => void;
  onOpenPortal?: (tier: PlanTierKey) => void;
  showPaidCheckout?: boolean;
  showSignupOnFree?: boolean;
}) {
  const isCurrent = currentTier === tier;
  const card = PLAN_CARDS[tier];
  const checkoutInProgress = checkoutRedirectTier != null;
  const isRedirectingCheckout = checkoutRedirectTier === tier;
  const portalInProgress = portalBusy === true;
  const isOpeningPortal = portalActionTier === tier && portalInProgress;
  const actionsDisabled = checkoutInProgress || portalInProgress;

  if (tier === "free") {
    if (isCurrent && variant === "settings") {
      return (
        <Badge
          variant="secondary"
          className="flex min-h-10 w-full items-center justify-center py-1.5"
        >
          Current plan
        </Badge>
      );
    }
    if (variant === "landing" && showSignupOnFree) {
      return (
        <Link
          href="/signup"
          className="inline-flex justify-center items-center rounded-lg px-6 py-3 text-sm font-medium border transition-colors"
          style={
            c
              ? {
                  borderColor: c.border,
                  color: c.foreground,
                  backgroundColor: c.muted30,
                }
              : undefined
          }
        >
          Start free
        </Link>
      );
    }
    if (variant === "settings" && !isPaid) {
      return (
        <Badge
          variant="outline"
          className="flex min-h-10 w-full items-center justify-center py-1.5"
        >
          Current plan
        </Badge>
      );
    }
    if (isPaid) {
      return (
        <p
          className={cn(
            "text-center text-xs leading-snug",
            variant === "settings" ? "text-muted-foreground" : "",
          )}
          style={
            variant === "landing" && c
              ? { color: c.mutedForeground }
              : undefined
          }
        >
          {variant === "settings"
            ? "Free limits apply when your paid subscription ends. Cancel or change plans using Manage billing above."
            : "Free limits apply when your paid subscription ends. Manage plans in Settings → Plan & billing."}
        </p>
      );
    }
    return null;
  }

  if (isCurrent) {
    return (
      <Badge
        variant={variant === "settings" ? "default" : "secondary"}
        className="flex min-h-10 w-full items-center justify-center py-1.5"
      >
        Current plan
      </Badge>
    );
  }

  if (isPaid && onOpenPortal) {
    const label = paidPortalActionLabel(currentTier ?? null, tier);
    const btnVariant = portalButtonVariant(currentTier ?? null, tier);

    if (variant === "landing" && c) {
      const isUpgrade = btnVariant === "default";
      return (
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={() => onOpenPortal(tier)}
          className="inline-flex w-full justify-center items-center rounded-lg px-6 py-3 text-sm font-medium transition-colors disabled:opacity-50"
          style={
            isUpgrade
              ? { backgroundColor: c.primary, color: "#0a0a0f" }
              : {
                  borderColor: c.border,
                  color: c.foreground,
                  backgroundColor: c.muted30,
                  borderWidth: 1,
                  borderStyle: "solid",
                }
          }
        >
          {isOpeningPortal ? "Opening billing…" : label}
        </button>
      );
    }

    return (
      <Button
        type="button"
        variant={btnVariant}
        className="w-full"
        disabled={actionsDisabled}
        onClick={() => onOpenPortal(tier)}
      >
        {isOpeningPortal ? "Opening billing…" : label}
      </Button>
    );
  }

  const canCheckout = variant === "settings" || showPaidCheckout;

  if (variant === "landing" && !showPaidCheckout && c) {
    const authHref =
      tier === "plus" || tier === "pro"
        ? authPathForCheckoutTier(tier)
        : "/signup";
    return (
      <Link
        href={authHref}
        className="inline-flex justify-center items-center rounded-lg px-6 py-3 text-sm font-medium transition-colors w-full"
        style={{
          backgroundColor: c.primary,
          color: "#0a0a0f",
        }}
      >
        {tier === "plus" || tier === "pro" ? `Get ${card.name}` : "Start free"}
      </Link>
    );
  }

  if (!canCheckout || !onCheckout || (tier !== "plus" && tier !== "pro")) {
    return null;
  }

  if (variant === "landing" && c) {
    return (
      <button
        type="button"
        disabled={actionsDisabled}
        onClick={() => onCheckout(tier)}
        className="inline-flex justify-center items-center rounded-lg px-6 py-3 text-sm font-medium transition-colors disabled:opacity-50 w-full"
        style={{
          backgroundColor: c.primary,
          color: "#0a0a0f",
        }}
        onMouseEnter={(e) => {
          if (!actionsDisabled)
            e.currentTarget.style.backgroundColor = c.primaryHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = c.primary;
        }}
      >
        {isRedirectingCheckout ? "Processing…" : `Get ${card.name}`}
      </button>
    );
  }

  return (
    <Button
      type="button"
      className="w-full"
      disabled={actionsDisabled}
      onClick={() => onCheckout(tier)}
    >
      {isRedirectingCheckout ? "Processing…" : `Get ${card.name}`}
    </Button>
  );
}

export function PlanPricingCards({
  variant,
  landingColors: c,
  currentTier = null,
  isPaid = false,
  checkoutRedirectTier = null,
  checkoutError = null,
  onCheckout,
  portalActionTier = null,
  portalBusy = false,
  onOpenPortal,
  showPaidCheckout = false,
  showSignupOnFree = false,
}: PlanPricingCardsProps) {
  return (
    <div className="space-y-4">
      {checkoutError && (
        <p
          className={cn(
            "text-sm rounded-md px-4 py-2",
            variant === "settings"
              ? "text-destructive bg-destructive/10"
              : "text-center max-w-xl mx-auto",
          )}
          style={
            variant === "landing"
              ? { backgroundColor: "rgba(239,68,68,0.12)", color: "#fecaca" }
              : undefined
          }
          role="alert"
        >
          {checkoutError}
        </p>
      )}

      <div
        className={cn(
          "grid gap-6 items-stretch",
          variant === "settings"
            ? "md:grid-cols-3"
            : "md:grid-cols-3 max-w-5xl mx-auto",
        )}
      >
        {PLAN_TIER_ORDER.map((tier) => {
          const card = PLAN_CARDS[tier];
          const isLanding = variant === "landing" && c;
          const isCurrent = currentTier === tier;
          const usePortalFooter = Boolean(isPaid && onOpenPortal);
          const actionSlotMinH = usePortalFooter
            ? "min-h-[5.5rem]"
            : "min-h-10";

          return (
            <div
              key={tier}
              className={cn(
                "relative flex h-full flex-col rounded-2xl border p-6 md:p-8 transition-transform duration-300",
                variant === "landing" && "hover:-translate-y-0.5",
                variant === "settings" && "bg-card",
                currentTier === tier &&
                  variant === "settings" &&
                  "ring-2 ring-primary",
              )}
              style={
                isLanding
                  ? {
                      backgroundColor: c.card,
                      borderColor: card.highlight ? c.primaryBorder : c.border,
                      boxShadow: card.highlight
                        ? `0 0 0 1px ${c.primaryBorder}`
                        : undefined,
                    }
                  : undefined
              }
            >
              {card.highlight && variant !== "settings" && (
                <div
                  className={cn(
                    "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold",
                  )}
                  style={
                    isLanding
                      ? { backgroundColor: c.primary, color: "#0a0a0f" }
                      : undefined
                  }
                >
                  Recommended
                </div>
              )}
              <h3
                className={cn(
                  "text-xl font-semibold mb-2",
                  variant === "settings" && "text-foreground",
                )}
                style={isLanding ? { color: c.foreground } : undefined}
              >
                {card.name}
              </h3>
              <div className="mb-3 flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-3xl font-semibold tracking-tight tabular-nums",
                    variant === "settings" && "text-foreground",
                  )}
                  style={isLanding ? { color: c.foreground } : undefined}
                >
                  {formatPlanPriceUsd(card.limits.pricePerMonthUsd)}
                </span>
                <span
                  className={cn(
                    "text-sm font-light",
                    variant === "settings" && "text-muted-foreground",
                  )}
                  style={isLanding ? { color: c.mutedForeground } : undefined}
                >
                  / month
                </span>
              </div>
              <p
                className={cn(
                  "text-sm mb-5 min-h-[40px]",
                  variant === "settings" && "text-muted-foreground",
                )}
                style={isLanding ? { color: c.mutedForeground } : undefined}
              >
                {card.blurb}
              </p>
              <ul
                className={cn(
                  "text-sm space-y-2 flex-1 min-h-0",
                  variant === "settings" && "text-muted-foreground",
                )}
                style={isLanding ? { color: c.mutedForeground } : undefined}
              >
                {planLimitBullets(card.limits, tier).map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        variant === "settings" && "text-primary",
                      )}
                      style={isLanding ? { color: c.primary } : undefined}
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
                {tier !== "free" && (
                  <li className="flex gap-2">
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        variant === "settings" && "text-primary",
                      )}
                      style={isLanding ? { color: c.primary } : undefined}
                      aria-hidden
                    />
                    <span>Cancel anytime via the billing portal</span>
                  </li>
                )}
              </ul>
              <div className="mt-auto w-full shrink-0 pt-6">
                <div
                  className={cn(
                    "flex flex-col justify-end gap-2",
                    actionSlotMinH,
                  )}
                >
                  <div className="flex min-h-10 w-full items-end">
                    <PlanCardActions
                      tier={tier}
                      variant={variant}
                      landingColors={c}
                      currentTier={currentTier}
                      isPaid={isPaid}
                      checkoutRedirectTier={checkoutRedirectTier}
                      portalActionTier={portalActionTier}
                      portalBusy={portalBusy}
                      onCheckout={onCheckout}
                      onOpenPortal={onOpenPortal}
                      showPaidCheckout={showPaidCheckout}
                      showSignupOnFree={showSignupOnFree}
                    />
                  </div>
                  {usePortalFooter ? (
                    <p
                      className={cn(
                        "text-center text-xs leading-snug",
                        isCurrent || tier === "free"
                          ? "invisible pointer-events-none select-none"
                          : variant === "settings"
                            ? "text-muted-foreground"
                            : "",
                      )}
                      style={
                        isLanding && !isCurrent && tier !== "free"
                          ? { color: c.mutedForeground }
                          : undefined
                      }
                      aria-hidden={isCurrent || tier === "free"}
                    >
                      {STRIPE_PORTAL_HELPER}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
