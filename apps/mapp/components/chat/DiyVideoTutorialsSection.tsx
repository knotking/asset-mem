import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ChevronRight, Play, Youtube } from 'lucide-react-native';
import { LazyYouTubePlayer } from '@/lib/lazy-youtube-player';
import { getYouTubeThumbnailUrl, getYouTubeVideoId } from '@/lib/youtube-utils';
import { AccordionMountContext } from '@/lib/accordion-mount-context';
import { StructuredReportSheet } from '@/components/chat/StructuredReportSheet';

export type DiyVideoTutorial = {
  title?: string;
  url: string;
  description?: string;
};

type Props = {
  videos: DiyVideoTutorial[];
};

function getSheetVideoOrder(videos: DiyVideoTutorial[], focusIndex: number): DiyVideoTutorial[] {
  if (focusIndex <= 0 || focusIndex >= videos.length) {
    return videos;
  }

  const focused = videos[focusIndex];
  return [focused, ...videos.filter((_, index) => index !== focusIndex)];
}

function DiyVideoTutorialPlayer({
  videoUrl,
  autoPlay = false,
}: {
  videoUrl: string;
  autoPlay?: boolean;
}) {
  return (
    <View className="mb-2 w-full overflow-hidden rounded-md">
      <LazyYouTubePlayer videoUrl={videoUrl} autoPlay={autoPlay} />
    </View>
  );
}

type VideoPreviewRowProps = {
  video: DiyVideoTutorial;
  index: number;
  onPress: (index: number) => void;
};

function VideoPreviewRow({ video, index, onPress }: VideoPreviewRowProps) {
  const title = video.title?.trim() || 'Video tutorial';
  const videoId = getYouTubeVideoId(video.url);
  const thumbnailUri = videoId ? getYouTubeThumbnailUrl(videoId) : null;

  return (
    <Pressable
      onPress={() => onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={`Play video tutorial: ${title}`}
      className="flex-row items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 active:opacity-80">
      {thumbnailUri ? (
        <View className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-muted">
          <Image
            source={{ uri: thumbnailUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <View className="absolute inset-0 items-center justify-center bg-black/35">
            <Icon as={Play} size={22} className="text-white" fill="white" />
          </View>
        </View>
      ) : (
        <View className="aspect-video w-24 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon as={Youtube} size={22} className="text-muted-foreground" />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
          {title}
        </Text>
        {video.description?.trim() ? (
          <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
            {video.description.trim()}
          </Text>
        ) : null}
      </View>
      <Icon as={ChevronRight} size={18} className="shrink-0 text-muted-foreground" />
    </Pressable>
  );
}

export function DiyVideoTutorialsSection({ videos }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const count = videos.length;

  const sheetVideos = useMemo(
    () => (sheetVisible ? getSheetVideoOrder(videos, focusedIndex) : []),
    [sheetVisible, videos, focusedIndex]
  );

  const openSheet = useCallback((index: number) => {
    setFocusedIndex(index);
    setSheetVisible(true);
  }, []);

  const handleOpenAll = useCallback(() => {
    openSheet(0);
  }, [openSheet]);

  const handleCloseSheet = useCallback(() => {
    setSheetVisible(false);
  }, []);

  if (count === 0) {
    return null;
  }

  return (
    <>
      <View className="mb-3">
        <Text className="mb-2 text-sm font-semibold text-warning">Video Tutorials</Text>
        <View className="mb-3 gap-2">
          {videos.map((video, index) => (
            <VideoPreviewRow key={`${video.url}-${index}`} video={video} index={index} onPress={openSheet} />
          ))}
        </View>
        <Button
          variant="outline"
          className="w-full"
          accessibilityRole="button"
          accessibilityLabel={`View all ${count} video tutorials`}
          onPress={handleOpenAll}>
          <View className="flex-row items-center justify-center gap-2">
            <Icon as={Youtube} size={16} className="text-foreground" />
            <Text>View all video tutorials ({count})</Text>
          </View>
        </Button>
      </View>

      {sheetVisible ? (
        <StructuredReportSheet
          visible={sheetVisible}
          onClose={handleCloseSheet}
          title={`Video tutorials (${count})`}>
          <AccordionMountContext.Provider value={true}>
            {sheetVideos.map((video, index) => (
              <View key={video.url} className="mb-4 border-b border-border pb-4">
                <DiyVideoTutorialPlayer videoUrl={video.url} autoPlay={index === 0} />
                <Text className="mt-1 text-sm font-medium text-foreground">
                  {video.title?.trim() || 'Video tutorial'}
                </Text>
                {video.description?.trim() ? (
                  <Text className="mt-1 text-xs text-muted-foreground">{video.description.trim()}</Text>
                ) : null}
                <Button
                  onPress={() => Linking.openURL(video.url)}
                  variant="outline"
                  className="mt-2 w-full">
                  <Text>Watch on YouTube</Text>
                </Button>
              </View>
            ))}
          </AccordionMountContext.Provider>
        </StructuredReportSheet>
      ) : null}
    </>
  );
}
