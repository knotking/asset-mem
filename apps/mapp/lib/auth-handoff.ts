/**
 * One-time auth handoff so the mobile browser opens the web app as the same Firebase user.
 */

import Constants from 'expo-constants';
import { proxyFetchWithAuth } from '@homeapp/common/lib/correlation-id';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';
import {
  WEB_APP_URL,
  WEB_SETTINGS_BILLING_PATH,
  WEB_SETTINGS_BILLING_PORTAL_PATH,
} from '@/lib/api';

const extra = Constants.expoConfig?.extra ?? {};
const MOBILE_WEB_HANDOFF_URL =
  (extra.mobileWebHandoffUrl as string | undefined) ?? '';

const HANDOFF_WEB_PATH = '/auth/handoff';

async function postHandoffJson(
  url: string,
  body: Record<string, unknown>,
  withAuth: boolean,
): Promise<{ code?: string; customToken?: string; returnPath?: string }> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
  const res = withAuth
    ? await proxyFetchWithAuth(url, getFirebaseIdTokenForProxy, init)
    : await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || res.statusText);
  }
  try {
    return JSON.parse(text) as {
      code?: string;
      customToken?: string;
      returnPath?: string;
    };
  } catch {
    throw new Error('Invalid JSON from auth handoff API');
  }
}

/** Create a one-time code; final destination after sign-in (default Plan & billing). */
export async function createMobileWebHandoffCode(
  returnPath: string = WEB_SETTINGS_BILLING_PATH,
): Promise<string> {
  if (!MOBILE_WEB_HANDOFF_URL) {
    throw new Error('Mobile web handoff URL is not configured');
  }
  const data = await postHandoffJson(
    MOBILE_WEB_HANDOFF_URL,
    { returnPath },
    true,
  );
  if (!data.code) {
    throw new Error('Handoff did not return a code');
  }
  return data.code;
}

/** Relative path for Stripe portal return — completes handoff then opens billing settings. */
export async function buildPortalHandoffReturnPath(
  destinationPath: string = WEB_SETTINGS_BILLING_PATH,
  theme?: 'light' | 'dark',
): Promise<string> {
  const code = await createMobileWebHandoffCode(appendThemeQuery(destinationPath, theme));
  const handoffTheme = theme ? `&theme=${theme}` : '';
  return `${HANDOFF_WEB_PATH}?code=${encodeURIComponent(code)}${handoffTheme}`;
}

/** Handoff into web billing, then auto-open Stripe Customer Portal (Manage subscription). */
export async function createWebBillingPortalHandoffUrl(
  theme?: 'light' | 'dark',
): Promise<string> {
  return createWebBillingHandoffUrl(WEB_SETTINGS_BILLING_PORTAL_PATH, theme);
}

function appendThemeQuery(path: string, theme?: 'light' | 'dark'): string {
  if (!theme) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}theme=${theme}`;
}

/** Full web URL that signs in the mobile user, then opens billing settings. */
export async function createWebBillingHandoffUrl(
  destinationPath: string = WEB_SETTINGS_BILLING_PATH,
  theme?: 'light' | 'dark',
): Promise<string> {
  const base = (WEB_APP_URL || '').replace(/\/$/, '');
  if (!base) {
    return '';
  }
  const code = await createMobileWebHandoffCode(appendThemeQuery(destinationPath, theme));
  const handoffTheme = theme ? `&theme=${theme}` : '';
  return `${base}${HANDOFF_WEB_PATH}?code=${encodeURIComponent(code)}${handoffTheme}`;
}
