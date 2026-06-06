import React from 'react';
import { View, Pressable, useColorScheme, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { InputToolbar, InputToolbarProps, Composer, Send } from 'react-native-gifted-chat';
import type { IMessage } from 'react-native-gifted-chat';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Plus, Send as SendIcon, Square, ChevronDown, ChevronUp } from 'lucide-react-native';
import type { AnalysisOptionalAgent, CheckpointOptionalAgent, PrimaryAgent } from '@homeapp/common/types';
import { CompactSettingsBar } from './CompactSettingsBar';
import { ChatSettingsModal } from './ChatSettingsModal';

const MAX_MESSAGE_LENGTH = 2000;

function primaryAgentLabel(agent: PrimaryAgent): string {
  if (agent === 'analysis') return 'Analysis';
  if (agent === 'checkpoint') return 'Checkpoint';
  return 'Docs';
}

function buildCollapsedComposerSummary({
  primaryAgent,
  selectedOptionalAgents,
  selectedCheckpointOptionalAgents,
  readyContextCount,
  pendingContextCount,
  hasQueuedSend,
}: {
  primaryAgent: PrimaryAgent;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  readyContextCount: number;
  pendingContextCount: number;
  hasQueuedSend: boolean;
}): string {
  const parts = [primaryAgentLabel(primaryAgent)];

  const optionalCount =
    primaryAgent === 'analysis'
      ? selectedOptionalAgents.length
      : primaryAgent === 'checkpoint'
        ? selectedCheckpointOptionalAgents.length
        : 0;
  if (optionalCount > 0) {
    parts[0] = `${parts[0]} +${optionalCount}`;
  }

  if (hasQueuedSend) {
    parts.push('queued message');
  } else {
    const contextTotal = readyContextCount + pendingContextCount;
    if (contextTotal > 0) {
      parts.push(
        pendingContextCount > 0 && readyContextCount === 0
          ? `${pendingContextCount} pending`
          : `${contextTotal} context`
      );
    }
  }

  return parts.join(' · ');
}

interface GiftedChatInputToolbarProps extends InputToolbarProps<IMessage> {
  onOpenAddContext: () => void;
  contextChipStrip?: React.ReactNode;
  sendBlockHint?: string | null;
  primaryAgent: PrimaryAgent;
  onPrimaryAgentChange: (agent: PrimaryAgent) => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  selectedCheckpointOptionalAgents: CheckpointOptionalAgent[];
  onToggleCheckpointOptionalAgent: (agent: CheckpointOptionalAgent) => void;
  isSending: boolean;
  onStop: () => void;
  searchLocation?: import('@homeapp/common/types').SearchLocationInput;
  onSearchLocationChange?: (
    searchLocation: import('@homeapp/common/types').SearchLocationInput | undefined
  ) => void;
  propertyAddress?: string;
  readyContextCount?: number;
  pendingContextCount?: number;
  hasQueuedSend?: boolean;
}

