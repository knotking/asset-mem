import type { Message } from '@homeapp/common/types';
import { areChatMessagePropsEqual } from '@/lib/chat-message-equal';
import { messageFixtures } from './fixtures/messages';

function chatMessageProps(message: Message, sessionId = 'session-1') {
  return { message, sessionId };
}

describe('areChatMessagePropsEqual', () => {
  it('returns true when message fields are unchanged', () => {
    const message = messageFixtures.partialAssistantMessage;
    expect(
      areChatMessagePropsEqual(
        chatMessageProps(message),
        chatMessageProps({ ...message })
      )
    ).toBe(true);
  });

  it('returns false when content changes', () => {
    const base = messageFixtures.partialAssistantMessage;
    const updated = { ...base, content: 'Updated content' };
    expect(areChatMessagePropsEqual(chatMessageProps(base), chatMessageProps(updated))).toBe(
      false
    );
  });

  it('returns false when agentSteps change', () => {
    expect(
      areChatMessagePropsEqual(
        chatMessageProps(messageFixtures.partialAssistantMessage),
        chatMessageProps(messageFixtures.streamingAssistantMessage)
      )
    ).toBe(false);
  });

  it('returns false when createdAt resolves', () => {
    const pending = { ...messageFixtures.userTextMessage, createdAt: undefined };
    expect(
      areChatMessagePropsEqual(
        chatMessageProps(pending),
        chatMessageProps(messageFixtures.userTextMessage)
      )
    ).toBe(false);
  });

  it('returns false when sessionId changes', () => {
    const message = messageFixtures.partialAssistantMessage;
    expect(
      areChatMessagePropsEqual(
        chatMessageProps(message, 'session-1'),
        chatMessageProps(message, 'session-2')
      )
    ).toBe(false);
  });

  it('returns false when attachment url changes', () => {
    const base = messageFixtures.userTextMessage;
    const withFile = {
      ...base,
      file: { name: 'a.png', type: 'image/png', url: 'https://example.com/a.png' },
    };
    const otherFile = {
      ...base,
      file: { name: 'b.png', type: 'image/png', url: 'https://example.com/b.png' },
    };
    expect(
      areChatMessagePropsEqual(chatMessageProps(withFile), chatMessageProps(otherFile))
    ).toBe(false);
  });

  it('returns false when contentJson gains suggestedActions', () => {
    const base = messageFixtures.partialAssistantMessage;
    const withActions = {
      ...base,
      contentJson: {
        suggestedActions: [
          { label: 'Get a quote', userQuery: 'Find local painters for a quote' },
        ],
      },
    };
    expect(
      areChatMessagePropsEqual(chatMessageProps(base), chatMessageProps(withActions))
    ).toBe(false);
  });
});
