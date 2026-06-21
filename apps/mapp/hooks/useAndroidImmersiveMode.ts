import * as NavigationBar from 'expo-navigation-bar';
import type { NavigationBarBehavior } from 'expo-navigation-bar';
import { setStatusBarHidden } from 'expo-status-bar';
import * as React from 'react';
import { Platform } from 'react-native';
import { createLogger } from '@/lib/logger';

const immersiveLog = createLogger('immersive');

/**
 * Android immersive is off by default — toggling StatusBar / nav bar visibility
 * conflicts with GiftedChat keyboard layout on physical Android devices.
 * Set `EXPO_PUBLIC_ANDROID_IMMERSIVE=true` in apps/mapp/.env to enable.
 */
export const ANDROID_IMMERSIVE_ENABLED =
  process.env.EXPO_PUBLIC_ANDROID_IMMERSIVE === 'true';

let immersiveDepth = 0;
let savedBehavior: NavigationBarBehavior | null = null;

async function enterAndroidImmersive() {
  if (Platform.OS !== 'android') return;

  if (immersiveDepth === 0) {
    try {
      savedBehavior = await NavigationBar.getBehaviorAsync();
    } catch {
      savedBehavior = 'inset-swipe';
    }

    try {
      await NavigationBar.setBehaviorAsync('overlay-swipe');
      await NavigationBar.setVisibilityAsync('hidden');
      setStatusBarHidden(true, 'fade');
    } catch (error) {
      immersiveLog.warn('immersive.enter.failed', undefined, error);
    }
  }

  immersiveDepth += 1;
}

async function exitAndroidImmersive() {
  if (Platform.OS !== 'android') return;

  immersiveDepth = Math.max(0, immersiveDepth - 1);
  if (immersiveDepth > 0) return;

  try {
    setStatusBarHidden(false, 'fade');
    await NavigationBar.setVisibilityAsync('visible');
    if (savedBehavior) {
      await NavigationBar.setBehaviorAsync(savedBehavior);
      savedBehavior = null;
    }
  } catch (error) {
    immersiveLog.warn('immersive.exit.failed', undefined, error);
  }
}

/**
 * Hides the Android status and navigation bars while `active` is true.
 * Swipe from the top or bottom edge to reveal system UI temporarily (overlay-swipe).
 * Restores bars when the last active consumer unmounts or deactivates.
 */
export function useAndroidImmersiveMode(active: boolean) {
  React.useEffect(() => {
    if (!active) return;

    void enterAndroidImmersive();
    return () => {
      void exitAndroidImmersive();
    };
  }, [active]);
}
