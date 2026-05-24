import {
  transformMessagesToGiftedChatCached,
  transformToGiftedChat,
} from '@/lib/gifted-chat-utils';
import { messageFixtures } from './fixtures/messages';

describe('transformMessagesToGiftedChatCached', () => {
  const userId = 'user-123';

  it('reuses IMessage instances when Firestore message references are unchanged', () => {
    const messages = [messageFixtures.userTextMessage, messageFixtures.partialAssistantMessage];
    const first = transformMessagesToGiftedChatCached(new Map(), messages, userId);
    const second = transformMessagesToGiftedChatCached(first.cache, messages, userId);

    expect(second.giftedMessages[0]).toBe(first.giftedMessages[0]);
    expect(second.giftedMessages[1]).toBe(first.giftedMessages[1]);
  });

  it('rebuilds only the changed message when one id updates', () => {
    const messages = [messageFixtures.userTextMessage, messageFixtures.partialAssistantMessage];
    const first = transformMessagesToGiftedChatCached(new Map(), messages, userId);

    const updatedAssistant = {
      ...messageFixtures.partialAssistantMessage,
      content: 'Updated assistant content',
    };
    const nextMessages = [messageFixtures.userTextMessage, updatedAssistant];
    const second = transformMessagesToGiftedChatCached(first.cache, nextMessages, userId);

    // GiftedChat order is newest-first: assistant at [0], user at [1]
    expect(second.giftedMessages[1]).toBe(first.giftedMessages[1]);
    expect(second.giftedMessages[0]).not.toBe(first.giftedMessages[0]);
    expect(second.giftedMessages[0].text).toBe('Updated assistant content');
  });

  it('matches uncached transform for a fresh cache', () => {
    const messages = [messageFixtures.userTextMessage, messageFixtures.partialAssistantMessage];
    const cached = transformMessagesToGiftedChatCached(new Map(), messages, userId);
    const uncached = [
      transformToGiftedChat(messageFixtures.partialAssistantMessage, userId),
      transformToGiftedChat(messageFixtures.userTextMessage, userId),
    ];
    expect(cached.giftedMessages.map((m) => m._id)).toEqual(uncached.map((m) => m._id));
    expect(cached.giftedMessages.map((m) => m.text)).toEqual(uncached.map((m) => m.text));
  });
});
