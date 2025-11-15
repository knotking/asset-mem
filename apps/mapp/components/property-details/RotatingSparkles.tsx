import * as React from 'react';
import { Animated, Easing } from 'react-native';
import { Sparkles } from 'lucide-react-native';

export function RotatingSparkles({ size = 14, color = '#3B82F6' }: { size?: number; color?: string }) {
  const spinValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, [spinValue]);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Sparkles size={size} color={color} />
    </Animated.View>
  );
}
