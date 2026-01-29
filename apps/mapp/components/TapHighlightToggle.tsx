import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Toggle } from '@/components/ui/toggle';
import { useTapHighlight } from './TapHighlightProvider';
import { Circle } from 'lucide-react-native';

/**
 * Toggle component to enable/disable tap highlighting for demo videos
 */
export function TapHighlightToggle() {
  const { enabled, setEnabled } = useTapHighlight();

  return (
    <View className="rounded-lg border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">Tap Highlighting:</Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            Show visual indicators for taps during demo videos
          </Text>
        </View>
        <Toggle
          pressed={enabled}
          onPressedChange={setEnabled}
          aria-label="Toggle tap highlighting">
          <Circle size={16} fill={enabled ? 'currentColor' : 'none'} />
        </Toggle>
      </View>
    </View>
  );
}

/**
 * Floating button to toggle tap highlighting (useful for demo videos)
 */
export function TapHighlightFloatingButton() {
  const { enabled, setEnabled } = useTapHighlight();

  return (
    <Pressable
      onPress={() => setEnabled(!enabled)}
      className="absolute bottom-20 right-4 z-50 h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg"
      style={{ elevation: 5 }}
      accessibilityRole="button"
      accessibilityLabel={enabled ? 'Disable tap highlighting' : 'Enable tap highlighting'}>
      <View className="h-6 w-6 items-center justify-center rounded-full bg-white/20">
        <View
          className={`h-3 w-3 rounded-full ${enabled ? 'bg-white' : 'bg-white/50'}`}
        />
      </View>
    </Pressable>
  );
}
