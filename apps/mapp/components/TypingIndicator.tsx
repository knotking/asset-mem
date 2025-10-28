import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

export default function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 200),
      animateDot(dot3, 400),
    ]);

    animation.start();

    return () => animation.stop();
  }, [dot1, dot2, dot3]);

  const dotStyle = (animatedValue: Animated.Value) => ({
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
