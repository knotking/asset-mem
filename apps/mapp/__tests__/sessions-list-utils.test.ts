import {
  filterAndSortSessions,
  formatSessionDate,
  SESSIONS_LIST_FLAT_LIST_PROPS,
} from '@/lib/sessions-list-utils';
import { generateMockSessions } from './fixtures/sessions';

describe('sessions-list-utils', () => {
  describe('SESSIONS_LIST_FLAT_LIST_PROPS', () => {
    it('defines FlatList virtualization tuning', () => {
      expect(SESSIONS_LIST_FLAT_LIST_PROPS).toEqual({
        initialNumToRender: 10,
        maxToRenderPerBatch: 10,
        windowSize: 5,
        removeClippedSubviews: true,
      });
    });
  });

  describe('formatSessionDate', () => {
    it('formats Firestore-like timestamps', () => {
      const formatted = formatSessionDate({
        toDate: () => new Date('2024-06-15T12:00:00Z'),
      });
      expect(formatted).toMatch(/Jun/);
      expect(formatted).toMatch(/2024/);
    });

    it('returns empty string for missing timestamp', () => {
      expect(formatSessionDate(undefined)).toBe('');
    });
  });

  describe('filterAndSortSessions', () => {
    const sessions = generateMockSessions(500);

    it('returns all sessions when search is empty', () => {
      expect(filterAndSortSessions(sessions, '')).toHaveLength(500);
    });

    it('filters by session name (case insensitive)', () => {
      const filtered = filterAndSortSessions(sessions, 'mock chat session #42:');
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('mock-session-42');
    });

    it('sorts by lastMessageAt descending', () => {
      const sorted = filterAndSortSessions(sessions, '');
      expect(sorted[0]?.id).toBe('mock-session-0');
      expect(sorted[sorted.length - 1]?.id).toBe('mock-session-499');
    });

    it('handles rapid search term updates without throwing', () => {
      let lastCount = 500;
      for (let step = 0; step < 10; step++) {
        const result = filterAndSortSessions(sessions, `mock search query step ${step}`);
        expect(result.length).toBeLessThanOrEqual(lastCount);
        lastCount = result.length;
      }
      expect(filterAndSortSessions(sessions, '')).toHaveLength(500);
    });
  });
});
