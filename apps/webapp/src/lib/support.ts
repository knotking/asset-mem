/**
 * Support mailto helpers — local copy for App Hosting (webapp does not depend on @homeapp/common).
 * Keep in sync with apps/common/src/lib/support.ts.
 */

export const DEFAULT_SUPPORT_EMAIL = 'support@homegeek.ai';

export type SupportRequestContext = {
  userId?: string | null;
  userEmail?: string | null;
  app?: 'web' | 'mobile';
  appEnv?: string | null;
};

/** Builds a mailto URL with subject and body (user message + account context). */
export function buildSupportMailtoUrl(
  supportEmail: string,
  message: string,
  ctx: SupportRequestContext = {}
): string {
  const trimmed = message.trim();
  const subject = encodeURIComponent('AssetMem AI support request');
  const bodyLines = [
    trimmed,
    '',
    '---',
    ctx.userEmail ? `Account: ${ctx.userEmail}` : null,
    ctx.userId ? `User ID: ${ctx.userId}` : null,
    ctx.app ? `App: ${ctx.app}` : null,
    ctx.appEnv ? `Environment: ${ctx.appEnv}` : null,
  ].filter((line): line is string => line != null && line.length > 0);
  const body = encodeURIComponent(bodyLines.join('\n'));
  const email = supportEmail.trim() || DEFAULT_SUPPORT_EMAIL;
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
