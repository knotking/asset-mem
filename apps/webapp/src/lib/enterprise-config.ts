/** B2B enterprise — landing CTAs and external form. */

/** Firebase Remote Config keys (legacy param names kept for deployed config). */
export const ENTERPRISE_FORM_URL_REMOTE_PARAM = "pilot_form_url";
export const ENTERPRISE_EMAIL_REMOTE_PARAM = "pilots_email";

export type EnterpriseConfig = {
  formUrl: string | undefined;
  enterpriseEmail: string;
};

/** Sync defaults from env (SSR / first paint before Remote Config fetch). */
export function getEnterpriseConfigFromEnv(): EnterpriseConfig {
  const formUrl = process.env.NEXT_PUBLIC_PILOT_FORM_URL?.trim();
  return {
    formUrl: formUrl || undefined,
    enterpriseEmail:
      process.env.NEXT_PUBLIC_PILOTS_EMAIL?.trim() ||
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
      "support@asset-mem.com",
  };
}

export function getEnterpriseMailtoHref(enterpriseEmail: string): string {
  const subject = encodeURIComponent("AssetMem AI — team inquiry");
  return `mailto:${enterpriseEmail}?subject=${subject}`;
}

/** True when the URL is likely safe to embed in an iframe (Tally, Typeform). */
export function isEmbeddableEnterpriseFormUrl(url: string): boolean {
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
