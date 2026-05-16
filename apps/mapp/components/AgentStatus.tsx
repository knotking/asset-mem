import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Sparkles } from 'lucide-react-native';
import type { AgentStep } from '@homeapp/common/types';
import { useDebouncedThinkingStatus } from '@homeapp/common/hooks/use-debounced-thinking-status';
import { Text } from '@/components/ui/text';

type Props = {
  steps: AgentStep[];
  /** When set, progressive checkpoint JSON drives the ticker (matches footer). */
  messageContent?: string | null;
};

function SparkleAnimation() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <Icon as={Sparkles} size={16} className="text-primary" />
    </Animated.View>
  );
}

/** One line with a soft shimmer (avoids multi-line breaks from per-chunk layout). */
function AnimatedThinkingText({ text }: { text: string }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  const display = text?.trim() || ' ';

  return (
    <Animated.Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{ minWidth: 0, flexShrink: 1, opacity }}
      className="text-sm font-medium text-primary">
      {display}
    </Animated.Text>
  );
}

export function AgentStatus({ steps, messageContent }: Props) {
  const { header: headerText, preview: headerPreview } = useDebouncedThinkingStatus(
    steps,
    { messageContent },
  );

  if (!steps || steps.length === 0) return null;

  return (
    <View className="self-start max-w-full flex-row items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
      <View className="shrink-0">
        <SparkleAnimation />
      </View>
      <View className="min-w-0 flex-shrink flex-row items-center gap-1">
        <AnimatedThinkingText text={headerText} />
        {headerPreview ? (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="min-w-0 flex-shrink text-xs text-muted-foreground">
            {' · '}
            {headerPreview}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
