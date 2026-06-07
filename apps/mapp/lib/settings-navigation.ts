import type { Router } from 'expo-router';
import type { PropertyScreenTab } from '@/components/property-details/property-screen-tab';

/** Where settings sub-screens should return when the user taps back. */
export type SettingsReturnTarget = 'home' | 'settings' | 'property';

export type SettingsReturnContext =
  | { target: 'home' }
  | { target: 'settings' }
  | { target: 'property'; propertyId: string; tab: PropertyScreenTab };

export type SettingsSubScreenId = 'account' | 'faq' | 'usage';

const SIMPLE_RETURN_PATH: Record<'home' | 'settings', '/(tabs)/home' | '/(tabs)/settings'> = {
  home: '/(tabs)/home',
  settings: '/(tabs)/settings',
};

const PROPERTY_TAB_VALUES: PropertyScreenTab[] = ['chat', 'timeline', 'details', 'providers'];

/** Set when a settings sub-screen was exited via peek-back (home/property). */
let pendingSettingsHubReset = false;

function normalizeRouteParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parsePropertyReturnTab(value: string | undefined): PropertyScreenTab {
  if (value && PROPERTY_TAB_VALUES.includes(value as PropertyScreenTab)) {
    return value as PropertyScreenTab;
  }
  return 'chat';
}

export function resolveAppHeaderReturnContext(segments: readonly string[]): SettingsReturnContext {
  return segments.includes('settings') ? { target: 'settings' } : { target: 'home' };
}

export function propertySettingsReturnContext(
  propertyId: string,
  tab: PropertyScreenTab
): SettingsReturnContext {
  return { target: 'property', propertyId, tab };
}

export function isPeekSettingsReturnContext(
  context: SettingsReturnContext | undefined
): context is Extract<SettingsReturnContext, { target: 'home' | 'property' }> {
  return context?.target === 'home' || context?.target === 'property';
}

export function markPendingSettingsHubReset() {
  pendingSettingsHubReset = true;
}

export function clearPendingSettingsHubReset() {
  pendingSettingsHubReset = false;
}

export function consumePendingSettingsHubReset() {
  if (!pendingSettingsHubReset) {
    return false;
  }
  pendingSettingsHubReset = false;
  return true;
}

export function settingsReturnParams(context: SettingsReturnContext): Record<string, string> {
  if (context.target === 'property') {
    return {
      returnTo: 'property',
      returnPropertyId: context.propertyId,
      returnPropertyTab: context.tab,
    };
  }
  return { returnTo: context.target };
}

export function resolveSettingsReturnContext(params: {
  returnTo?: string | string[];
  returnPropertyId?: string | string[];
  returnPropertyTab?: string | string[];
}): SettingsReturnContext | undefined {
  const target = normalizeRouteParam(params.returnTo);
  if (target === 'home') {
    return { target: 'home' };
  }
  if (target === 'settings') {
    return { target: 'settings' };
  }
  if (target === 'property') {
    const propertyId = normalizeRouteParam(params.returnPropertyId);
    if (!propertyId) {
      return undefined;
    }
    return {
      target: 'property',
      propertyId,
      tab: parsePropertyReturnTab(normalizeRouteParam(params.returnPropertyTab)),
    };
  }
  return undefined;
}

export function settingsBackAccessibilityLabel(context: SettingsReturnContext | undefined) {
  if (!context || context.target === 'settings') {
    return 'Back to settings';
  }
  if (context.target === 'home') {
    return 'Back to properties';
  }
  switch (context.tab) {
    case 'chat':
      return 'Back to AI chat';
    case 'timeline':
      return 'Back to timeline';
    case 'details':
      return 'Back to property details';
    case 'providers':
      return 'Back to providers';
    default:
      return 'Back to property';
  }
}

export function navigateBackFromSettingsSubScreen(
  router: Router,
  context: SettingsReturnContext | undefined
) {
  const resolved = context ?? { target: 'settings' as const };

  if (resolved.target === 'settings') {
    router.dismissTo('/(tabs)/settings');
    return;
  }

  markPendingSettingsHubReset();

  if (resolved.target === 'property') {
    router.replace({
      pathname: '/home/property-details',
      params: { id: resolved.propertyId, tab: resolved.tab },
    });
    return;
  }

  router.replace(SIMPLE_RETURN_PATH.home);
}

export function navigateToSettingsSubScreen(
  router: Router,
  screen: SettingsSubScreenId,
  returnContext: SettingsReturnContext
) {
  clearPendingSettingsHubReset();
  router.navigate({
    pathname: `/(tabs)/settings/${screen}`,
    params: settingsReturnParams(returnContext),
  });
}
