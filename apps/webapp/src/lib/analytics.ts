/**
 * Google Analytics (gtag) helpers and UTM persistence for launch attribution.
 * Loads only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 */

const UTM_STORAGE_KEY = 'homeapp_utm_params';
const FIRST_CHAT_KEY = 'analytics_first_chat_sent';
const FIRST_PROPERTY_KEY = 'analytics_first_property_created';

export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
};

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js',
      targetId: string | Date,
      params?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

export function getGaMeasurementId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id || undefined;
}

export function isAnalyticsEnabled(): boolean {
  return Boolean(getGaMeasurementId());
}

/** Persist UTM query params from the current URL (client-only). */
export function captureUtmFromSearchParams(search: string): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(search);
  const utm: UtmParams = {};
  for (const key of [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
  ] as const) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }
  if (Object.keys(utm).length === 0) return;
  try {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getStoredUtmParams(): UtmParams {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UtmParams;
  } catch {
    return {};
  }
}

function gtagEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  const measurementId = getGaMeasurementId();
  if (!measurementId) return;
  window.gtag('event', eventName, {
    ...getStoredUtmParams(),
    ...params,
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  gtagEvent(eventName, params);
}

export function trackLandingCta(label: string): void {
  trackEvent('landing_cta_click', { event_category: 'CTA', event_label: label });
}

export function trackSignUp(method: string = 'email'): void {
  trackEvent('sign_up', { method });
}

export function trackFirstPropertyCreated(): void {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(FIRST_PROPERTY_KEY)) return;
  sessionStorage.setItem(FIRST_PROPERTY_KEY, '1');
  trackEvent('first_property_created');
}

export function trackFirstChatMessage(): void {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(FIRST_CHAT_KEY)) return;
  sessionStorage.setItem(FIRST_CHAT_KEY, '1');
  trackEvent('first_chat_message');
}
