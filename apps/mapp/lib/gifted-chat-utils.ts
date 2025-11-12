import type { IMessage } from 'react-native-gifted-chat';
import type { Message } from '@homeapp/common/types';

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
