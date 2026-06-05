import * as React from 'react';
import { View, Platform, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import NetInfo from '@react-native-community/netinfo';
import {
  GiftedChat,
  IMessage,
  type BubbleProps,
  type InputToolbarProps,
} from 'react-native-gifted-chat';
import { ChevronDown } from 'lucide-react-native';
import { AssetMemBrandIcon } from '@/components/AssetMemBrandIcon';
import { useMessages } from '@homeapp/common/contexts/messages-context';
import {
  transformMessagesToGiftedChatCached,
  type GiftedChatMessageCache,
} from '@/lib/gifted-chat-utils';
import GiftedChatBubble from '@/components/GiftedChatBubble';
import { GiftedChatInputToolbar } from '@/components/GiftedChatInputToolbar';
import { CheckpointAnalysisProgressFooter } from '@/components/CheckpointAnalysisProgressFooter';
import { getInFlightCheckpointProgressFromMessages } from '@homeapp/common/lib/checkpoint-branch-progress';
import { countPriorAssistantTurnsInSession } from '@homeapp/common/lib/agent-lifecycle-ui';
import { buildSuppressRepeatedContextRefsByMessageId } from '@homeapp/common/lib/chat-message-context-refs';
import {
  assistantMessageHasDisplayableContent,
  getMessageDisplayParts,
} from '@/lib/chat-content-parse';
import { giftedChatListViewPropsForPlatform } from '@/lib/property-chat-list-props';
import {
  CHAT_SESSION_EMPTY_INTRO,
  getSuggestedPrompts,
} from '@homeapp/common/lib/feature-discovery';
import type {
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  PrimaryAgent,
} from '@homeapp/common/types';

interface PropertyChatTabProps {
  sessionId: string | null;
  userId: string;
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  onToggleCheckpointOptionalAgent: (agent: CheckpointOptionalAgent) => void;
  isSending: boolean;
  onStop: () => void;
  onSend: (messages: IMessage[]) => void;
  onOpenAddContext: () => void;
  contextChipStrip?: React.ReactNode;
  sendBlockHint?: string | null;
  searchLocation?: import('@homeapp/common/types').SearchLocationInput;
  onSearchLocationChange?: (
    searchLocation: import('@homeapp/common/types').SearchLocationInput | undefined
  ) => void;
  propertyAddress?: string;
}

function PropertyChatTab({
  sessionId,
  userId,
  primaryAgent,
  onPrimaryAgentChange,
  selectedOptionalAgents,
  onToggleOptionalAgent,
  selectedCheckpointOptionalAgents,
  onToggleCheckpointOptionalAgent,
  isSending,
  onStop,
  onSend,
  onOpenAddContext,
  contextChipStrip,
  sendBlockHint,
  searchLocation,
  onSearchLocationChange,
  propertyAddress,
}: PropertyChatTabProps) {
  const { messages, isLoadingEarlier, hasMoreMessages, loadEarlierMessages } = useMessages();

  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, []);

  const giftedChatCacheRef = React.useRef<GiftedChatMessageCache>(new Map());

  React.useEffect(() => {
    giftedChatCacheRef.current = new Map();
  }, [sessionId]);

  const giftedMessages = React.useMemo(() => {
    const { giftedMessages: next, cache } = transformMessagesToGiftedChatCached(
      giftedChatCacheRef.current,
      messages,
      userId
    );
    giftedChatCacheRef.current = cache;
    return next;
  }, [messages, userId]);

  const branchProgress = React.useMemo(() => {
    return getInFlightCheckpointProgressFromMessages(messages);
  }, [messages]);

  const activeStreamingAssistantId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;
      if (!assistantMessageHasDisplayableContent(getMessageDisplayParts(msg))) {
        return msg.id;
      }
    }
    return null;
  }, [messages]);

  const priorAssistantTurnCountById = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        map.set(msg.id, countPriorAssistantTurnsInSession(messages, msg.id));
      }
    }
    return map;
  }, [messages]);

  const suppressRepeatedContextRefsById = React.useMemo(
    () => buildSuppressRepeatedContextRefsByMessageId(messages),
    [messages]
  );

  const giftedChatUser = React.useMemo(() => ({ _id: userId }), [userId]);

  const sessionIdRef = React.useRef(sessionId);
  sessionIdRef.current = sessionId;

  const listViewProps = React.useMemo(() => giftedChatListViewPropsForPlatform(), []);

  const renderBubble = React.useCallback(
    (props: BubbleProps<IMessage>) => {
      const messageId = String(props.currentMessage?._id ?? '');
      return (
        <GiftedChatBubble
          {...props}
          sessionId={sessionIdRef.current ?? undefined}
          priorAssistantTurnCount={priorAssistantTurnCountById.get(messageId) ?? 0}
          isActiveLoading={messageId === activeStreamingAssistantId}
          hideRepeatedContextRefs={suppressRepeatedContextRefsById.get(messageId) ?? false}
        />
      );
    },
    [priorAssistantTurnCountById, activeStreamingAssistantId, suppressRepeatedContextRefsById]
  );

  const renderChatEmpty = React.useCallback(() => {
    const suggestedPrompts = getSuggestedPrompts();
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: '30%',
          transform:
            Platform.OS === 'ios'
              ? [{ rotate: '180deg' }, { scaleX: -1 }]
              : [{ rotateX: '180deg' }, { rotateY: '180deg' }],
        }}>
        <View style={{ alignItems: 'center', paddingHorizontal: 16, maxWidth: 360 }}>
          <AssetMemBrandIcon size="lg" className="mb-4 text-muted-foreground" />
          <Text className="mb-2 text-center text-xl font-semibold text-foreground">
            {CHAT_SESSION_EMPTY_INTRO.title}
          </Text>
          <Text className="mb-4 text-center text-sm text-muted-foreground">
            {CHAT_SESSION_EMPTY_INTRO.subtitle}
          </Text>
          <View className="w-full gap-2">
            {suggestedPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                disabled={isSending}
                onPress={() =>
                  onSend([
                    {
                      _id: `${Date.now()}`,
                      text: prompt,
                      createdAt: new Date(),
                      user: giftedChatUser,
                    },
                  ])
                }
                className="rounded-md border border-border bg-background px-3 py-2.5 disabled:opacity-50">
                <Text className="text-left text-sm text-foreground">{prompt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  }, [giftedChatUser, isSending, onSend]);

  const renderFooter = React.useCallback(
    () => (branchProgress ? <CheckpointAnalysisProgressFooter progress={branchProgress} /> : null),
    [branchProgress]
  );

  const renderInputToolbar = React.useCallback(
    (props: InputToolbarProps<IMessage>) => (
      <GiftedChatInputToolbar
        {...props}
        onOpenAddContext={onOpenAddContext}
        contextChipStrip={contextChipStrip}
        sendBlockHint={sendBlockHint}
        primaryAgent={primaryAgent}
        onPrimaryAgentChange={onPrimaryAgentChange}
        selectedOptionalAgents={selectedOptionalAgents}
        onToggleOptionalAgent={onToggleOptionalAgent}
        selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
        onToggleCheckpointOptionalAgent={onToggleCheckpointOptionalAgent}
        isSending={isSending}
        onStop={onStop}
        searchLocation={searchLocation}
        onSearchLocationChange={onSearchLocationChange}
        propertyAddress={propertyAddress}
      />
    ),
    [
      onOpenAddContext,
      contextChipStrip,
      sendBlockHint,
      primaryAgent,
      onPrimaryAgentChange,
      selectedOptionalAgents,
      onToggleOptionalAgent,
      selectedCheckpointOptionalAgents,
      onToggleCheckpointOptionalAgent,
      isSending,
      onStop,
      searchLocation,
      onSearchLocationChange,
      propertyAddress,
    ]
  );

  const scrollToBottomComponent = React.useCallback(
    () => (
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary shadow-lg">
        <Icon as={ChevronDown} size={22} className="text-primary-foreground" />
      </View>
    ),
    []
  );

  const renderActions = React.useCallback(() => null, []);
  const renderAvatar = React.useCallback(() => null, []);

  if (!sessionId) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-center text-muted-foreground">
          Select a session to start chatting
        </Text>
      </View>
    );
  }

  return (
    <>
      {!isOnline && (
        <View className="bg-warning px-4 py-2">
          <Text className="text-center text-sm font-medium text-warning-foreground">
            You're offline. Messages will be sent when connection is restored.
          </Text>
        </View>
      )}

      <GiftedChat
        messages={giftedMessages}
        onSend={onSend}
        user={giftedChatUser}
        renderBubble={renderBubble}
        renderChatEmpty={renderChatEmpty}
        renderFooter={renderFooter}
        renderInputToolbar={renderInputToolbar}
        scrollToBottomComponent={scrollToBottomComponent}
        scrollToBottomStyle={{
          bottom: 10,
          right: 16,
          zIndex: 1000,
        }}
        scrollToBottomOffset={200}
        isScrollToBottomEnabled={true}
        renderActions={renderActions}
        renderAvatar={renderAvatar}
        listViewProps={listViewProps}
        isLoadingEarlier={isLoadingEarlier}
        loadEarlier={hasMoreMessages}
        onLoadEarlier={loadEarlierMessages}
        alwaysShowSend={true}
        keyboardShouldPersistTaps="never"
        messagesContainerStyle={{
          backgroundColor: 'transparent',
        }}
        textInputProps={{
          autoCapitalize: 'sentences',
          autoCorrect: true,
        }}
        bottomOffset={-84}
        minInputToolbarHeight={44}
        infiniteScroll
      />
    </>
  );
}

const MemoizedPropertyChatTab = React.memo(PropertyChatTab);
export { MemoizedPropertyChatTab as PropertyChatTab };
