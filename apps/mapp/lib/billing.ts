/**
 * Stripe B2C Checkout / Portal via proxy (Firebase Bearer auth).
 */

import Constants from 'expo-constants';
import { proxyFetchWithAuth } from '@homeapp/common/lib/correlation-id';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';

const extra = Constants.expoConfig?.extra ?? {};

const BILLING_B2C_CHECKOUT_URL =
  (extra.billingB2cCheckoutUrl as string | undefined) ?? '';
const BILLING_B2C_PORTAL_URL =
  (extra.billingB2cPortalUrl as string | undefined) ?? '';

export type BillingCheckoutTier = 'plus' | 'pro';

async function postBillingJson(
  url: string,
  body: Record<string, unknown>,
): Promise<{ url?: string; sessionId?: string; status?: string }> {
  const res = await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || res.statusText);
  }
  try {
    return JSON.parse(text) as { url?: string; sessionId?: string; status?: string };
  } catch {
    throw new Error('Invalid JSON from billing API');
  }
}

export async function createCheckoutRedirectUrl(
  tier: BillingCheckoutTier,
): Promise<string> {
  if (!BILLING_B2C_CHECKOUT_URL) {
    throw new Error('Billing checkout URL is not configured');
  }
  const data = await postBillingJson(BILLING_B2C_CHECKOUT_URL, { tier });
  if (!data.url) {
    throw new Error('Checkout did not return a redirect URL');
  }
  return data.url;
}

export async function createPortalRedirectUrl(returnPath: string): Promise<string> {
  if (!BILLING_B2C_PORTAL_URL) {
    throw new Error('Billing portal URL is not configured');
  }
  const data = await postBillingJson(BILLING_B2C_PORTAL_URL, { returnPath });
  if (!data.url) {
    throw new Error('Portal did not return a URL');
  }
  return data.url;
}
