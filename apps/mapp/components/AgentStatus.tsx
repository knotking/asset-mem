import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Sparkles } from 'lucide-react-native';
import type { AgentStep } from '@homeapp/common/types';

type Props = {
  steps: AgentStep[];
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

function AnimatedThinkingText({ text }: { text: string }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnim]);

  const opacity1 = shimmerAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.5, 1, 0.5, 0.3, 0.5],
  });

  const opacity2 = shimmerAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.3, 0.5, 1, 0.5, 0.3],
  });

  const opacity3 = shimmerAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.5, 0.3, 0.5, 1, 0.5],
  });

  return (
    <View className="flex-row">
      <Animated.Text style={{ opacity: opacity1 }} className="font-medium text-primary">
        {text.slice(0, Math.ceil(text.length / 3))}
      </Animated.Text>
      <Animated.Text style={{ opacity: opacity2 }} className="font-medium text-primary">
        {text.slice(Math.ceil(text.length / 3), Math.ceil((text.length * 2) / 3))}
      </Animated.Text>
      <Animated.Text style={{ opacity: opacity3 }} className="font-medium text-primary">
        {text.slice(Math.ceil((text.length * 2) / 3))}
      </Animated.Text>
    </View>
  );
}

export function AgentStatus({ steps }: Props) {
  if (!steps || steps.length === 0) return null;

  const thinkingText = 'Thinking...';

  return (
    <View
      className="w-full rounded-xl border border-border bg-background p-4 shadow-sm"
      style={{ minWidth: 180 }}>
      <View className="flex-row items-center gap-2">
        <SparkleAnimation />
        <AnimatedThinkingText text={thinkingText} />
      </View>
    </View>
  );
}
