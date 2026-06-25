import { Platform } from 'react-native';

/**
 * App Store Guideline 3.1.1: native iOS builds must not steer users to external
 * subscription checkout (Stripe / web). Android and web targets keep full billing UI.
 */
export function isIosAppStoreBillingRestricted(): boolean {
  return Platform.OS === 'ios';
}

/** User-facing settings label — iOS avoids "billing" (App Store 3.1.1). */
export function planSettingsScreenTitle(): string {
  return isIosAppStoreBillingRestricted() ? 'Plan & usage' : 'Plan & billing';
}

export type QuotaLimitKind = 'tokens' | 'documents' | 'checkpoints' | 'reports';

const IOS_QUOTA_MESSAGES: Record<QuotaLimitKind, string> = {
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
  return isIosAppStoreBillingRestricted() ? IOS_QUOTA_MESSAGES[kind] : DEFAULT_QUOTA_MESSAGES[kind];
}

/** Mapp quota copy — iOS-safe; use instead of @homeapp/common planLimitMessageForErrorCode. */
export function mappPlanLimitMessageForErrorCode(code: string | undefined): string | undefined {
  if (code === 'DOCUMENT_QUOTA_EXCEEDED') return monthlyQuotaExceededMessage('documents');
  if (code === 'CHECKPOINT_QUOTA_EXCEEDED') return monthlyQuotaExceededMessage('checkpoints');
  if (code === 'REPORT_QUOTA_EXCEEDED') return monthlyQuotaExceededMessage('reports');
  if (code === 'TOKEN_QUOTA_EXCEEDED') return monthlyQuotaExceededMessage('tokens');
  return undefined;
}

export const IOS_PLAN_BILLING_DESCRIPTION =
  'View your plan and monthly usage limits. Allowances reset at the start of each UTC month.';

export const IOS_FREE_PLAN_HINT =
  'You are on the Free plan. Subscribers who purchased on other platforms can sign in with the same account to access their plan.';

export const IOS_ACCOUNT_DELETION_BILLING_NOTE =
  'If you have an active subscription purchased outside this app, cancel it before deleting your account so charges do not continue.';

export const IOS_ACCOUNT_DELETION_DIALOG_BILLING =
  'This does not cancel a subscription purchased outside this app — cancel that subscription separately before deleting if needed.';

export const IOS_ACCOUNT_DELETION_DIALOG_BODY =
  'This removes your login and access to AssetMem AI right away. ' +
  `${IOS_ACCOUNT_DELETION_DIALOG_BILLING} ` +
  'Some property data may be kept for security, legal, or operational reasons until you request full erasure.';
