import React, { useRef, useEffect, useCallback } from 'react';
import { FlatList, View, type ListRenderItemInfo } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react-native';
import ChatMessage from './ChatMessage';
import type { Message } from '@homeapp/common/types';

interface ChatListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatList({ messages, isLoading }: ChatListProps) {
  const flatListRef = useRef<FlatList>(null);
  const messageCountRef = useRef(messages.length);
  const isNearBottomRef = useRef(true); // Track if user is near bottom
  const lastMessageIdRef = useRef<string | null>(null);
  const lastMessageContentRef = useRef<string | null>(null);
  const lastMessageAgentStepsCountRef = useRef<number>(0);

  // Memoized render function for FlatList
  const renderMessage = useCallback(
    ({ item }: ListRenderItemInfo<Message>) => <ChatMessage message={item} />,
    []
  );

  // Memoized key extractor
  const keyExtractor = useCallback((item: Message) => item.id, []);

  // Track scroll position to determine if user is near bottom
  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    // Consider "near bottom" if within 100 pixels
    isNearBottomRef.current = distanceFromBottom < 100;
  }, []);

  // Handle content size change - only auto-scroll for new messages when near bottom
  const handleContentSizeChange = useCallback(
    (contentWidth: number, contentHeight: number) => {
      const previousMessageCount = messageCountRef.current;
      const currentMessageCount = messages.length;

      // Check if the last message just received content (transition from loading to content)
      const lastMessage = messages[messages.length - 1];
      const lastMessageId = lastMessage?.id || null;
      const lastMessageContent = lastMessage?.content || null;
      const lastMessageAgentStepsCount = lastMessage?.agentSteps?.length || 0;

      const isLastMessageContentNew =
        lastMessageId === lastMessageIdRef.current &&
        lastMessageContent &&
        lastMessageContent !== lastMessageContentRef.current;

      // Check if agent steps were updated (added or changed)
      const areAgentStepsUpdated =
        lastMessageId === lastMessageIdRef.current &&
        lastMessageAgentStepsCount > 0 &&
        lastMessageAgentStepsCount !== lastMessageAgentStepsCountRef.current;

      // Check if the last message is currently loading (no content but might have agent steps or typing indicator)
      const isLastMessageLoading = lastMessage?.role === 'assistant' && !lastMessage?.content;

      // Auto-scroll if:
      // 1. User is near bottom AND a new message was added, OR
      // 2. The last message just received content (was loading, now has content), OR
      // 3. Agent steps were updated on the last message, OR
      // 4. Last message is loading and near bottom (handles typing indicator and initial agent steps)
      if (
        currentMessageCount > 0 &&
        isNearBottomRef.current &&
        ((currentMessageCount > previousMessageCount) ||
          isLastMessageContentNew ||
          areAgentStepsUpdated ||
          isLastMessageLoading)
      ) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }

      // Update refs
      messageCountRef.current = currentMessageCount;
      lastMessageIdRef.current = lastMessageId;
      lastMessageContentRef.current = lastMessageContent;
      lastMessageAgentStepsCountRef.current = lastMessageAgentStepsCount;
    },
    [messages, messages.length]
  );

  // Auto-scroll to bottom when new messages arrive (initial load)
  useEffect(() => {
    const previousMessageCount = messageCountRef.current;
    const currentMessageCount = messages.length;

    // Only scroll on initial load or when first message arrives
    if (previousMessageCount === 0 && currentMessageCount > 0) {
      flatListRef.current?.scrollToEnd({ animated: false });
      messageCountRef.current = currentMessageCount;
    }
  }, [messages.length]);

  if (isLoading) {
    return (
      <View className="flex-1 p-4">
        {/* Simulate chat message skeletons */}
        <View className="mb-4">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-20 w-4/5 rounded-lg" />
        </View>
        <View className="mb-4 items-end">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-16 w-3/5 rounded-lg" />
        </View>
        <View className="mb-4">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-24 w-4/5 rounded-lg" />
        </View>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <Icon as={MessageSquare} size={32} className="text-muted-foreground" />
        </View>
        <Text className="mb-2 text-center text-xl font-semibold text-foreground">
          Start a Conversation
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          Ask questions about this property's{'\n'}documents, services, and history
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={keyExtractor}
      className="flex-1"
      contentContainerStyle={{ padding: 16 }}
      onScroll={handleScroll}
      onContentSizeChange={handleContentSizeChange}
      scrollEventThrottle={16}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={10}
    />
  );
}
