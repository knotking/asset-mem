import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

export type TypingIndicatorVariant = 'bounce' | 'wave';

type Props = {
  variant?: TypingIndicatorVariant;
};

const WAVE_DURATION_MS = 650;
const WAVE_STAGGER_MS = 120;
const BOUNCE_DURATION_MS = 400;
const BOUNCE_STAGGER_MS = 200;

export default function TypingIndicator({ variant = 'bounce' }: Props) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = variant === 'wave' ? WAVE_DURATION_MS : BOUNCE_DURATION_MS;
    const stagger = variant === 'wave' ? WAVE_STAGGER_MS : BOUNCE_STAGGER_MS;

    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, stagger),
      animateDot(dot3, stagger * 2),
    ]);

    animation.start();

    return () => animation.stop();
  }, [dot1, dot2, dot3, variant]);

  const bounceStyle = (animatedValue: Animated.Value) => ({
    opacity: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        scale: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }),
      },
    ],
  });

  const waveStyle = (animatedValue: Animated.Value) => ({
    opacity: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.45, 1],
    }),
    transform: [
      {
        translateY: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [2, -3],
        }),
      },
    ],
  });

  const dotStyle = variant === 'wave' ? waveStyle : bounceStyle;

  return (
    <View className="flex-row items-center gap-1.5">
      <Animated.View
        style={dotStyle(dot1)}
        className="h-2 w-2 rounded-full bg-muted-foreground"
      />
      <Animated.View
        style={dotStyle(dot2)}
        className="h-2 w-2 rounded-full bg-muted-foreground"
      />
      <Animated.View
        style={dotStyle(dot3)}
        className="h-2 w-2 rounded-full bg-muted-foreground"
      />
    </View>
  );
}
