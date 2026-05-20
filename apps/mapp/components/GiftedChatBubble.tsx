import React from 'react';
import { View } from 'react-native';
import type { IMessage, BubbleProps } from 'react-native-gifted-chat';
import type { Message } from '@homeapp/common/types';
import ChatMessage from './ChatMessage';

interface CustomBubbleProps extends BubbleProps<IMessage> {
  sessionId?: string;
}

/**
 * Custom bubble component for GiftedChat that uses our existing ChatMessage component
 */
export default function GiftedChatBubble(props: CustomBubbleProps) {
  const { currentMessage, sessionId } = props;

  if (!currentMessage) {
    return null;
  }

  // Transform GiftedChat message back to our Message format
  const message: Message = {
    id: String(currentMessage._id),
    role: currentMessage.customData?.role || (currentMessage.user._id === 'assistant' ? 'assistant' : 'user'),
    content: currentMessage.customData?.originalContent || currentMessage.text,
    createdAt: currentMessage.createdAt as any,
    file: currentMessage.customData?.file,
    agentSteps: currentMessage.customData?.agentSteps,
    primaryAgent: currentMessage.customData?.primaryAgent,
  };

  return (
    <View className="w-full">
      <ChatMessage message={message} sessionId={sessionId} />
    </View>
  );
}
