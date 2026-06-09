import type { IMessage, MessageProps } from 'react-native-gifted-chat';
import type { Message } from '@homeapp/common/types';
import { areMessagesEqual } from '@homeapp/common/lib/merge-messages-snapshot';

/** Milliseconds for Message.createdAt (Firestore Timestamp or Date). */
export function messageCreatedAtMillis(
  createdAt: Message['createdAt'] | undefined
): number | undefined {
  if (!createdAt) return undefined;
  if (createdAt instanceof Date) return createdAt.getTime();
  if (typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
  return undefined;
}

/** GiftedChat IMessage.createdAt is Date or epoch ms while serverTimestamp is pending. */
export function giftedChatCreatedAtMillis(
  createdAt: IMessage['createdAt'] | undefined
): number | undefined {
  if (!createdAt) return undefined;
  if (createdAt instanceof Date) return createdAt.getTime();
  if (typeof createdAt === 'number') return createdAt;
  return undefined;
}

/**
 * Firestore user messages may omit createdAt until serverTimestamp resolves.
 * Keep GiftedChat's fallback Date so the time pill shows immediately.
 */
export function mergeMessageWithGiftedCreatedAt(
  message: Message,
  giftedCreatedAt: IMessage['createdAt']
): Message {
  if (message.createdAt) return message;
  const fallback = giftedCreatedAt instanceof Date ? giftedCreatedAt : new Date(giftedCreatedAt);
  return { ...message, createdAt: fallback };
}

/**
 * Transform Firestore Message to GiftedChat IMessage format
 */
export function transformToGiftedChat(
  firestoreMsg: Message,
  currentUserId: string
): IMessage {
  const isUser = firestoreMsg.role === 'user';

  return {
    _id: firestoreMsg.id,
    text: firestoreMsg.content || '',
    createdAt:
      firestoreMsg.createdAt instanceof Date
        ? firestoreMsg.createdAt
        : firestoreMsg.createdAt?.toDate
        ? firestoreMsg.createdAt.toDate()
        : new Date(),
    user: {
      _id: isUser ? currentUserId : 'assistant',
      name: isUser ? 'You' : 'Assistant',
      avatar: undefined, // We'll use custom avatar component
    },
    // Preserve custom data for rendering
    pending: !firestoreMsg.content && firestoreMsg.role === 'assistant',
    // Store original message data
    ...(firestoreMsg.file && { image: firestoreMsg.file.url }),
    // Custom fields
    customData: {
      role: firestoreMsg.role,
      file: firestoreMsg.file,
      agentSteps: firestoreMsg.agentSteps,
      originalContent: firestoreMsg.content,
      primaryAgent: firestoreMsg.primaryAgent,
      firestoreMessage: firestoreMsg,
    },
  };
}

/**
 * Transform array of Firestore messages to GiftedChat format
 * Note: GiftedChat expects messages in reverse chronological order (newest first)
 */
export function transformMessagesToGiftedChat(
  messages: Message[],
  currentUserId: string
): IMessage[] {
  return transformMessagesToGiftedChatCached(new Map(), messages, currentUserId).giftedMessages;
}

export type GiftedChatMessageCacheEntry = {
  source: Message;
  imessage: IMessage;
};

export type GiftedChatMessageCache = Map<string, GiftedChatMessageCacheEntry>;

function patchGiftedChatFromMessage(imessage: IMessage, msg: Message): IMessage {
  return {
    ...imessage,
    _id: msg.id,
    text: msg.content || '',
    pending: !msg.content && msg.role === 'assistant',
    customData: {
      ...imessage.customData,
      role: msg.role,
      file: msg.file,
      agentSteps: msg.agentSteps,
      originalContent: msg.content,
      primaryAgent: msg.primaryAgent,
      firestoreMessage: msg,
    },
  };
}

/**
 * Incremental GiftedChat transform. Reuses IMessage instances when the Firestore
 * payload is unchanged (see mergeMessagesFromSnapshot / areMessagesEqual).
 */
export function transformMessagesToGiftedChatCached(
  cache: GiftedChatMessageCache,
  messages: Message[],
  currentUserId: string
): { giftedMessages: IMessage[]; cache: GiftedChatMessageCache } {
  const nextCache: GiftedChatMessageCache = new Map();
  const giftedMessages: IMessage[] = new Array(messages.length);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[messages.length - 1 - i];
    const cached = cache.get(msg.id);
    if (cached && areMessagesEqual(cached.source, msg)) {
      const imessage =
        cached.source === msg ? cached.imessage : patchGiftedChatFromMessage(cached.imessage, msg);
      const entry: GiftedChatMessageCacheEntry = { source: msg, imessage };
      nextCache.set(msg.id, entry);
      giftedMessages[i] = imessage;
    } else {
      const imessage = transformToGiftedChat(msg, currentUserId);
      const entry: GiftedChatMessageCacheEntry = { source: msg, imessage };
      nextCache.set(msg.id, entry);
      giftedMessages[i] = imessage;
    }
  }

  return { giftedMessages, cache: nextCache };
}

/**
 * GiftedChat memoizes Message rows by currentMessage only. Force updates when
 * renderBubble changes (isActiveLoading / chips) or Firestore payload changes.
 */
export function shouldUpdateGiftedChatMessage(
  prev: MessageProps<IMessage>,
  next: MessageProps<IMessage>
): boolean {
  if (prev.renderBubble !== next.renderBubble) return true;
  if (prev.currentMessage === next.currentMessage) return false;

  const prevStored = prev.currentMessage?.customData?.firestoreMessage;
  const nextStored = next.currentMessage?.customData?.firestoreMessage;
  if (prevStored && nextStored) {
    return !areMessagesEqual(prevStored, nextStored);
  }
  return true;
}
