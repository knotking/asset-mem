'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { parseThemePreference, ThemePreference } from '@/lib/types';
import { useThemePreference } from '@/hooks/use-theme-preference';

/**
 * Applies Firestore theme preference via next-themes when the user signs in
 * or when preference changes on another device (e.g. mobile app).
 */
export function ThemePreferenceSync() {
  const { setTheme } = useTheme();
  const applyTheme = React.useCallback(
    (theme: ThemePreference) => setTheme(theme),
    [setTheme],
  );

  // Mobile handoff may include ?theme=dark|light before Firestore preferences load.
  React.useEffect(() => {
    const theme = parseThemePreference(
      new URLSearchParams(window.location.search).get('theme'),
    );
    if (theme) {
      setTheme(theme);
    }
  }, [setTheme]);

  useThemePreference(applyTheme);
  return null;
}
