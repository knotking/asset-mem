import React from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LazyYouTubePlayer } from '@/lib/lazy-youtube-player';
import { AccordionMountContext } from '@/lib/accordion-mount-context';

const MODAL_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.85)',
  card: '#14141c',
  border: 'rgba(255, 255, 255, 0.08)',
  foreground: '#fafafa',
  mutedForeground: 'rgba(255, 255, 255, 0.65)',
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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: MODAL_COLORS.overlay,
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close demo video">
        <Pressable
          style={{ width: playerWidth, alignSelf: 'center' }}
          onPress={(event) => event.stopPropagation()}>
          <View
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: MODAL_COLORS.card,
              borderWidth: 1,
              borderColor: MODAL_COLORS.border,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: MODAL_COLORS.border,
              }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: MODAL_COLORS.foreground,
                }}>
                Watch Demo
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close demo video">
                <Icon as={X} size={20} className="text-foreground" />
              </Pressable>
            </View>

            <View style={{ padding: 12 }}>
              <AccordionMountContext.Provider value={true}>
                <LazyYouTubePlayer
                  videoUrl={videoUrl}
                  autoPlay
                  testID="landing-demo-youtube"
                />
              </AccordionMountContext.Provider>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
