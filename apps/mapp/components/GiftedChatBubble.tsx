import React from 'react';
import { View } from 'react-native';
import type { IMessage, BubbleProps } from 'react-native-gifted-chat';
import type { Message } from '@homeapp/common/types';
import ChatMessage from './ChatMessage';

interface CustomBubbleProps extends BubbleProps<IMessage> {
  // Add any additional props if needed
}

/**
 * Custom bubble component for GiftedChat that uses our existing ChatMessage component
 */
export default function GiftedChatBubble(props: CustomBubbleProps) {
  const { currentMessage } = props;

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
  };

  return (
    <View className="w-full">
      <ChatMessage message={message} />
    </View>
  );
}
