import { useCallback, useEffect, useRef } from "react";
import { ThemePreference, parseThemePreference } from "../types";
import { useAuth } from "../contexts/auth-context";
import { usePreferences } from "../contexts/preferences-context";

/**
 * Syncs theme with Firestore `users/{uid}/preferences/user.theme` when signed in.
 * Call `applyTheme` from the platform theme API (next-themes, nativewind, etc.).
 */
export function useThemePreference(applyTheme: (theme: ThemePreference) => void) {
  const { user } = useAuth();
  const { preferences, loading, updatePreferences } = usePreferences();
  const lastAppliedRef = useRef<ThemePreference | null>(null);

  useEffect(() => {
    if (user && loading) return;
    const theme = parseThemePreference(preferences?.theme) ?? "dark";
    if (theme === lastAppliedRef.current) return;
    lastAppliedRef.current = theme;
    applyTheme(theme);
  }, [user, loading, preferences?.theme, applyTheme]);

  useEffect(() => {
    if (!user) {
      lastAppliedRef.current = null;
    }
  }, [user]);

  const persistTheme = useCallback(
    async (theme: ThemePreference) => {
      lastAppliedRef.current = theme;
      applyTheme(theme);
      if (user) {
        await updatePreferences({ theme });
      }
    },
    [user, applyTheme, updatePreferences]
  );

  return {
    savedTheme: preferences?.theme,
    loading: Boolean(user && loading),
    persistTheme,
  };
}
