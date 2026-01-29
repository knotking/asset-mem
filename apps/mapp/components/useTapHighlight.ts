import { useTapHighlight } from './TapHighlightProvider';
import { useCallback } from 'react';

/**
 * Hook to add tap highlighting to Pressable components
 * Usage:
 *   const { showTapHighlight } = useTapHighlightHandler();
 *   <Pressable onPressIn={(e) => showTapHighlight(e)} ... />
 */
export function useTapHighlightHandler() {
  const { showTap, enabled } = useTapHighlight();
  
  const showTapHighlight = useCallback(
    (event: any) => {
      if (enabled && event?.nativeEvent) {
        const { pageX, pageY } = event.nativeEvent;
        showTap(pageX, pageY);
      }
    },
    [enabled, showTap]
  );

  return { 
    showTapHighlight, 
    enabled: enabled ?? false 
  };
}
