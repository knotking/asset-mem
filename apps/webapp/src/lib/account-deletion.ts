/**
 * Account-deletion copy — local for Firebase App Hosting (webapp does not depend on @asset-mem/common).
 * Keep in sync with apps/common/src/lib/account-deletion.ts and /privacy, /account-deletion pages.
 */

export const ACCOUNT_DELETION_CARD_DESCRIPTION =
  'Deletes your sign-in and app access immediately. Property photos, documents, chat history, and billing records may remain for a limited period; email us for complete data removal.';

export const ACCOUNT_DELETION_BILLING_NOTE =
  'Paid plans are billed through Stripe. Cancel in Plan & billing before deleting your account if you do not want charges to continue.';

export const ACCOUNT_DELETION_DIALOG_BODY =
  'This removes your login and access to AssetMem AI right away. It does not cancel a paid subscription — cancel in Plan & billing under Settings first if you subscribe through Stripe. Some property data may be kept for security, legal, or operational reasons until you request full erasure.';

export const ACCOUNT_DELETION_REAUTH_MESSAGE =
  'For security, sign out, sign in again, then retry. Or email support for help deleting your account.';

/** Prefix before the mailto link on account-deletion settings (email is rendered separately). */
export function fullDataErasureSupportLine(): string {
  return 'For complete deletion of stored property data, email';
}
