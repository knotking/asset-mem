import React, { useRef, useEffect } from 'react';
import { ScrollView, View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { MessageSquare } from 'lucide-react-native';
import ChatMessage from './ChatMessage';
import type { Message } from '@homeapp/common/types';

interface ChatListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatList({ messages, isLoading }: ChatListProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="mt-2 text-muted-foreground">Loading messages...</Text>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <Icon as={MessageSquare} size={40} className="text-muted-foreground" />
        </View>
        <Text className="mb-2 text-center text-xl font-semibold text-foreground">
          Start a Conversation
        </Text>
        <Text className="text-center text-muted-foreground">
          Ask questions about this property's{'\n'}documents, services, and history
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1"
      contentContainerStyle={{ padding: 16 }}
      onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </ScrollView>
  );
}
