/**
 * Session list timestamps — local copy for App Hosting (keep in sync with
 * apps/common/src/lib/session-timestamps.ts).
 */

import { increment, serverTimestamp, type FieldValue } from 'firebase/firestore';
import type { Session } from '@/lib/types';

export function getTimestampValue(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null) {
    if ('toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
      return (value as { toMillis: () => number }).toMillis();
    }
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      const date = (value as { toDate: () => Date }).toDate();
      return date instanceof Date ? date.getTime() : 0;
    }
  }
  return 0;
}

export function getSessionActivitySortTime(
  session: Pick<Session, 'lastMessageAt' | 'startedAt' | 'createdAt'>
): number {
  return getTimestampValue(session.lastMessageAt ?? session.startedAt ?? session.createdAt);
}

export function formatSessionDisplayDate(timestamp: unknown): string {
  if (!timestamp) return '';
  const date =
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toDate' in timestamp &&
    typeof (timestamp as { toDate: () => Date }).toDate === 'function'
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp as string | number | Date);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Subtitle for session list rows. Default names already embed start time (`session: …`). */
export function getSessionSidebarActivityLabel(
  session: Pick<Session, 'lastMessageAt'>
): string | null {
  return session.lastMessageAt
    ? `Last active: ${formatSessionDisplayDate(session.lastMessageAt)}`
    : null;
}

export function getSessionMessageCountLabel(
  session: Pick<Session, 'messageCount'>
): string | null {
  if (session.messageCount === undefined || session.messageCount <= 0) {
    return null;
  }
  return `${session.messageCount} message${session.messageCount !== 1 ? 's' : ''}`;
}

export type SessionActivityPatch = {
  lastMessageAt: FieldValue;
  messageCount: FieldValue;
};

export function sessionActivityOnUserMessagePatch(): SessionActivityPatch {
  return {
    lastMessageAt: serverTimestamp(),
    messageCount: increment(1),
  };
}
