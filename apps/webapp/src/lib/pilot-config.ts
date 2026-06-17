/** B2B pilot program — landing CTAs and external form. */

export const PILOT_FORM_URL_PARAM = "pilot_form_url";
export const PILOTS_EMAIL_PARAM = "pilots_email";

export type PilotConfig = {
  formUrl: string | undefined;
  pilotsEmail: string;
};

/** Sync defaults from env (SSR / first paint before Remote Config fetch). */
export function getPilotConfigFromEnv(): PilotConfig {
  const formUrl = process.env.NEXT_PUBLIC_PILOT_FORM_URL?.trim();
  return {
    formUrl: formUrl || undefined,
    pilotsEmail:
      process.env.NEXT_PUBLIC_PILOTS_EMAIL?.trim() ||
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
      "support@asset-mem.com",
  };
}

export function getPilotMailtoHref(pilotsEmail: string): string {
  const subject = encodeURIComponent("AssetMem AI — team inquiry");
  return `mailto:${pilotsEmail}?subject=${subject}`;
}

/** True when the URL is likely safe to embed in an iframe (Tally, Typeform). */
export function isEmbeddablePilotFormUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith("tally.so") ||
      host.endsWith("typeform.com") ||
      host.endsWith("fillout.com")
    );
  } catch {
    return false;
  }
}
