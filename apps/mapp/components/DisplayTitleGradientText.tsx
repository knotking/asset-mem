import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Text } from '@/components/ui/text';

type Props = {
  children: string;
  active: boolean;
};

/** Soft primary shimmer for structured display titles while a turn is in flight. */
export function DisplayTitleGradientText({ children, active }: Props) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      shimmerAnim.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1250,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1250,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active, shimmerAnim]);

  if (!active) {
    return <Text className="text-md font-semibold text-foreground">{children}</Text>;
  }

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  return (
    <Animated.Text
      style={{ opacity }}
      className="text-md font-semibold text-primary">
      {children}
    </Animated.Text>
  );
}
