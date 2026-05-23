/** User-facing messages for mobile web auth handoff (proxy + Firebase). */

import { getAuthErrorMessage } from '@/lib/auth-errors';

const HANDOFF_DETAIL_MESSAGES: Record<string, string> = {
  'invalid or expired handoff code':
    'This sign-in link expired or was already used. Open billing from the mobile app again.',
  'invalid handoff code':
    'This sign-in link is not valid. Open billing from the mobile app again.',
  'invalid handoff payload':
    'This sign-in link is not valid. Open billing from the mobile app again.',
  'could not issue sign-in token':
    'We could not finish signing you in. Try again from the mobile app in a moment.',
  'handoff code expired':
    'This sign-in link expired. Open billing from the mobile app again.',
};

function mapHandoffDetail(detail: string, status?: number): string {
  const normalized = detail.trim().toLowerCase();
  for (const [key, message] of Object.entries(HANDOFF_DETAIL_MESSAGES)) {
    if (normalized.includes(key)) {
      return message;
    }
  }
  if (normalized.includes('expired')) {
    return 'This sign-in link expired. Open billing from the mobile app again.';
  }
  if (status === 401) {
    return 'This sign-in link expired or was already used. Open billing from the mobile app again.';
  }
  if (status === 503) {
    return 'Sign-in is temporarily unavailable. Try again from the mobile app in a moment.';
  }
  if (detail.length > 0 && detail.length <= 200 && !detail.startsWith('{')) {
    return detail;
  }
  return 'Could not sign in from the mobile app. Open billing from the app and try again.';
}

/** Parse FastAPI/proxy error bodies (`{"detail":"..."}`) into plain text. */
export function parseProxyErrorMessage(body: string, status?: number): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return mapHandoffDetail('', status);
  }

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        detail?: unknown;
        message?: unknown;
      };
      const detail = parsed.detail ?? parsed.message;
      if (typeof detail === 'string') {
        return mapHandoffDetail(detail, status);
      }
      if (Array.isArray(detail)) {
        const parts = detail
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              const row = item as { msg?: string; message?: string };
              return row.msg ?? row.message ?? '';
            }
            return '';
          })
          .filter(Boolean);
        if (parts.length > 0) {
          return mapHandoffDetail(parts.join(' '), status);
        }
      }
    } catch {
      // Fall through to generic handling.
    }
  }

  return mapHandoffDetail(trimmed, status);
}

export function getHandoffErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: string }).code);
    if (code.startsWith('auth/')) {
      return getAuthErrorMessage(
        code,
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.startsWith('{')) {
      return parseProxyErrorMessage(message);
    }
    if (message.length > 0 && message.length <= 200) {
      return message;
    }
  }

  return 'Could not sign in from the mobile app. Open billing from the app and try again.';
}
