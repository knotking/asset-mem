import type { Session } from '@asset-mem/common/types';

/** In-memory sessions for list performance / scale tests (not Firestore-backed). */
export function generateMockSessions(count: number): Session[] {
  const result: Session[] = [];
  const baseDate = new Date();
  for (let i = 0; i < count; i++) {
    result.push({
      id: `mock-session-${i}`,
      name: `Mock Chat Session #${i}: Checking property maintenance issues and scheduling repairs`,
      createdAt: { toDate: () => new Date(baseDate.getTime() - i * 30 * 60000) } as Session['createdAt'],
      lastMessageAt: {
        toDate: () => new Date(baseDate.getTime() - i * 15 * 60000),
      } as Session['lastMessageAt'],
      messageCount: (i % 5) + 1,
      propertyId: 'mock-property',
    });
  }
  return result;
}
