import type { Message } from '../src/types';
import {
  areMessagesEqual,
  mergeMessagesFromSnapshot,
} from '../src/lib/merge-messages-snapshot';

const baseTime = new Date('2026-01-15T12:00:00.000Z');

function userMessage(id: string, content: string): Message {
  return { id, role: 'user', content, createdAt: baseTime };
}

describe('mergeMessagesFromSnapshot', () => {
  it('returns loaded array when prev is empty', () => {
    const loaded = [userMessage('a', 'hello'), userMessage('b', 'world')];
    expect(mergeMessagesFromSnapshot([], loaded)).toBe(loaded);
  });

  it('preserves object identity for unchanged messages', () => {
    const prev = [userMessage('a', 'hello'), userMessage('b', 'world')];
    const loaded = [
      userMessage('a', 'hello'),
      { ...userMessage('b', 'world'), content: 'updated' },
    ];
    const merged = mergeMessagesFromSnapshot(prev, loaded);
    expect(merged[0]).toBe(prev[0]);
    expect(merged[1]).toBe(loaded[1]);
    expect(merged[1].content).toBe('updated');
  });

  it('appends new messages while keeping stable references for existing', () => {
    const prev = [userMessage('a', 'hello')];
    const loaded = [userMessage('a', 'hello'), userMessage('b', 'new')];
    const merged = mergeMessagesFromSnapshot(prev, loaded);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(prev[0]);
    expect(merged[1]).toBe(loaded[1]);
  });

  it('replaces message when contentMarkdown arrives without content change', () => {
    const prev: Message[] = [
      {
        id: 'assistant',
        role: 'assistant',
        content: '',
        createdAt: baseTime,
      },
    ];
    const loaded: Message[] = [
      {
        id: 'assistant',
        role: 'assistant',
        content: '',
        contentMarkdown: 'Hello from V2',
        createdAt: baseTime,
      },
    ];
    const merged = mergeMessagesFromSnapshot(prev, loaded);
    expect(merged[0]).toBe(loaded[0]);
    expect(merged[0].contentMarkdown).toBe('Hello from V2');
  });

  it('replaces message when contentJson arrives without content change', () => {
    const prev: Message[] = [
      {
        id: 'assistant',
        role: 'assistant',
        content: '',
        createdAt: baseTime,
      },
    ];
    const loaded: Message[] = [
      {
        id: 'assistant',
        role: 'assistant',
        content: '',
        contentJson: { analysis: { title: 'Done' } },
        createdAt: baseTime,
      },
    ];
    const merged = mergeMessagesFromSnapshot(prev, loaded);
    expect(merged[0]).toBe(loaded[0]);
    expect(merged[0].contentJson).toEqual({ analysis: { title: 'Done' } });
  });

  it('replaces message when agentSteps change', () => {
    const prev: Message[] = [
      {
        id: 'assistant',
        role: 'assistant',
        content: '',
        createdAt: baseTime,
        agentSteps: [{ name: 'property_agent', status: 'executing' }],
      },
    ];
    const loaded: Message[] = [
      {
        id: 'assistant',
        role: 'assistant',
        content: 'partial',
        createdAt: baseTime,
        agentSteps: [{ name: 'property_agent', status: 'executing' }],
      },
    ];
    const merged = mergeMessagesFromSnapshot(prev, loaded);
    expect(merged[0]).toBe(loaded[0]);
    expect(merged[0].content).toBe('partial');
  });
});

describe('areMessagesEqual', () => {
  it('returns true for same reference', () => {
    const msg = userMessage('a', 'hello');
    expect(areMessagesEqual(msg, msg)).toBe(true);
  });

  it('returns false when content differs', () => {
    const a = userMessage('a', 'hello');
    const b = userMessage('a', 'goodbye');
    expect(areMessagesEqual(a, b)).toBe(false);
  });
});
