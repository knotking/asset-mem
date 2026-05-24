import type { IMessage } from 'react-native-gifted-chat';
import { areGiftedChatBubblePropsEqual } from '@/lib/gifted-chat-bubble-equal';
import { messageFixtures } from './fixtures/messages';
import { transformToGiftedChat } from '@/lib/gifted-chat-utils';

function bubbleProps(
  message: IMessage,
  sessionId = 'session-1',
  position: 'left' | 'right' = 'left'
) {
  return {
    currentMessage: message,
    sessionId,
    position,
    user: { _id: 'user-1' },
    nextMessage: undefined,
    previousMessage: undefined,
  } as const;
}

describe('areGiftedChatBubblePropsEqual', () => {
  const userId = 'user-123';
  const gifted = transformToGiftedChat(messageFixtures.partialAssistantMessage, userId);

  it('returns true when message fields are unchanged', () => {
    const a = bubbleProps(gifted);
    const b = bubbleProps({ ...gifted });
    expect(areGiftedChatBubblePropsEqual(a, b)).toBe(true);
  });

  it('returns false when content changes', () => {
    const updated = transformToGiftedChat(
      {
        ...messageFixtures.partialAssistantMessage,
        content: 'Updated content',
      },
      userId
    );
    expect(areGiftedChatBubblePropsEqual(bubbleProps(gifted), bubbleProps(updated))).toBe(false);
  });

  it('returns false when agentSteps change', () => {
    const withSteps = transformToGiftedChat(messageFixtures.streamingAssistantMessage, userId);
    expect(areGiftedChatBubblePropsEqual(bubbleProps(gifted), bubbleProps(withSteps))).toBe(false);
  });

  it('returns false when Firestore createdAt resolves', () => {
    const pending = transformToGiftedChat(
      { ...messageFixtures.userTextMessage, createdAt: undefined },
      userId
    );
    const resolved = transformToGiftedChat(messageFixtures.userTextMessage, userId);
    expect(areGiftedChatBubblePropsEqual(bubbleProps(pending), bubbleProps(resolved))).toBe(
      false
    );
  });

  it('returns false when sessionId changes', () => {
    expect(
      areGiftedChatBubblePropsEqual(
        bubbleProps(gifted, 'session-1'),
        bubbleProps(gifted, 'session-2')
      )
    ).toBe(false);
  });
});
