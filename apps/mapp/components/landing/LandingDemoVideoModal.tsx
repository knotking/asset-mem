import React, { useEffect, useState } from 'react';
import {
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LazyYouTubePlayer } from '@/lib/lazy-youtube-player';
import { AccordionMountContext } from '@/lib/accordion-mount-context';
import { RecordingTestIds } from '@/lib/recording-test-ids';

const MODAL_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.85)',
  card: '#14141c',
  border: 'rgba(255, 255, 255, 0.08)',
  foreground: '#fafafa',
  playerPlaceholder: '#0a0a0f',
};

/** Phones stay compact; tablets use a wider embed for higher YouTube auto quality. */
const PHONE_MAX_PLAYER_WIDTH = 560;
const TABLET_MIN_SHORT_EDGE = 600;
const TABLET_MAX_PLAYER_WIDTH = 1680;

function getDemoPlayerWidth(windowWidth: number, windowHeight: number): number {
  const isTablet = Math.min(windowWidth, windowHeight) >= TABLET_MIN_SHORT_EDGE;
  if (isTablet) {
    return Math.min(windowWidth - 48, TABLET_MAX_PLAYER_WIDTH);
  }
  return Math.min(windowWidth - 32, PHONE_MAX_PLAYER_WIDTH);
}

type LandingDemoVideoModalProps = {
  visible: boolean;
  onClose: () => void;
  videoUrl: string;
};

export function LandingDemoVideoModal({
  visible,
  onClose,
  videoUrl,
}: LandingDemoVideoModalProps) {
  const { width, height } = useWindowDimensions();
  const playerWidth = getDemoPlayerWidth(width, height);
  const [mountPlayer, setMountPlayer] = useState(false);

  useEffect(() => {
    if (!visible) {
      setMountPlayer(false);
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      setMountPlayer(true);
    });

    return () => task.cancel();
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <View
        testID={RecordingTestIds.landingDemo.modal}
        style={styles.overlay}
        pointerEvents="box-none">
        {/* Backdrop — no accessibility label (Maestro was dismissing via "Close demo video") */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <View style={[styles.card, { width: playerWidth }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Watch Demo</Text>
            <Pressable
              testID={RecordingTestIds.landingDemo.closeVideo}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Close demo video"
              onPress={onClose}
              hitSlop={8}>
              <Icon as={X} size={20} className="text-foreground" />
            </Pressable>
          </View>

          <View style={styles.playerContainer}>
            {mountPlayer ? (
              <AccordionMountContext.Provider value={true}>
                <LazyYouTubePlayer
                  videoUrl={videoUrl}
                  autoPlay
                  testID="landing-demo-youtube"
                />
              </AccordionMountContext.Provider>
            ) : (
              <View style={styles.playerPlaceholder} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: MODAL_COLORS.overlay,
  },
  card: {
    alignSelf: 'center',
    zIndex: 1,
    elevation: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: MODAL_COLORS.card,
    borderWidth: 1,
    borderColor: MODAL_COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: MODAL_COLORS.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: MODAL_COLORS.foreground,
  },
  playerContainer: {
    padding: 12,
  },
  playerPlaceholder: {
    aspectRatio: 16 / 9,
    borderRadius: 8,
    backgroundColor: MODAL_COLORS.playerPlaceholder,
  },
});
