/** B2B enterprise — landing contact emails. Keep in sync with apps/webapp/src/lib/enterprise-config.ts */

import Constants from 'expo-constants';

export const ENTERPRISE_EMAIL_REMOTE_PARAM = 'enterprise_email';
export const SUPPORT_EMAIL_REMOTE_PARAM = 'support_email';
export const DEFAULT_SUPPORT_EMAIL = 'hello@asset-mem.com';

export type EnterpriseConfig = {
  enterpriseEmail: string;
  supportEmail: string;
};

type ExpoExtra = {
  supportEmail?: string;
  enterpriseEmail?: string;
};

/** Sync defaults from expo.extra (first paint before Remote Config fetch). */
export function getEnterpriseConfigFromEnv(): EnterpriseConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
  const supportEmail = extra.supportEmail?.trim() || DEFAULT_SUPPORT_EMAIL;
  const enterpriseEmail = extra.enterpriseEmail?.trim();
  return {
    enterpriseEmail: enterpriseEmail || supportEmail || DEFAULT_SUPPORT_EMAIL,
    supportEmail,
  };
}

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
  const subject = encodeURIComponent('AssetMem AI — team inquiry');
  const body = encodeURIComponent(ENTERPRISE_INQUIRY_EMAIL_BODY);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
