import * as React from 'react';
import { Modal, View, Image, ScrollView, Dimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  X,
  Calendar,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Maximize,
  Download,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';

interface MediaFile {
  name: string;
  type: string;
  url: string;
  gsURI?: string;
  width?: number;
  height?: number;
}

interface MediaDetailModalProps {
  visible: boolean;
  file: MediaFile | null;
  onClose: () => void;
  createdAt?: Date;
}

export function MediaDetailModal({
  visible,
  file,
  onClose,
  createdAt,
}: MediaDetailModalProps) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;

  const isImage = file?.type.startsWith('image/');
  const isVideo = file?.type.startsWith('video/');
  const mediaUrl = file?.url;

  // Video player hook - always call but with conditional URL
  const videoPlayer = useVideoPlayer(isVideo && mediaUrl ? mediaUrl : '', (player) => {
    player.loop = false;
  });

  if (!file) return null;

  // Calculate display dimensions
  const getDisplayDimensions = () => {
    if (!file.width || !file.height) {
      return { width: screenWidth - 32, height: 300 };
    }

    const maxWidth = screenWidth - 32;
    const maxHeight = 400;
    const aspectRatio = file.width / file.height;

    let displayWidth = file.width;
    let displayHeight = file.height;

    if (displayWidth > maxWidth) {
      displayWidth = maxWidth;
      displayHeight = displayWidth / aspectRatio;
    }

    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * aspectRatio;
    }

    return { width: displayWidth, height: displayHeight };
  };

  const dimensions = getDisplayDimensions();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
              {file.name || 'Media Attachment'}
            </Text>
            {createdAt && (
              <Text className="text-xs text-muted-foreground">
                {format(createdAt, 'MMMM d, yyyy • h:mm a')}
              </Text>
            )}
          </View>
          <Button onPress={onClose} variant="ghost" size="icon">
            <Icon as={X} size={24} className="text-foreground" />
          </Button>
        </View>

        <ScrollView className="flex-1">
          {/* Media Preview */}
          <View className="items-center bg-muted py-6">
            <View
              style={{
                width: dimensions.width,
                height: dimensions.height,
                borderRadius: 12,
                overflow: 'hidden',
              }}>
              {mediaUrl ? (
                isVideo ? (
                  <VideoView
                    player={videoPlayer}
                    style={{ width: '100%', height: '100%' }}
                    fullscreenOptions={{ allowed: true }}
                    allowsPictureInPicture
                    nativeControls
                  />
                ) : isImage ? (
                  <Image
                    source={{ uri: mediaUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                  />
                ) : null
              ) : (
                <View className="h-full w-full items-center justify-center bg-secondary">
                  <Icon as={FileText} size={48} className="text-muted-foreground" />
                </View>
              )}
            </View>
          </View>

          {/* Media Information */}
          <View className="gap-6 p-4">
            {/* File Type */}
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <Icon
                  as={isImage ? ImageIcon : isVideo ? VideoIcon : FileText}
                  size={16}
                  className="text-foreground"
                />
              </View>
              <View>
                <Text className="text-xs text-muted-foreground">Type</Text>
                <Text className="font-medium text-foreground">{file.type}</Text>
              </View>
            </View>

            {/* Dimensions */}
            {(file.width || file.height) && (
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <Icon as={Maximize} size={16} className="text-foreground" />
                </View>
                <View>
                  <Text className="text-xs text-muted-foreground">Dimensions</Text>
                  <Text className="font-medium text-foreground">
                    {file.width} × {file.height} px
                  </Text>
                </View>
              </View>
            )}

            {/* Created Date */}
            {createdAt && (
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <Icon as={Calendar} size={16} className="text-foreground" />
                </View>
                <View>
                  <Text className="text-xs text-muted-foreground">Uploaded</Text>
                  <Text className="font-medium text-foreground">
                    {format(createdAt, 'PPpp')}
                  </Text>
                </View>
              </View>
            )}

            {/* Description */}
            <View className="rounded-lg border border-border bg-card p-4">
              <Text className="mb-2 font-semibold text-foreground">About This Attachment</Text>
              <Text className="text-sm leading-5 text-muted-foreground">
                {isImage
                  ? 'This image was uploaded as part of a message. It may contain property photos, documents, or diagnostic information.'
                  : isVideo
                    ? 'This video was uploaded as part of a message. It may contain property walkthroughs, issue demonstrations, or instructions.'
                    : 'This file was uploaded as part of a message.'}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View
          className="border-t border-border px-4 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <Button onPress={onClose} variant="outline" className="w-full">
            <Text className="text-foreground">Close</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

