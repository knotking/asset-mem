import * as React from 'react';
import { AppState, type AppStateStatus } from 'react-native';

type UseSecretTapOptions = {
  requiredTaps?: number;
  windowMs?: number;
  /** When true, hide revealed content if the app goes to background/inactive. */
  resetOnBackground?: boolean;
};

/** Toggle reveal after `requiredTaps` presses within `windowMs`. */
export function useSecretTapReveal({
  requiredTaps = 5,
  windowMs = 2000,
  resetOnBackground = false,
}: UseSecretTapOptions = {}) {
  const [revealed, setRevealed] = React.useState(false);
  const tapCountRef = React.useRef(0);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSecretTap = React.useCallback(() => {
    tapCountRef.current += 1;

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, windowMs);

    if (tapCountRef.current >= requiredTaps) {
      tapCountRef.current = 0;
      setRevealed((value) => !value);
    }
  }, [requiredTaps, windowMs]);

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!resetOnBackground) return;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        tapCountRef.current = 0;
        setRevealed(false);
      }
    });

    return () => subscription.remove();
  }, [resetOnBackground]);

  return { revealed, onSecretTap, setRevealed };
}
