/** B2B enterprise — landing contact emails. */

/** Firebase Remote Config keys. */
export const ENTERPRISE_EMAIL_REMOTE_PARAM = "enterprise_email";
export const SUPPORT_EMAIL_REMOTE_PARAM = "support_email";
export const DEFAULT_SUPPORT_EMAIL = "support@buildgeek.ai";

export type EnterpriseConfig = {
  enterpriseEmail: string;
  supportEmail: string;
};

/** Sync defaults from env (SSR / first paint before Remote Config fetch). */
export function getEnterpriseConfigFromEnv(): EnterpriseConfig {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;
  const enterpriseEmail = process.env.NEXT_PUBLIC_ENTERPRISE_EMAIL?.trim();
  return {
    enterpriseEmail: enterpriseEmail || supportEmail || DEFAULT_SUPPORT_EMAIL,
    supportEmail,
  };
}

/** Plain-text template shown in the user's mail client (mailto body). */
export const ENTERPRISE_INQUIRY_EMAIL_BODY = `Hi AssetMem team,

I'd like to learn more about AssetMem for our organization.

Full name:
Work email:
Company:
Role / title:
Organization type: (Property managers / Insurers & adjusters / Service & field teams / Prop-tech / Other)
Portfolio / property count: (1–10 / 11–50 / 51–200 / 200+)
Primary use case:

Timeline (optional): (ASAP / 1–3 months / 3–6 months / Just exploring)

Thanks!`;

export function getEnterpriseMailtoHref(enterpriseEmail: string): string {
  const email = enterpriseEmail?.trim() || DEFAULT_SUPPORT_EMAIL;
  const subject = encodeURIComponent("AssetMem AI — team inquiry");
  const body = encodeURIComponent(ENTERPRISE_INQUIRY_EMAIL_BODY);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
