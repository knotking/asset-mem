import {
  createCheckoutRedirectUrl,
  type BillingCheckoutTier,
} from '@/lib/billing-client';

const CHECKOUT_QUERY = 'checkout';

type FirebaseUserWithToken = { getIdToken: () => Promise<string> };

export function isBillingCheckoutTier(
  value: string | null | undefined,
): value is BillingCheckoutTier {
  return value === 'plus' || value === 'pro';
}

/** Path for auth from the landing pricing section (login preserves tier for signup link). */
export function authPathForCheckoutTier(tier: BillingCheckoutTier): string {
  return `/login?${CHECKOUT_QUERY}=${tier}`;
}

/** Where to send the user after sign-in when not going straight to Stripe Checkout. */
export function postAuthRedirectPath(): string {
  return '/home';
}

/** After auth from ?checkout=plus|pro — open Stripe without visiting Settings first. */
export async function completeAuthThenStripeCheckout(
  user: FirebaseUserWithToken,
  tier: BillingCheckoutTier,
): Promise<void> {
  const token = await user.getIdToken();
  window.location.replace(await createCheckoutRedirectUrl(token, tier));
}
