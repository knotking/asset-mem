import React, { useContext, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { AccordionMountContext } from '@/lib/accordion-mount-context';
import { getYouTubeVideoId } from '@/lib/youtube-utils';

type LazyYouTubePlayerProps = {
  videoId?: string;
  videoUrl?: string;
  height?: number;
  testID?: string;
};

/**
 * Defers Youtube WebView mount until the parent accordion section is expanded
 * and layout width is known. Outside accordions, mounts once layout is ready.
 */
export function LazyYouTubePlayer({
  videoId: videoIdProp,
  videoUrl,
  height = 192,
  testID = 'lazy-youtube-player',
}: LazyYouTubePlayerProps) {
  const accordionExpanded = useContext(AccordionMountContext);
  const [containerWidth, setContainerWidth] = useState(0);
  const videoId = useMemo(
    () => videoIdProp ?? (videoUrl ? getYouTubeVideoId(videoUrl) : null),
    [videoIdProp, videoUrl]
  );

  if (!videoId) {
    return null;
  }

  const playerHeight =
    containerWidth > 0 ? (containerWidth * 9) / 16 : height;
  const readyToMount = accordionExpanded && containerWidth > 0;
  const reservedHeight = accordionExpanded ? playerHeight : 0;

  return (
    <View
      testID={`${testID}-shell`}
      style={[styles.shell, reservedHeight > 0 && { minHeight: reservedHeight }]}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        if (width > 0 && width !== containerWidth) {
          setContainerWidth(width);
        }
      }}>
      {readyToMount ? (
        <View testID={testID} style={styles.playerWrap}>
          <YoutubePlayer
            height={playerHeight}
            videoId={videoId}
            play={false}
            webViewProps={{
              androidLayerType: 'hardware',
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    marginVertical: 8,
  },
  playerWrap: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 8,
  },
});
