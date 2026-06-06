import { Timestamp } from 'firebase/firestore';
import type { Message } from '../src/types';
import {
  clientMessageTimestampAfter,
  clientStartedAtTimestamp,
} from '../src/lib/session-timestamps';
import {
  getActiveStreamingAssistantMessageId,
  hasUserMessageBefore,
  sortMessagesChronologically,
} from '../src/lib/sort-messages';

const t = new Date('2026-01-15T12:00:00.000Z');

function msg(id: string, role: Message['role'], createdAt?: Message['createdAt']): Message {
  return { id, role, content: '', createdAt };
}

describe('sortMessagesChronologically', () => {
  it('places user before assistant when createdAt ties', () => {
    const input = [
      msg('assistant', 'assistant', t),
      msg('user', 'user', t),
    ];
    const sorted = sortMessagesChronologically(input);
    expect(sorted.map((m) => m.id)).toEqual(['user', 'assistant']);
  });

  it('preserves chronological order when timestamps differ', () => {
    const earlier = new Date(t.getTime() - 1000);
    const input = [
      msg('assistant', 'assistant', t),
      msg('user', 'user', earlier),
    ];
    const sorted = sortMessagesChronologically(input);
    expect(sorted.map((m) => m.id)).toEqual(['user', 'assistant']);
  });

  it('returns same array reference for single message', () => {
    const input = [msg('user', 'user', t)];
    expect(sortMessagesChronologically(input)).toBe(input);
  });
});

describe('clientMessageTimestampAfter', () => {
  it('is one millisecond after the user timestamp', () => {
    const userCreatedAt = clientStartedAtTimestamp();
    const assistantCreatedAt = clientMessageTimestampAfter(userCreatedAt);
    expect(assistantCreatedAt.toMillis()).toBe(userCreatedAt.toMillis() + 1);
  });

  it('sorts user before assistant when paired on send', () => {
    const userCreatedAt = Timestamp.fromDate(new Date('2026-01-15T12:00:00.000Z'));
    const assistantCreatedAt = clientMessageTimestampAfter(userCreatedAt);
    const sorted = sortMessagesChronologically([
      msg('assistant', 'assistant', assistantCreatedAt),
      msg('user', 'user', userCreatedAt),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['user', 'assistant']);
  });
});

describe('hasUserMessageBefore', () => {
  const thread = [
    msg('assistant', 'assistant', t),
    msg('user', 'user', t),
  ];

  it('is false when assistant is first with no prior user', () => {
    expect(hasUserMessageBefore(thread, 0)).toBe(false);
  });

  it('is true when a user message precedes the index', () => {
    expect(hasUserMessageBefore(thread, 1)).toBe(false);
    expect(
      hasUserMessageBefore(
        [msg('user', 'user', t), msg('assistant', 'assistant', t)],
        1,
      ),
    ).toBe(true);
  });
});

describe('getActiveStreamingAssistantMessageId', () => {
  const thread = [
    msg('user', 'user', t),
    msg('assistant', 'assistant', t),
  ];

  it('returns null when stream is not active and assistant is complete', () => {
    expect(
      getActiveStreamingAssistantMessageId(
        [
          ...thread,
          {
            ...thread[1],
            contentMarkdown: 'Done',
          },
        ],
        false
      )
    ).toBeNull();
  });

  it('returns last assistant after a user message while stream is active', () => {
    expect(getActiveStreamingAssistantMessageId(thread, true)).toBe('assistant');
  });

  it('observes in-flight assistant from Firestore when local stream is inactive', () => {
    const assistant: Message = {
      ...msg('assistant', 'assistant', t),
      agentSteps: [{ name: 'run_checkpoint_pipeline', status: 'executing' }],
    };
    expect(
      getActiveStreamingAssistantMessageId(
        [msg('user', 'user', t), assistant],
        false
      )
    ).toBe('assistant');
  });

  it('observes empty assistant shell on passive client before lifecycle lands', () => {
    expect(
      getActiveStreamingAssistantMessageId(
        [msg('user', 'user', t), msg('assistant', 'assistant', t)],
        false
      )
    ).toBe('assistant');
  });

  it('observes pipeline progress on passive client after structured content lands', () => {
    const assistant: Message = {
      ...msg('assistant', 'assistant', t),
      contentJson: {
        analysis: {
          checkpointSummary: { checkpointsAnalyzed: 1 },
          analysisStatus: { coverage: 'running' },
        },
      } as Message['contentJson'],
    };
    expect(
      getActiveStreamingAssistantMessageId(
        [msg('user', 'user', t), assistant],
        false
      )
    ).toBe('assistant');
  });
});
