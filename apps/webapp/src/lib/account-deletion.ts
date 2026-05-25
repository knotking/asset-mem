/**
 * Account-deletion copy — local for Firebase App Hosting (webapp does not depend on @homeapp/common).
 * Keep in sync with apps/common/src/lib/account-deletion.ts and /privacy, /account-deletion pages.
 */

export const ACCOUNT_DELETION_CARD_DESCRIPTION =
  'Deletes your sign-in and app access immediately. Property photos, documents, chat history, and billing records may remain for a limited period; email us for complete data removal.';

export const ACCOUNT_DELETION_DIALOG_BODY =
  'This removes your login and access to AssetMem AI right away. It does not cancel a paid subscription — use Plan & billing on the web first if you subscribe through Stripe. Some property data may be kept for security, legal, or operational reasons until you request full erasure.';

export const ACCOUNT_DELETION_REAUTH_MESSAGE =
  'For security, sign out, sign in again, then retry. Or email support for help deleting your account.';

export function fullDataErasureSupportLine(supportEmail: string): string {
  return `For complete deletion of stored property data, email ${supportEmail}.`;
}
