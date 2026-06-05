import { resolveMessageContentParts } from '@/lib/message-content-parts';
import type { Message } from '@/lib/types';

function baseMessage(overrides: Partial<Message>): Message {
  return {
    id: 'msg-1',
    role: 'user',
    content: '',
    ...overrides,
  };
}

describe('resolveMessageContentParts', () => {
  it('prefers contentMarkdown when set', () => {
    const result = resolveMessageContentParts(
      baseMessage({
        content: 'legacy',
        contentMarkdown: 'canonical',
      }),
    );
    expect(result.markdown).toBe('canonical');
  });

  it('falls back to content for user messages without contentMarkdown', () => {
    const result = resolveMessageContentParts(
      baseMessage({
        role: 'user',
        content: 'What is the roof condition?',
      }),
    );
    expect(result.markdown).toBe('What is the roof condition?');
  });

  it('returns empty markdown when neither field has text', () => {
    const result = resolveMessageContentParts(
      baseMessage({ role: 'assistant', content: '' }),
    );
    expect(result.markdown).toBe('');
  });
});
