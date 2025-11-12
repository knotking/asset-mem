import React from 'react';
import {
  View,
  Pressable,
  Modal,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { InputToolbar, InputToolbarProps, Composer } from 'react-native-gifted-chat';
import type { IMessage } from 'react-native-gifted-chat';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Paperclip,
  Send as SendIcon,
  X,
  Square,
  AlertCircle,
  Camera,
  Video,
  Images,
  ShieldCheck,
  Hammer,
  Wrench,
  BadgeDollarSign,
  FileText,
} from 'lucide-react-native';
import type { FileAttachment, AnalysisOptionalAgent } from '@homeapp/common/types';
import { ANALYSIS_OPTIONAL_AGENTS } from '@homeapp/common/types';

const OPTIONAL_AGENT_OPTIONS: {
  id: AnalysisOptionalAgent;
  label: string;
  icon: typeof ShieldCheck;
}[] = [
  { id: 'coverage', label: 'Coverage', icon: ShieldCheck },
  { id: 'diy', label: 'DIY', icon: Hammer },
  { id: 'service', label: 'Service', icon: Wrench },
  { id: 'cost', label: 'Cost', icon: BadgeDollarSign },
];

interface GiftedChatInputToolbarProps extends InputToolbarProps<IMessage> {
  fileAttachment: FileAttachment | null;
  onAttachmentPress: () => void;
  onRemoveAttachment: () => void;
  selectedOptionalAgents: AnalysisOptionalAgent[];
  onToggleOptionalAgent: (agent: AnalysisOptionalAgent) => void;
  isSending: boolean;
  onStop: () => void;
  attachmentOptionsVisible: boolean;
  onCloseAttachmentOptions: () => void;
  onTakePhoto: () => void;
  onRecordVideo: () => void;
  onSelectFromLibrary: () => void;
}

export function GiftedChatInputToolbar(props: GiftedChatInputToolbarProps) {
  const {
    fileAttachment,
    onAttachmentPress,
    onRemoveAttachment,
    selectedOptionalAgents,
    onToggleOptionalAgent,
    isSending,
    onStop,
    attachmentOptionsVisible,
    onCloseAttachmentOptions,
    onTakePhoto,
    onRecordVideo,
    onSelectFromLibrary,
    ...inputToolbarProps
  } = props;

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Convert HSL to hex for TextInput (which doesn't support CSS variables)
  // Light mode: --background: 0 0% 100% (white), --foreground: 0 0% 3.9% (near black)
  // Dark mode: --background: 0 0% 8% (dark gray), --foreground: 0 0% 98% (near white)
  // Light mode: --border: 0 0% 89.8%, --muted-foreground: 0 0% 45.1%
  // Dark mode: --border: 0 0% 28%, --muted-foreground: 0 0% 70%

  const colors = {
    background: isDark ? 'hsl(0, 0%, 8%)' : 'hsl(0, 0%, 100%)',
    foreground: isDark ? 'hsl(0, 0%, 98%)' : 'hsl(0, 0%, 3.9%)',
    border: isDark ? 'hsl(0, 0%, 28%)' : 'hsl(0, 0%, 89.8%)',
    mutedForeground: isDark ? 'hsl(0, 0%, 70%)' : 'hsl(0, 0%, 45.1%)',
  };

  return (
    <>
      <Modal
        visible={attachmentOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={onCloseAttachmentOptions}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={onCloseAttachmentOptions} />
          <View className="space-y-3 rounded-t-3xl bg-background px-4 pb-6 pt-4">
            <Text className="text-base font-semibold text-foreground">Attach media</Text>
            <Button variant="outline" className="justify-start gap-3" onPress={onTakePhoto}>
              <Icon as={Camera} size={20} className="text-foreground" />
              <Text className="text-sm text-foreground">Take photo</Text>
            </Button>
            <Button variant="outline" className="justify-start gap-3" onPress={onRecordVideo}>
              <Icon as={Video} size={20} className="text-foreground" />
              <Text className="text-sm text-foreground">Record video</Text>
            </Button>
            <Button variant="outline" className="justify-start gap-3" onPress={onSelectFromLibrary}>
              <Icon as={Images} size={20} className="text-foreground" />
              <Text className="text-sm text-foreground">Choose from library</Text>
            </Button>
          </View>
        </View>
      </Modal>

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

        {/* Optional Agent Toggles */}
        <View className="mb-3">
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="rounded-full border border-border bg-background px-3 py-1">
              <Text className="text-[10px] font-semibold uppercase text-muted-foreground">
                Triage required
              </Text>
            </View>
            {OPTIONAL_AGENT_OPTIONS.map((option) => {
              const isSelected = selectedOptionalAgents.includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  onPress={() => onToggleOptionalAgent(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={`flex-row items-center gap-1 rounded-full border px-3 py-1 ${
                    isSelected ? 'border-primary bg-primary' : 'border-border bg-transparent'
                  }`}>
                  <Icon
                    as={option.icon}
                    size={14}
                    className={isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}
                  />
                  <Text
                    className={`text-xs font-medium ${
                      isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selectedOptionalAgents.length === 0 && (
            <Text className="mt-1 text-xs text-muted-foreground">Only triage will run.</Text>
          )}
        </View>

        {/* Input Row */}
        <View style={{ position: 'relative' }}>
          {/* Attachment Icon Overlay */}
          <Pressable
            onPress={onAttachmentPress}
            disabled={isSending || !!fileAttachment}
            style={{
              position: 'absolute',
              left: 10,
              bottom: 12,
              zIndex: 10,
            }}>
            <Icon
              as={Paperclip}
              size={20}
              className={fileAttachment ? 'text-muted-foreground/50' : 'text-muted-foreground'}
            />
          </Pressable>

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
            renderComposer={(composerProps) => (
              <Composer
                {...composerProps}
                textInputStyle={{
                  marginLeft: 2,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  paddingLeft: 34,
                  paddingRight: 12,
                  paddingTop: 10,
                  paddingBottom: 10,
                  fontSize: 14,
                  minHeight: 40,
                  maxHeight: 120,
                  lineHeight: 20,
                  color: colors.foreground,
                }}
                textInputAutoFocus={false}
                placeholder="Type a message..."
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
            )}
            renderSend={(sendProps) => (
              <View style={{ marginBottom: 5, marginLeft: 4 }}>
                {isSending ? (
                  <Pressable
                    onPress={onStop}
                    className="h-8 w-8 items-center justify-center rounded-full bg-destructive"
                    accessibilityRole="button"
                    accessibilityLabel="Stop sending">
                    <Icon as={Square} size={16} className="text-primary-foreground" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      const hasContent = sendProps.text?.trim() || fileAttachment?.downloadURL;
                      if (hasContent && sendProps.onSend) {
                        sendProps.onSend({ text: sendProps.text?.trim() || '' } as any, true);
                      }
                    }}
                    disabled={!sendProps.text?.trim() && !fileAttachment?.downloadURL}
                    className={`h-8 w-8 items-center justify-center rounded-full ${
                      sendProps.text?.trim() || fileAttachment?.downloadURL
                        ? 'bg-primary'
                        : 'bg-secondary'
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel="Send message">
                    <Icon
                      as={SendIcon}
                      size={16}
                      className={
                        sendProps.text?.trim() || fileAttachment?.downloadURL
                          ? 'text-primary-foreground'
                          : 'text-muted-foreground'
                      }
                    />
                  </Pressable>
                )}
              </View>
            )}
          />
        </View>
      </View>
    </>
  );
}
