import type { IMessage, MessageProps } from 'react-native-gifted-chat';
import { shouldUpdateGiftedChatMessage, transformToGiftedChat } from '@/lib/gifted-chat-utils';
import { messageFixtures } from './fixtures/messages';

function messageProps(imessage: IMessage, renderBubble?: MessageProps<IMessage>['renderBubble']) {
  return {
    currentMessage: imessage,
    position: 'left' as const,
    user: { _id: 'user-123' },
    renderBubble,
  };
}

describe('shouldUpdateGiftedChatMessage', () => {
  it('returns true when renderBubble changes', () => {
    const imessage = transformToGiftedChat(messageFixtures.partialAssistantMessage, 'user-123');
    const prev = messageProps(imessage, () => null);
    const next = messageProps(imessage, () => null);
    expect(shouldUpdateGiftedChatMessage(prev, next)).toBe(true);
  });

  it('returns true when firestore contentJson changes', () => {
    const base = transformToGiftedChat(messageFixtures.partialAssistantMessage, 'user-123');
    const withActions = transformToGiftedChat(
      {
        ...messageFixtures.partialAssistantMessage,
        contentJson: {
          suggestedActions: [{ label: 'Run cost', userQuery: 'Run cost analysis' }],
        },
      },
      'user-123'
    );
    expect(
      shouldUpdateGiftedChatMessage(messageProps(base), messageProps(withActions))
    ).toBe(true);
  });

  it('returns false when currentMessage is unchanged', () => {
    const imessage = transformToGiftedChat(messageFixtures.partialAssistantMessage, 'user-123');
    const props = messageProps(imessage);
    expect(shouldUpdateGiftedChatMessage(props, props)).toBe(false);
  });
});
