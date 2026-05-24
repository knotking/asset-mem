import type { IMessage } from 'react-native-gifted-chat';
import type { Message } from '@homeapp/common/types';

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
  return messages
    .map((msg) => transformToGiftedChat(msg, currentUserId))
    .reverse(); // Reverse to show newest first
}
