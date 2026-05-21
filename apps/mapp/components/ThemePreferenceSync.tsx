import * as React from 'react';
import { useColorScheme } from 'nativewind';
import { ThemePreference } from '@homeapp/common/types';
import { useThemePreference } from '@homeapp/common/hooks/use-theme-preference';

/**
 * Applies Firestore theme preference to nativewind when the user signs in
 * or when preference changes on another device.
 */
export function ThemePreferenceSync() {
  const { setColorScheme } = useColorScheme();
  const applyTheme = React.useCallback(
    (theme: ThemePreference) => {
      setColorScheme(theme);
    },
    [setColorScheme],
  );
  useThemePreference(applyTheme);
  return null;
}