export function GiftedChatInputToolbar(props: GiftedChatInputToolbarProps) {
  const {
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
    readyContextCount = 0,
    pendingContextCount = 0,
    hasQueuedSend = false,
    ...inputToolbarProps
  } = props;

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [settingsModalVisible, setSettingsModalVisible] = React.useState(false);
  const [settingsModalTab, setSettingsModalTab] = React.useState<'agent' | 'location'>('agent');
  const [composerMetaExpanded, setComposerMetaExpanded] = React.useState(true);

  const collapsedSummary = React.useMemo(
    () =>
      buildCollapsedComposerSummary({
        primaryAgent,
        selectedOptionalAgents,
        selectedCheckpointOptionalAgents,
        readyContextCount,
        pendingContextCount,
        hasQueuedSend,
      }),
    [
      primaryAgent,
      selectedOptionalAgents,
      selectedCheckpointOptionalAgents,
      readyContextCount,
      pendingContextCount,
      hasQueuedSend,
    ]
  );

  const toggleComposerMeta = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setComposerMetaExpanded((value) => !value);
  }, []);

  const colors = React.useMemo(
    () => ({
      background: isDark ? 'hsl(0, 0%, 8%)' : 'hsl(0, 0%, 100%)',
      foreground: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(0, 0%, 3.9%)',
      border: isDark ? 'hsl(0, 0%, 28%)' : 'hsl(0, 0%, 89.8%)',
      mutedForeground: isDark ? 'hsl(0, 0%, 70%)' : 'hsl(0, 0%, 45.1%)',
    }),
    [isDark]
  );

  const handleOpenAddContext = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    onOpenAddContext();
  }, [onOpenAddContext]);

  const handleOpenSettings = React.useCallback(() => {
    setSettingsModalTab('agent');
    setSettingsModalVisible(true);
  }, []);

  const handleOpenAgentSettings = React.useCallback(() => {
    setSettingsModalTab('agent');
    setSettingsModalVisible(true);
  }, []);

  const handleOpenLocationSettings = React.useCallback(() => {
    setSettingsModalTab('location');
    setSettingsModalVisible(true);
  }, []);

  // Memoize renderComposer to prevent recreation on every render
  const renderComposer = React.useCallback(
    (composerProps: any) => {
      const textLength = composerProps.text?.length || 0;
      const isNearLimit = textLength > MAX_MESSAGE_LENGTH * 0.9;
      const isOverLimit = textLength > MAX_MESSAGE_LENGTH;

      return (
        <>
          <Composer
            {...composerProps}
            textInputStyle={{
              marginLeft: 0,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: isOverLimit ? 'hsl(0, 84.2%, 60.2%)' : colors.border,
              borderRadius: 32,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 9,
              paddingBottom: 12,
              fontSize: 14,
              minHeight: 40,
              maxHeight: 120,
              lineHeight: 20,
              color: colors.foreground,
              textAlignVertical: 'center',
            }}
            textInputProps={{
              ...composerProps.textInputProps,
              maxLength: MAX_MESSAGE_LENGTH,
            }}
            textInputAutoFocus={false}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
          />
          {isNearLimit && (
            <Text
              style={{
                position: 'absolute',
                bottom: -20,
                right: 35,
                fontSize: 12,
                color: isOverLimit ? 'hsl(0, 84.2%, 60.2%)' : colors.mutedForeground,
              }}>
              {textLength}/{MAX_MESSAGE_LENGTH}
            </Text>
          )}
        </>
      );
    },
    [colors]
  );

  // Memoize renderSend to prevent recreation on every render
  const renderSend = React.useCallback(
    (sendProps: any) => {
      const canSend = !!sendProps.text?.trim();

      const handleSend = () => {
        if (canSend && sendProps.onSend) {
          // Haptic feedback on send
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          // Create message with text (empty string if no text)
          const messageText = sendProps.text || '';
          sendProps.onSend([{ text: messageText }], true);

          // Delay keyboard dismissal to ensure send completes first
          requestAnimationFrame(() => {
            Keyboard.dismiss();
          });
        }
      };

      return (
        <Send
          {...sendProps}
          disabled={!canSend}
          containerStyle={{
            position: 'absolute',
            right: 3,
            marginBottom: 2,
            marginLeft: 4,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onSend={handleSend}>
          <Pressable
            onPress={isSending ? onStop : handleSend}
            disabled={isSending ? false : !canSend}
            style={{
              opacity: isSending || canSend ? 1 : 0.5,
            }}>
            {isSending ? (
              <View className="h-8 w-8 items-center justify-center rounded-full bg-destructive">
                <Icon as={Square} size={16} className="text-primary-foreground" />
              </View>
            ) : (
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  canSend ? 'bg-primary' : 'bg-secondary'
                }`}>
                <Icon
                  as={SendIcon}
                  size={16}
                  className={canSend ? 'text-primary-foreground' : 'text-muted-foreground'}
                />
              </View>
            )}
          </Pressable>
        </Send>
      );
    },
    [isSending, onStop]
  );

  return (
    <View className="border-t border-border bg-light-background-alt px-4 pb-2 pt-3">
      {composerMetaExpanded ? (
        <>
          {contextChipStrip}

          {sendBlockHint ? (
            <Text className="mb-2 text-xs text-muted-foreground">{sendBlockHint}</Text>
          ) : null}

          <View className="mb-2 flex-row items-center gap-1">
            <View className="min-w-0 flex-1">
              <CompactSettingsBar
                primaryAgent={primaryAgent}
                selectedOptionalAgents={selectedOptionalAgents}
                selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
                searchLocation={searchLocation}
                propertyAddress={propertyAddress}
                onOpenSettings={handleOpenSettings}
                onAgentPress={handleOpenAgentSettings}
                onLocationPress={handleOpenLocationSettings}
                className="flex-row items-center gap-2"
              />
            </View>
            <Pressable
              onPress={toggleComposerMeta}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Collapse chat settings and context"
              className="h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background">
              <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
            </Pressable>
          </View>
        </>
      ) : (
        <View className="mb-2 flex-row items-center gap-1">
          <Pressable
            onPress={handleOpenSettings}
            className="min-w-0 flex-1 flex-row items-center rounded-full border border-border bg-background px-3 py-1.5"
            accessibilityRole="button"
            accessibilityLabel={`Chat settings: ${collapsedSummary}`}>
            <Text className="flex-1 text-xs font-medium text-foreground" numberOfLines={1}>
              {collapsedSummary}
            </Text>
          </Pressable>
          <Pressable
            onPress={toggleComposerMeta}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Expand chat settings and context"
            className="h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background">
            <Icon as={ChevronUp} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>
      )}

      {!composerMetaExpanded && sendBlockHint ? (
        <Text className="mb-2 text-xs text-muted-foreground">{sendBlockHint}</Text>
      ) : null}

      {/* Chat Settings Modal */}
      <ChatSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        primaryAgent={primaryAgent}
        onPrimaryAgentChange={onPrimaryAgentChange}
        selectedOptionalAgents={selectedOptionalAgents}
        onToggleOptionalAgent={onToggleOptionalAgent}
        selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
        onToggleCheckpointOptionalAgent={onToggleCheckpointOptionalAgent}
        searchLocation={searchLocation}
        onSearchLocationChange={onSearchLocationChange}
        propertyAddress={propertyAddress}
        initialTab={settingsModalTab}
      />

      {/* Input Row */}
      <View className="flex-row items-end gap-2">
        <Pressable
          onPress={handleOpenAddContext}
          disabled={isSending}
          accessibilityLabel="Add context"
          className="mb-[8px] h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Icon as={Plus} size={18} className="text-primary-foreground" />
        </Pressable>

        {/* Input Field */}
        <View style={{ flex: 1 }}>
          <InputToolbar
            {...inputToolbarProps}
            containerStyle={{
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              paddingHorizontal: 0,
              paddingVertical: 0,
              marginTop: 0,
              marginBottom: 0,
            }}
            primaryStyle={{
              alignItems: 'flex-end',
            }}
            renderComposer={renderComposer}
            renderSend={renderSend}
          />
        </View>
      </View>
    </View>
  );
}
