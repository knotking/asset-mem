import {
  mergeMessageWithGiftedCreatedAt,
  transformToGiftedChat,
  transformMessagesToGiftedChat,
} from '@/lib/gifted-chat-utils';
import { messageFixtures } from './fixtures/messages';

describe('gifted-chat-utils', () => {
  const userId = 'user-123';

  it('stores firestoreMessage on customData', () => {
    const gifted = transformToGiftedChat(messageFixtures.userTextMessage, userId);
    expect(gifted.customData?.firestoreMessage).toBe(messageFixtures.userTextMessage);
    expect(gifted.customData?.originalContent).toBe(messageFixtures.userTextMessage.content);
  });

  it('mergeMessageWithGiftedCreatedAt fills missing Firestore createdAt from GiftedChat', () => {
    const pending = { ...messageFixtures.userTextMessage, createdAt: undefined };
    const giftedAt = new Date('2026-01-15T14:30:00.000Z');
    const merged = mergeMessageWithGiftedCreatedAt(pending, giftedAt);
    expect(merged.createdAt).toEqual(giftedAt);
    expect(merged).not.toBe(pending);
  });

  it('mergeMessageWithGiftedCreatedAt keeps Firestore createdAt when present', () => {
    const merged = mergeMessageWithGiftedCreatedAt(
      messageFixtures.userTextMessage,
      new Date('2099-01-01T00:00:00.000Z')
    );
    expect(merged).toBe(messageFixtures.userTextMessage);
  });

  it('preserves firestoreMessage references in batch transform', () => {
    const batch = transformMessagesToGiftedChat(
      [messageFixtures.userTextMessage, messageFixtures.partialAssistantMessage],
      userId
    );
    expect(batch[0].customData?.firestoreMessage).toBe(messageFixtures.partialAssistantMessage);
    expect(batch[1].customData?.firestoreMessage).toBe(messageFixtures.userTextMessage);
  });
});
