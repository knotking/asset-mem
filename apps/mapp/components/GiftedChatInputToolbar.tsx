import React from 'react';
import {
  View,
  Pressable,
  Image,
  ActivityIndicator,
  useColorScheme,
  Keyboard,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { InputToolbar, InputToolbarProps, Composer, Send } from 'react-native-gifted-chat';
import type { IMessage } from 'react-native-gifted-chat';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  Paperclip,
  Send as SendIcon,
  X,
  Square,
  AlertCircle,
  Camera,
  Images,
  Video,
  FileText,
} from 'lucide-react-native';
import type {
  FileAttachment,
  AnalysisOptionalAgent,
  CheckpointOptionalAgent,
  LocationData,
  PrimaryAgent,
} from '@homeapp/common/types';
import { CompactSettingsBar } from './CompactSettingsBar';
import { ChatSettingsModal } from './ChatSettingsModal';

const MAX_MESSAGE_LENGTH = 2000;

interface GiftedChatInputToolbarProps extends InputToolbarProps<IMessage> {
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
  searchLocation?: import('@homeapp/common/types').SearchLocationInput;
  onSearchLocationChange?: (
    searchLocation: import('@homeapp/common/types').SearchLocationInput | undefined
  ) => void;
  propertyAddress?: string;
}

