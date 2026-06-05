import type { Session } from '@homeapp/common/types';
import {
  formatSessionDisplayDate,
  getSessionActivitySortTime,
  getSessionMessageCountLabel,
  getSessionSidebarActivityLabel,
} from '@homeapp/common/lib/session-timestamps';

export const SESSIONS_LIST_FLAT_LIST_PROPS = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
} as const;

/** @deprecated Use formatSessionDisplayDate from session-timestamps */
export function formatSessionDate(timestamp: unknown): string {
  return formatSessionDisplayDate(timestamp);
}

export { getSessionSidebarActivityLabel, getSessionMessageCountLabel };

/** Filter by session name and sort newest activity first. */
export function filterAndSortSessions(sessions: Session[], searchTerm: string): Session[] {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  const base = normalizedTerm
    ? sessions.filter((session) => session.name?.toLowerCase().includes(normalizedTerm))
    : sessions;

  return [...base].sort(
    (a, b) => getSessionActivitySortTime(b) - getSessionActivitySortTime(a)
  );
}
