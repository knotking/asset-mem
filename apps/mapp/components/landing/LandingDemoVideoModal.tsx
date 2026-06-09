import React from 'react';
import { Modal, Pressable, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LazyYouTubePlayer } from '@/lib/lazy-youtube-player';
import { AccordionMountContext } from '@/lib/accordion-mount-context';
import { openExternalWebUrl } from '@/lib/open-external-url';

const MODAL_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.85)',
  card: '#14141c',
  border: 'rgba(255, 255, 255, 0.08)',
  foreground: '#fafafa',
  mutedForeground: 'rgba(255, 255, 255, 0.65)',
};

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
  const { width } = useWindowDimensions();
  const playerWidth = Math.min(width - 32, 560);

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

              <TouchableOpacity
                onPress={() => {
                  void openExternalWebUrl(videoUrl);
                }}
                style={{
                  marginTop: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: MODAL_COLORS.border,
                  alignItems: 'center',
                }}
                accessibilityRole="button"
                accessibilityLabel="Watch on YouTube">
                <Text style={{ fontSize: 14, fontWeight: '500', color: MODAL_COLORS.foreground }}>
                  Watch on YouTube
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
