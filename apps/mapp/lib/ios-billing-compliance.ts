import { Platform } from 'react-native';
import { isIosIapRuntimeAvailable } from '@/lib/ios-iap-products';

/**
 * True when native StoreKit products are configured for this build.
 */
export function isIosIapAvailable(): boolean {
  return isIosIapRuntimeAvailable();
}

/**
 * External billing (Stripe / web checkout) must not be offered on iOS when IAP is available.
 * When IAP is unavailable, iOS stays read-only (legacy reader model).
 */
export function isIosExternalBillingRestricted(): boolean {
  return Platform.OS === 'ios';
}

/** @deprecated Use isIosExternalBillingRestricted — kept for call sites during migration. */
export function isIosAppStoreBillingRestricted(): boolean {
  return isIosExternalBillingRestricted() && !isIosIapAvailable();
}

/** User-facing settings label. */
export function planSettingsScreenTitle(): string {
  if (Platform.OS === 'ios' && isIosIapAvailable()) return 'Plan & billing';
  return isIosAppStoreBillingRestricted() ? 'Plan & usage' : 'Plan & billing';
}

export type QuotaLimitKind = 'tokens' | 'documents' | 'checkpoints' | 'reports';

const IOS_QUOTA_MESSAGES_NO_IAP: Record<QuotaLimitKind, string> = {
  tokens: "You've reached this month's AI usage allowance. Try again next month.",
  documents: "You've reached this month's document allowance. Try again next month.",
  checkpoints: "You've reached this month's checkpoint allowance. Try again next month.",
  reports: "You've reached this month's report allowance. Try again next month.",
};

const DEFAULT_QUOTA_MESSAGES: Record<QuotaLimitKind, string> = {
  tokens: 'Monthly AI token limit reached. Upgrade your plan or wait until next month.',
  documents: 'Monthly document limit reached. Upgrade your plan or wait until next month.',
  checkpoints: 'Monthly checkpoint limit reached. Upgrade your plan or wait until next month.',
  reports: 'Monthly report limit reached. Upgrade your plan or wait until next month.',
};

export function monthlyQuotaExceededMessage(kind: QuotaLimitKind): string {
  if (Platform.OS === 'ios' && !isIosIapAvailable()) {
    return IOS_QUOTA_MESSAGES_NO_IAP[kind];
  }
  return DEFAULT_QUOTA_MESSAGES[kind];
}

/** Mapp quota copy — iOS-safe when IAP unavailable; use instead of @homeapp/common planLimitMessageForErrorCode. */
export function mappPlanLimitMessageForErrorCode(code: string | undefined): string | undefined {
  if (code === 'DOCUMENT_QUOTA_EXCEEDED') return monthlyQuotaExceededMessage('documents');
  if (code === 'CHECKPOINT_QUOTA_EXCEEDED') return monthlyQuotaExceededMessage('checkpoints');
  if (code === 'REPORT_QUOTA_EXCEEDED') return monthlyQuotaExceededMessage('reports');
  if (code === 'TOKEN_QUOTA_EXCEEDED') return monthlyQuotaExceededMessage('tokens');
  return undefined;
}

export const IOS_PLAN_BILLING_DESCRIPTION =
  'View your plan and monthly usage limits. Allowances reset at the start of each UTC month.';

export const IOS_IAP_BILLING_DESCRIPTION =
  'Subscriptions are billed through your Apple ID. Limits reset at the start of each UTC month.';

export const IOS_FREE_PLAN_HINT =
  'You are on the Free plan. Subscribers who purchased on other platforms can sign in with the same account to access their plan.';

export const IOS_STRIPE_SUBSCRIBER_HINT =
  'Your subscription was purchased on the website. Manage billing on the web — Apple In-App Purchase is not available while that subscription is active.';

export const IOS_ACCOUNT_DELETION_BILLING_NOTE =
  'If you have an active subscription, cancel it before deleting your account so charges do not continue.';

export const IOS_ACCOUNT_DELETION_DIALOG_BILLING =
  'This does not cancel an active subscription — cancel your subscription in Apple Subscriptions or on the web before deleting if needed.';

export const IOS_ACCOUNT_DELETION_DIALOG_BODY =
  'This removes your login and access to AssetMem AI right away. ' +
  `${IOS_ACCOUNT_DELETION_DIALOG_BILLING} ` +
  'Some property data may be kept for security, legal, or operational reasons until you request full erasure.';
