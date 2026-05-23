import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Open an https URL in the system / in-app browser.
 * Prefer expo-web-browser over Linking.openURL — the latter can fail silently on iOS dev builds.
 */
export async function openExternalWebUrl(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('No URL to open');
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.open(trimmed, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  try {
    await WebBrowser.openBrowserAsync(trimmed, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      showInRecents: true,
    });
    return;
  } catch {
    // Fall back to Linking when WebBrowser is unavailable.
  }

  const canOpen = await Linking.canOpenURL(trimmed);
  if (!canOpen) {
    throw new Error('This device cannot open the billing link.');
  }

  const opened = await Linking.openURL(trimmed);
  if (opened === false) {
    throw new Error('Could not open browser.');
  }
}
