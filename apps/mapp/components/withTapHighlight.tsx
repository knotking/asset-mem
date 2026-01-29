import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import { useTapHighlight } from './TapHighlightProvider';

/**
 * Higher Order Component that wraps a Pressable component with tap highlighting
 * Usage: const HighlightedPressable = withTapHighlight(Pressable);
 */
export function withTapHighlight<P extends PressableProps>(
  Component: React.ComponentType<P>
) {
  return function TapHighlightedComponent(props: P) {
    const { showTap, enabled } = useTapHighlight();

    const handlePressIn = (event: any) => {
      if (enabled && event?.nativeEvent) {
        const { pageX, pageY } = event.nativeEvent;
        showTap(pageX, pageY);
      }
      props.onPressIn?.(event);
    };

    return <Component {...props} onPressIn={handlePressIn} />;
  };
}

/**
 * Wrapper component for Pressable that adds tap highlighting
 */
export function TapHighlightPressable({ children, ...props }: PressableProps) {
  const { showTap, enabled } = useTapHighlight();

  const handlePressIn = (event: any) => {
    if (enabled && event?.nativeEvent) {
      const { pageX, pageY } = event.nativeEvent;
      showTap(pageX, pageY);
    }
    props.onPressIn?.(event);
  };

  return (
    <Pressable {...props} onPressIn={handlePressIn}>
      {children}
    </Pressable>
  );
}
