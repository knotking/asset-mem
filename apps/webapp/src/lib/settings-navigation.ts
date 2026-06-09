/** Where settings should return when the user taps back. */
export type SettingsReturnTarget = 'home' | 'settings' | 'property';

export type PropertyScreenTab = 'chat' | 'timeline' | 'details';

export type SettingsReturnContext =
  | { target: 'home' }
  | { target: 'settings' }
  | { target: 'property'; propertyId: string; tab: PropertyScreenTab; sessionId?: string };

export type SettingsTabId = 'account' | 'billing' | 'usage' | 'checkpoints' | 'faq' | 'help';

const PROPERTY_TAB_VALUES: PropertyScreenTab[] = ['chat', 'timeline', 'details'];

const PROPERTY_TAB_TO_SEGMENT: Record<PropertyScreenTab, string> = {
  chat: 'chat',
  timeline: 'checkpoints',
  details: 'details',
};

const PROPERTY_SEGMENT_TO_TAB: Record<string, PropertyScreenTab> = {
  chat: 'chat',
  checkpoints: 'timeline',
  details: 'details',
  providers: 'chat',
};

function parsePropertyReturnTab(value: string | null | undefined): PropertyScreenTab {
  if (value && PROPERTY_TAB_VALUES.includes(value as PropertyScreenTab)) {
    return value as PropertyScreenTab;
  }
  return 'chat';
}

export function resolveHeaderReturnContext(pathname: string): SettingsReturnContext {
  if (pathname.startsWith('/home/settings')) {
    return { target: 'settings' };
  }

  const propertyMatch = pathname.match(
    /^\/home\/properties\/([^/]+)\/(chat|checkpoints|details|providers)(?:\/([^/]+))?(?:\/|$)/,
  );
  if (propertyMatch) {
    const [, propertyId, segment, trailingId] = propertyMatch;
    const tab = PROPERTY_SEGMENT_TO_TAB[segment] ?? 'chat';
    const context: Extract<SettingsReturnContext, { target: 'property' }> = {
      target: 'property',
      propertyId,
      tab,
    };
    if (tab === 'chat' && trailingId) {
      context.sessionId = trailingId;
    }
    return context;
  }

  return { target: 'home' };
}

export function propertySettingsReturnContext(
  propertyId: string,
  tab: PropertyScreenTab,
  sessionId?: string | null,
): SettingsReturnContext {
  const context: Extract<SettingsReturnContext, { target: 'property' }> = {
    target: 'property',
    propertyId,
    tab,
  };
  if (tab === 'chat' && sessionId) {
    context.sessionId = sessionId;
  }
  return context;
}

export function settingsReturnSearchParams(
  context: SettingsReturnContext,
): Record<string, string> {
  if (context.target === 'property') {
    const params: Record<string, string> = {
      returnTo: 'property',
      returnPropertyId: context.propertyId,
      returnPropertyTab: context.tab,
    };
    if (context.sessionId) {
      params.returnSessionId = context.sessionId;
    }
    return params;
  }
  return { returnTo: context.target };
}

export function resolveSettingsReturnContext(params: {
  returnTo?: string | null;
  returnPropertyId?: string | null;
  returnPropertyTab?: string | null;
  returnSessionId?: string | null;
}): SettingsReturnContext | undefined {
  const target = params.returnTo ?? undefined;
  if (target === 'home') {
    return { target: 'home' };
  }
  if (target === 'settings') {
    return { target: 'settings' };
  }
  if (target === 'property') {
    const propertyId = params.returnPropertyId ?? undefined;
    if (!propertyId) {
      return undefined;
    }
    const tab = parsePropertyReturnTab(params.returnPropertyTab);
    const sessionId = params.returnSessionId ?? undefined;
    return {
      target: 'property',
      propertyId,
      tab,
      ...(tab === 'chat' && sessionId ? { sessionId } : {}),
    };
  }
  return undefined;
}

export function buildSettingsHref(
  tab: SettingsTabId | undefined,
  returnContext: SettingsReturnContext,
): string {
  const params = new URLSearchParams();
  if (tab) {
    params.set('tab', tab);
  }
  for (const [key, value] of Object.entries(settingsReturnSearchParams(returnContext))) {
    params.set(key, value);
  }
  const query = params.toString();
  return query ? `/home/settings?${query}` : '/home/settings';
}

export function propertySettingsPath(
  propertyId: string,
  tab: PropertyScreenTab,
  sessionId?: string,
): string {
  if (tab === 'chat' && sessionId) {
    return `/home/properties/${propertyId}/chat/${sessionId}`;
  }
  return `/home/properties/${propertyId}/${PROPERTY_TAB_TO_SEGMENT[tab]}`;
}

export function settingsBackHref(context: SettingsReturnContext | undefined): string {
  const resolved = context ?? { target: 'settings' as const };

  if (resolved.target === 'property') {
    return propertySettingsPath(resolved.propertyId, resolved.tab, resolved.sessionId);
  }
  if (resolved.target === 'home') {
    return '/home';
  }
  return '/home/settings';
}

export function settingsBackAccessibilityLabel(context: SettingsReturnContext | undefined): string {
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
    default:
      return 'Back to property';
  }
}

export function isSettingsHubReturn(context: SettingsReturnContext | undefined): boolean {
  return !context || context.target === 'settings';
}
