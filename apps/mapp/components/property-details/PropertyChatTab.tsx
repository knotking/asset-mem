import * as React from 'react';
import { View, Platform, useColorScheme } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import NetInfo from '@react-native-community/netinfo';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import { MessageSquare, ChevronDown } from 'lucide-react-native';
import { useMessages } from '@homeapp/common/contexts/messages-context';
import { transformMessagesToGiftedChat } from '@/lib/gifted-chat-utils';
import GiftedChatBubble from '@/components/GiftedChatBubble';
import { GiftedChatInputToolbar } from '@/components/GiftedChatInputToolbar';
import { CheckpointAnalysisProgressFooter } from '@/components/CheckpointAnalysisProgressFooter';
import { getInFlightCheckpointProgressFromMessages } from '@homeapp/common/lib/checkpoint-branch-progress';
import type {
  FileAttachment,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  LocationData,
  PrimaryAgent,
} from '@homeapp/common/types';

interface PropertyChatTabProps {
  sessionId: string | null;
  userId: string;
  fileAttachment: FileAttachment | null;
  onAttachmentPress: () => void;
  onRemoveAttachment: () => void;
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  onToggleCheckpointOptionalAgent: (agent: CheckpointOptionalAgent) => void;
  isSending: boolean;
  onStop: () => void;
  attachmentOptionsVisible: boolean;
  onCloseAttachmentOptions: () => void;
  onTakePhoto: () => void;
  onRecordVideo: () => void;
  onSelectFromLibrary: () => void;
  onSelectFiles: () => void;
  onSend: (messages: IMessage[]) => void;
  locationData?: LocationData;
  onLocationDataChange?: (locationData: LocationData | undefined) => void;
  propertyAddress?: string;
}

export function PropertyChatTab({
  sessionId,
  userId,
  fileAttachment,
  onAttachmentPress,
  onRemoveAttachment,
  primaryAgent,
  onPrimaryAgentChange,
  selectedOptionalAgents,
  onToggleOptionalAgent,
  selectedCheckpointOptionalAgents,
  onToggleCheckpointOptionalAgent,
  isSending,
  onStop,
  attachmentOptionsVisible,
  onCloseAttachmentOptions,
  onTakePhoto,
  onRecordVideo,
  onSelectFromLibrary,
  onSelectFiles,
  onSend,
  locationData,
  onLocationDataChange,
  propertyAddress,
}: PropertyChatTabProps) {
  const {
    messages,
    isLoading,
    isLoadingEarlier,
    hasMoreMessages,
    loadEarlierMessages,
  } = useMessages();

  // Theme
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Network state
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, []);

  // Transform messages to GiftedChat format
  const giftedMessages = React.useMemo(
    () => transformMessagesToGiftedChat(messages, userId),
    [messages, userId]
  );

  const branchProgress = React.useMemo(
    () => getInFlightCheckpointProgressFromMessages(messages),
    [messages]
  );

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
      {/* Offline Banner */}
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
        user={{
          _id: userId,
        }}
        renderBubble={(props) => <GiftedChatBubble {...props} />}
        renderChatEmpty={() => (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: '50%',
              transform:
                Platform.OS === 'ios'
                  ? [{ rotate: '180deg' }, { scaleX: -1 }]
                  : [{ rotateX: '180deg' }, { rotateY: '180deg' }],
            }}>
            <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Icon as={MessageSquare} size={32} className="text-muted-foreground" />
              </View>
              <Text className="mb-2 text-center text-xl font-semibold text-foreground">
                Start a Conversation
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                Ask questions about this property's{'\n'}documents, services, and history
              </Text>
            </View>
          </View>
        )}
        renderFooter={() =>
          branchProgress ? (
            <CheckpointAnalysisProgressFooter progress={branchProgress} />
          ) : null
        }
        renderInputToolbar={(props) => (
          <GiftedChatInputToolbar
            {...props}
            fileAttachment={fileAttachment}
            onAttachmentPress={onAttachmentPress}
            onRemoveAttachment={onRemoveAttachment}
            primaryAgent={primaryAgent}
            onPrimaryAgentChange={onPrimaryAgentChange}
            selectedOptionalAgents={selectedOptionalAgents}
            onToggleOptionalAgent={onToggleOptionalAgent}
            selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
            onToggleCheckpointOptionalAgent={onToggleCheckpointOptionalAgent}
            isSending={isSending}
            onStop={onStop}
            attachmentOptionsVisible={attachmentOptionsVisible}
            onCloseAttachmentOptions={onCloseAttachmentOptions}
            onTakePhoto={onTakePhoto}
            onRecordVideo={onRecordVideo}
            onSelectFromLibrary={onSelectFromLibrary}
            onSelectFiles={onSelectFiles}
            locationData={locationData}
            onLocationDataChange={onLocationDataChange}
            propertyAddress={propertyAddress}
          />
        )}
        scrollToBottomComponent={() => (
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary shadow-lg">
            <Icon as={ChevronDown} size={22} className="text-primary-foreground" />
          </View>
        )}
        scrollToBottomStyle={{
          bottom: 10,
          right: 16,
          zIndex: 1000,
        }}
        scrollToBottomOffset={200}
        isScrollToBottomEnabled={true}
        renderActions={() => null}
        renderAvatar={null}
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
