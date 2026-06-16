import React from 'react';
import { View, Pressable, useColorScheme, Keyboard, Platform, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { InputToolbarProps } from 'react-native-gifted-chat';
import type { ComposerProps } from 'react-native-gifted-chat/lib/Composer';
import type { IMessage } from 'react-native-gifted-chat';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Send as SendIcon, Square, Settings } from 'lucide-react-native';
import type { AnalysisOptionalAgent, CheckpointOptionalAgent, PrimaryAgent } from '@homeapp/common/types';
import { ChatSettingsModal } from './ChatSettingsModal';
import {
  CustomGiftedComposer,
} from '@/components/chat/CustomGiftedComposer';
import { composerToolbarBottomPadding } from '@/lib/tab-bar-metrics';
import { RecordingTestIds } from '@/lib/recording-test-ids';

const MAX_MESSAGE_LENGTH = 2000;
/** Must match maxComposerHeight on PropertyChatTab GiftedChat. */
const MAX_COMPOSER_HEIGHT = 120;
/** Match web mobile chat input (text-base + leading-5), tuned per platform metrics. */
const COMPOSER_FONT_SIZE = Platform.OS === 'ios' ? 15 : 16;
const COMPOSER_LINE_HEIGHT = 20;
const COMPOSER_MIN_HEIGHT = 44;
const COMPOSER_PADDING_LEFT = 12;
const COMPOSER_PADDING_TOP = 10;
const COMPOSER_PADDING_BOTTOM_SINGLE = 10;
/** Extra bottom inset so the last line clears the send circle on multiline input. */
const COMPOSER_PADDING_BOTTOM_MULTI = 28;
/** Settings sits outside the pill — full HIG target. */
const SETTINGS_BUTTON_SIZE = 44;
/** Send sits inside the pill. */
const COMPOSER_SEND_SIZE = 36;
const COMPOSER_SEND_INSET = 4;
const SEND_ICON_SIZE = 18;
const COMPOSER_TEXT_RIGHT_PADDING = COMPOSER_SEND_INSET + COMPOSER_SEND_SIZE + 10;

interface GiftedChatInputToolbarProps extends InputToolbarProps<IMessage>, ComposerProps {
  onSend?: (messages: Partial<IMessage> | Partial<IMessage>[], shouldResetInputToolbar?: boolean) => void;
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
  onOpenAddContext: () => void;
  readyContextCount?: number;
  pendingContextCount?: number;
  searchLocation?: import('@homeapp/common/types').SearchLocationInput;
  onSearchLocationChange?: (
    searchLocation: import('@homeapp/common/types').SearchLocationInput | undefined
  ) => void;
  propertyAddress?: string;
}