export function GiftedChatInputToolbar(props: GiftedChatInputToolbarProps) {
  const {
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
    searchLocation,
    onSearchLocationChange,
    propertyAddress,
    ...inputToolbarProps
  } = props;

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showMenu, setShowMenu] = React.useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = React.useState(false);
  const [settingsModalTab, setSettingsModalTab] = React.useState<'agent' | 'location'>('agent');
  const slideAnim = React.useRef(new Animated.Value(500)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  const colors = React.useMemo(
    () => ({
      background: isDark ? 'hsl(0, 0%, 8%)' : 'hsl(0, 0%, 100%)',
      foreground: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(0, 0%, 3.9%)',
      border: isDark ? 'hsl(0, 0%, 28%)' : 'hsl(0, 0%, 89.8%)',
      mutedForeground: isDark ? 'hsl(0, 0%, 70%)' : 'hsl(0, 0%, 45.1%)',
    }),
    [isDark]
  );

  // Animate menu open/close
  React.useEffect(() => {
    if (showMenu) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showMenu, slideAnim, opacityAnim]);

  // Memoize attachment press handler to prevent recreation
  const handleAttachmentPressWithHaptic = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setShowMenu(true);
  }, []);

  const handleMenuClose = React.useCallback(() => {
    setShowMenu(false);
  }, []);

  const handleMenuOption = React.useCallback((action: () => void) => {
    setShowMenu(false);
    // Small delay to let menu close before opening camera/picker
    setTimeout(action, 100);
  }, []);

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
      const canSend = sendProps.text?.trim() || fileAttachment;

      // Override onSend to handle attachment-only messages
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
    [isSending, onStop, fileAttachment]
  );

  return (
    <View className="border-t border-border bg-light-background-alt px-4 pb-2 pt-3">
      {/* File Attachment Preview */}
      {fileAttachment && (
        <View className="mb-3">
          <View className="relative h-20 w-20 overflow-hidden rounded-xl border border-border bg-secondary">
            {/* Image Preview */}
            {fileAttachment.fileType.startsWith('image/') && (
              <Image
                source={{ uri: fileAttachment.uri }}
                className="h-full w-full"
                resizeMode="cover"
              />
            )}

            {/* Video Preview */}
            {fileAttachment.fileType.startsWith('video/') && (
              <>
                {fileAttachment.thumbnailUri ? (
                  <Image
                    source={{ uri: fileAttachment.thumbnailUri }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Icon as={Video} size={24} className="text-muted-foreground" />
                  </View>
                )}
              </>
            )}

            {/* Document/File Preview */}
            {!fileAttachment.fileType.startsWith('image/') &&
              !fileAttachment.fileType.startsWith('video/') && (
                <View className="h-full w-full items-center justify-center">
                  <Icon as={FileText} size={24} className="text-muted-foreground" />
                </View>
              )}

            {/* Loading Indicator */}
            {fileAttachment.progress < 100 && !fileAttachment.error && (
              <View className="absolute inset-0 items-center justify-center bg-black/40">
                <ActivityIndicator size="large" color="#ffffff" />
              </View>
            )}

            {/* Delete Button Overlay */}
            <Pressable
              onPress={onRemoveAttachment}
              className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-gray-500/80"
              accessibilityRole="button"
              accessibilityLabel="Remove attachment">
              <Icon as={X} size={14} className="text-white" />
            </Pressable>

            {/* Error Indicator */}
            {fileAttachment.error && (
              <View className="absolute inset-0 items-center justify-center bg-destructive/20">
                <Icon as={AlertCircle} size={24} className="text-destructive" />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Compact Settings Bar */}
      <CompactSettingsBar
        primaryAgent={primaryAgent}
        selectedOptionalAgents={selectedOptionalAgents}
        selectedCheckpointOptionalAgents={selectedCheckpointOptionalAgents}
        searchLocation={searchLocation}
        propertyAddress={propertyAddress}
        onOpenSettings={handleOpenSettings}
        onAgentPress={handleOpenAgentSettings}
        onLocationPress={handleOpenLocationSettings}
      />

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
        {/* Attachment Button */}
        <Pressable
          onPress={handleAttachmentPressWithHaptic}
          disabled={isSending || !!fileAttachment}
          className={`mb-[8px] h-8 w-8 items-center justify-center rounded-full ${
            fileAttachment ? 'bg-secondary' : 'bg-primary'
          }`}
          style={{
            opacity: fileAttachment ? 0.5 : 1,
          }}>
          <Icon
            as={Paperclip}
            size={16}
            className={fileAttachment ? 'text-muted-foreground' : 'text-primary-foreground'}
          />
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

      {/* Animated Slide-up Menu */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -1000,
          bottom: -1000,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          opacity: opacityAnim,
          zIndex: 50,
        }}
        pointerEvents={showMenu ? 'auto' : 'none'}>
        <Pressable onPress={handleMenuClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY: slideAnim }],
          zIndex: 51,
        }}
        className="rounded-t-3xl bg-background px-4 pb-4 pt-3 shadow-2xl"
        pointerEvents={showMenu ? 'auto' : 'none'}>
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">Add Attachment</Text>
          <Pressable onPress={handleMenuClose} className="h-7 w-7 items-center justify-center">
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Pressable>
        </View>

        <View className="gap-2">
          {/* Row 1: Take Photo & Record Video */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => handleMenuOption(onTakePhoto)}
              className="flex-1 items-center gap-1.5 rounded-xl bg-secondary/50 p-3 active:bg-secondary">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Camera} size={20} className="text-primary" />
              </View>
              <Text className="text-xs font-semibold text-foreground">Take Photo</Text>
            </Pressable>

            <Pressable
              onPress={() => handleMenuOption(onRecordVideo)}
              className="flex-1 items-center gap-1.5 rounded-xl bg-secondary/50 p-3 active:bg-secondary">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Video} size={20} className="text-primary" />
              </View>
              <Text className="text-xs font-semibold text-foreground">Record Video</Text>
            </Pressable>
          </View>

          {/* Row 2: Gallery & Files */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => handleMenuOption(onSelectFromLibrary)}
              className="flex-1 items-center gap-1.5 rounded-xl bg-secondary/50 p-3 active:bg-secondary">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Images} size={20} className="text-primary" />
              </View>
              <Text className="text-xs font-semibold text-foreground">Gallery</Text>
            </Pressable>

            <Pressable
              onPress={() => handleMenuOption(onSelectFiles)}
              className="flex-1 items-center gap-1.5 rounded-xl bg-secondary/50 p-3 active:bg-secondary">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon as={FileText} size={20} className="text-primary" />
              </View>
              <Text className="text-xs font-semibold text-foreground">Files</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
