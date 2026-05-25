import type { Session } from '@homeapp/common/types';

export const SESSIONS_LIST_FLAT_LIST_PROPS = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
} as const;

export function formatSessionDate(timestamp: unknown): string {
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

function getTimestampValue(value: unknown): number {
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

/** Filter by session name and sort newest activity first. */
export function filterAndSortSessions(sessions: Session[], searchTerm: string): Session[] {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  const base = normalizedTerm
    ? sessions.filter((session) => session.name?.toLowerCase().includes(normalizedTerm))
    : sessions;

  return [...base].sort((a, b) => {
    const bTime = getTimestampValue(b.lastMessageAt ?? b.createdAt);
    const aTime = getTimestampValue(a.lastMessageAt ?? a.createdAt);
    return bTime - aTime;
  });
}