export function GiftedChatInputToolbar(props: GiftedChatInputToolbarProps) {
  const {
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
    onOpenAddContext,
    readyContextCount = 0,
    pendingContextCount = 0,
    searchLocation,
    onSearchLocationChange,
    propertyAddress,
    ...inputToolbarProps
  } = props;

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [settingsModalVisible, setSettingsModalVisible] = React.useState(false);
  const [settingsModalTab, setSettingsModalTab] = React.useState<'agent' | 'location'>('agent');

  const colors = React.useMemo(
    () => ({
      background: isDark ? 'hsl(0, 0%, 8%)' : 'hsl(0, 0%, 100%)',
      foreground: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(0, 0%, 3.9%)',
      border: isDark ? 'hsl(0, 0%, 28%)' : 'hsl(0, 0%, 89.8%)',
      mutedForeground: isDark ? 'hsl(0, 0%, 70%)' : 'hsl(0, 0%, 45.1%)',
    }),
    [isDark]
  );

  const handleOpenSettings = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setSettingsModalTab('agent');
    setSettingsModalVisible(true);
  }, []);

  const handleOpenAddContextFromSettings = React.useCallback(() => {
    setSettingsModalVisible(false);
    onOpenAddContext();
  }, [onOpenAddContext]);

  const renderComposer = React.useCallback(
    (
      composerProps: ComposerProps & {
        onSend?: (messages: Partial<IMessage> | Partial<IMessage>[], shouldResetInputToolbar?: boolean) => void;
      }
    ) => {
      const textLength = composerProps.text?.length || 0;
      const isNearLimit = textLength > MAX_MESSAGE_LENGTH * 0.9;
      const isOverLimit = textLength > MAX_MESSAGE_LENGTH;
      const canSend = !!composerProps.text?.trim();

      const handleSend = () => {
        if (!canSend || !composerProps.onSend) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        composerProps.onSend({ text: composerProps.text!.trim() }, true);
        requestAnimationFrame(() => {
          Keyboard.dismiss();
        });
      };

      return (
        <View style={styles.composerColumn}>
          <CustomGiftedComposer
            {...composerProps}
            minComposerHeight={COMPOSER_MIN_HEIGHT}
            maxComposerHeight={MAX_COMPOSER_HEIGHT}
            lineHeight={COMPOSER_LINE_HEIGHT}
            horizontalPadding={COMPOSER_PADDING_LEFT + COMPOSER_TEXT_RIGHT_PADDING}
            fontSize={COMPOSER_FONT_SIZE}
            paddingTop={COMPOSER_PADDING_TOP}
            paddingBottomSingle={COMPOSER_PADDING_BOTTOM_SINGLE}
            paddingBottomMulti={COMPOSER_PADDING_BOTTOM_MULTI}
            containerStyle={{
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: isOverLimit ? 'hsl(0, 84.2%, 60.2%)' : colors.border,
              borderRadius: 32,
            }}
            textInputStyle={{
              marginLeft: 0,
              marginTop: 0,
              marginBottom: 0,
              backgroundColor: 'transparent',
              paddingLeft: COMPOSER_PADDING_LEFT,
              paddingRight: COMPOSER_TEXT_RIGHT_PADDING,
              fontSize: COMPOSER_FONT_SIZE,
              lineHeight: COMPOSER_LINE_HEIGHT,
              color: colors.foreground,
              ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
            }}
            textInputProps={{
              ...composerProps.textInputProps,
              maxLength: MAX_MESSAGE_LENGTH,
              allowFontScaling: false,
              testID: RecordingTestIds.chat.messageInput,
              accessibilityLabel: 'Chat input',
            }}
            textInputAutoFocus={false}
            placeholder="Type a message…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            overlayInset={COMPOSER_SEND_INSET}
            overlay={
              <Pressable
                testID={isSending ? RecordingTestIds.chat.stopProcessing : RecordingTestIds.chat.sendMessage}
                onPress={isSending ? onStop : handleSend}
                disabled={isSending ? false : !canSend}
                accessibilityRole="button"
                accessibilityLabel={isSending ? 'Stop response' : 'Send message'}
                style={{ opacity: isSending || canSend ? 1 : 0.5 }}>
                {isSending ? (
                  <View
                    className="items-center justify-center rounded-full bg-destructive"
                    style={{ width: COMPOSER_SEND_SIZE, height: COMPOSER_SEND_SIZE }}>
                    <Icon as={Square} size={SEND_ICON_SIZE} className="text-primary-foreground" />
                  </View>
                ) : (
                  <View
                    className={`items-center justify-center rounded-full ${
                      canSend ? 'bg-primary' : 'bg-secondary'
                    }`}
                    style={{ width: COMPOSER_SEND_SIZE, height: COMPOSER_SEND_SIZE }}>
                    <Icon
                      as={SendIcon}
                      size={SEND_ICON_SIZE}
                      className={canSend ? 'text-primary-foreground' : 'text-muted-foreground'}
                    />
                  </View>
                )}
              </Pressable>
            }
          />
          {isNearLimit ? (
            <Text
              className="mt-1 text-xs text-muted-foreground"
              style={{
                color: isOverLimit ? 'hsl(0, 84.2%, 60.2%)' : colors.mutedForeground,
              }}>
              {textLength}/{MAX_MESSAGE_LENGTH}
            </Text>
          ) : null}
        </View>
      );
    },
    [colors, isSending, onStop]
  );

  return (
    <View
      className="border-t border-border bg-light-background-alt px-4"
      style={{
        paddingTop: 8,
        paddingBottom: composerToolbarBottomPadding(),
      }}>
      {contextChipStrip}
      {sendBlockHint ? (
        <Text className="mb-2 text-xs text-muted-foreground">{sendBlockHint}</Text>
      ) : null}

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
        onOpenAddContext={handleOpenAddContextFromSettings}
        readyContextCount={readyContextCount}
        pendingContextCount={pendingContextCount}
      />

      <View style={styles.composerRow}>
        <Pressable
          testID={RecordingTestIds.chat.openSettings}
          onPress={handleOpenSettings}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Open chat settings"
          className="shrink-0 items-center justify-center rounded-full border border-border bg-background"
          style={styles.settingsButton}>
          <Icon as={Settings} size={SEND_ICON_SIZE} className="text-muted-foreground" />
        </Pressable>

        <View style={styles.composerSlot}>{renderComposer(inputToolbarProps)}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  settingsButton: {
    width: SETTINGS_BUTTON_SIZE,
    height: SETTINGS_BUTTON_SIZE,
  },
  composerSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  composerColumn: {
    width: '100%',
    alignSelf: 'flex-end',
  },
});
