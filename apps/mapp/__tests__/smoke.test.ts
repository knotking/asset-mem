import { transformMessagesToGiftedChat, transformToGiftedChat } from '@/lib/gifted-chat-utils';
import { messageFixtures } from './fixtures/messages';

describe('mapp test harness', () => {
  it('runs jest-expo with module aliases', () => {
    expect(1 + 1).toBe(2);
  });

  it('transforms fixture messages to GiftedChat format', () => {
    const userId = 'user-123';
    const gifted = transformToGiftedChat(messageFixtures.userTextMessage, userId);
    expect(gifted._id).toBe('msg-user-1');
    expect(gifted.user._id).toBe(userId);
    expect(gifted.customData?.originalContent).toBe(messageFixtures.userTextMessage.content);

    const batch = transformMessagesToGiftedChat(
      [messageFixtures.userTextMessage, messageFixtures.partialAssistantMessage],
      userId
    );
    expect(batch).toHaveLength(2);
    expect(batch[0]._id).toBe('msg-assistant-partial');
    expect(batch[1]._id).toBe('msg-user-1');
  });
});
