import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Sparkles } from 'lucide-react-native';
import type { AgentStep } from '@asset-mem/common/types';
import { useDebouncedThinkingStatus } from '@asset-mem/common/hooks/use-debounced-thinking-status';
import { Text } from '@/components/ui/text';
import TypingIndicator from './TypingIndicator';

type Props = {
  steps: AgentStep[];
  /** Lifecycle strip header (proxy/engine); omitted when copy suppressed. */
  lifecycleHeader?: string | null;
  /** First-turn proxy lifecycle uses wave dots instead of sparkles. */
  useProxyWaveIndicator?: boolean;
  /** Structured payload from message `contentJson`. */
  messageContentJson?: Record<string, unknown> | null;
  accordionAnalysis?: Record<string, unknown> | null;
  /** Local stream in-flight turn for synthesis gap UX. */
  isTurnInFlight?: boolean;
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

export function AgentStatus({
  steps,
  lifecycleHeader,
  useProxyWaveIndicator = false,
  messageContentJson,
  accordionAnalysis,
  isTurnInFlight = false,
}: Props) {
  const hasSteps = (steps?.length ?? 0) > 0;
  const fromSteps = useDebouncedThinkingStatus(hasSteps ? steps : null, {
    messageContentJson,
    accordionAnalysis,
    isTurnInFlight,
  });
  const headerText = hasSteps
    ? fromSteps.header
    : (lifecycleHeader?.trim() ?? '');
  const headerPreview = hasSteps ? fromSteps.preview : null;

  const showStrip =
    hasSteps || !!headerText || useProxyWaveIndicator;
  if (!showStrip) return null;

  return (
    <View className="self-start max-w-full flex-row items-start gap-2 rounded-lg border border-border bg-background/50 px-4 py-3 shadow-sm">
      <View className="mt-0.5 shrink-0">
        {useProxyWaveIndicator ? (
          <TypingIndicator variant="wave" />
        ) : (
          <SparkleAnimation />
        )}
      </View>
      <View className="min-w-0 flex-shrink flex-row items-center gap-1">
        {headerText ? (
          <AnimatedThinkingText text={headerText} />
        ) : useProxyWaveIndicator ? (
          <View className="h-5" />
        ) : null}
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
