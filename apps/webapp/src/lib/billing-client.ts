/**
 * Shared Stripe B2C Checkout / Portal calls (Bearer Firebase ID token).
 * Checkout uses tier names; the proxy maps tiers → Stripe Price ids from STRIPE_B2C_PRICE_TOKEN_CAPS_JSON.
 */

import { apiUrls } from "./utils";

export type BillingCheckoutTier = "plus" | "pro";

export async function postBillingJson(
  url: string,
  idToken: string,
  body: Record<string, unknown>,
): Promise<{ url?: string; sessionId?: string; status?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || res.statusText);
  }
  try {
    return JSON.parse(text) as { url?: string; sessionId?: string; status?: string };
  } catch {
    throw new Error("Invalid JSON from billing API");
  }
}

export async function createCheckoutRedirectUrl(
  idToken: string,
  tier: BillingCheckoutTier,
): Promise<string> {
  const data = await postBillingJson(apiUrls.billingB2cCheckout(), idToken, {
    tier,
  });
  if (!data.url) {
    throw new Error("Checkout did not return a redirect URL");
  }
  return data.url;
}

export async function createPortalRedirectUrl(
  idToken: string,
  returnPath = "/home/settings",
): Promise<string> {
  const data = await postBillingJson(apiUrls.billingB2cPortal(), idToken, {
    returnPath,
  });
  if (!data.url) {
    throw new Error("Portal did not return a URL");
  }
  return data.url;
}
