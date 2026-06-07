import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { consumePendingSettingsHubReset } from '@/lib/settings-navigation';

/**
 * When a settings sub-screen was opened as a cross-tab peek (home/property header),
 * back returns to the origin tab but leaves the Settings stack on the sub-screen.
 * On the next Settings tab focus, reset to the hub.
 */
export function SettingsTabFocusReset() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (!consumePendingSettingsHubReset()) {
        return;
      }
      router.replace('/(tabs)/settings');
    }, [router])
  );

  return null;
}
