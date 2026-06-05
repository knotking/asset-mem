import { increment, serverTimestamp, Timestamp, type FieldValue } from 'firebase/firestore';
import type { Session } from '../types';

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

/** Newest activity first — last message, then session start, then draft doc creation. */
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

/** Subtitle for session list rows when the session has user messages. */
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

/** Client clock for startedAt so session list sort is stable before server ack. */
export function clientStartedAtTimestamp(): Timestamp {
  return Timestamp.fromDate(new Date());
}

/** One ms after `base` so paired assistant rows sort and display after the user turn. */
export function clientMessageTimestampAfter(base: Timestamp): Timestamp {
  return Timestamp.fromMillis(base.toMillis() + 1);
}

/** Firestore fields to bump when the user sends a message. */
export function sessionActivityOnUserMessagePatch(): SessionActivityPatch {
  return {
    lastMessageAt: serverTimestamp(),
    messageCount: increment(1),
  };
}
