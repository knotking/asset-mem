import { deletionServiceUnavailable, resourceDeletionFailedLabel } from './ux-copy';

export const DELETION_ERROR_MAX_LENGTH = 500;

const PROXY_UNREACHABLE_PATTERNS = [
  /^failed to fetch$/i,
  /^network request failed$/i,
  /^load failed$/i,
  /networkerror/i,
  /^fetch failed$/i,
  /econnrefused/i,
  /err_connection_refused/i,
  /err_internet_disconnected/i,
];

export function isProxyUnreachableError(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  return PROXY_UNREACHABLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** User-facing delete error text (Firestore `deletionError`, toasts, alerts). */
export function formatDeletionErrorMessage(error: unknown): string {
  if (error == null) {
    return resourceDeletionFailedLabel;
  }

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : resourceDeletionFailedLabel;
  const trimmed = raw.trim();

  if (!trimmed || isProxyUnreachableError(trimmed) || /^status 50[234]$/.test(trimmed)) {
    return deletionServiceUnavailable;
  }

  return trimmed.slice(0, DELETION_ERROR_MAX_LENGTH);
}

export function deletionErrorLabel(stored?: string | null): string {
  return stored ? formatDeletionErrorMessage(stored) : resourceDeletionFailedLabel;
}

export function deletionHttpErrorMessage(status: number, body: string): string {
  if (status >= 502 && status <= 504) {
    return deletionServiceUnavailable;
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return `Delete failed (status ${status})`;
  }
  return formatDeletionErrorMessage(trimmed);
}
