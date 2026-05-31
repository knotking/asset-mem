import React from 'react';
import { View } from 'react-native';
import type { IMessage, BubbleProps } from 'react-native-gifted-chat';
import type { Message } from '@homeapp/common/types';
import { areGiftedChatBubblePropsEqual } from '@/lib/gifted-chat-bubble-equal';
import { mergeMessageWithGiftedCreatedAt } from '@/lib/gifted-chat-utils';
import ChatMessage from './ChatMessage';

interface CustomBubbleProps extends BubbleProps<IMessage> {
  sessionId?: string;
}

/** Matches react-native-gifted-chat default Bubble side margins (see Bubble/styles.js). */
const BUBBLE_SIDE_MARGIN = 10;

function messageFromGiftedChat(currentMessage: IMessage): Message {
  const stored = currentMessage.customData?.firestoreMessage;
  if (stored) {
    return mergeMessageWithGiftedCreatedAt(stored, currentMessage.createdAt);
  }

  return {
    id: String(currentMessage._id),
    role:
      currentMessage.customData?.role ||
      (currentMessage.user._id === 'assistant' ? 'assistant' : 'user'),
    content: currentMessage.customData?.originalContent || currentMessage.text,
    createdAt: currentMessage.createdAt as Message['createdAt'],
    file: currentMessage.customData?.file,
    agentSteps: currentMessage.customData?.agentSteps,
    primaryAgent: currentMessage.customData?.primaryAgent,
    agentLifecycle: currentMessage.customData?.firestoreMessage?.agentLifecycle,
  };
}

function GiftedChatBubble({
  currentMessage,
  sessionId,
  position,
}: CustomBubbleProps) {
  if (!currentMessage) {
    return null;
  }

  const message = messageFromGiftedChat(currentMessage);

  return (
    <View
      style={{
        flex: 1,
        ...(position === 'left'
          ? { marginRight: BUBBLE_SIDE_MARGIN }
          : { marginLeft: BUBBLE_SIDE_MARGIN }),
      }}>
      <ChatMessage message={message} sessionId={sessionId} />
    </View>
  );
}

export default React.memo(GiftedChatBubble, areGiftedChatBubblePropsEqual);
