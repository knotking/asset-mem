import {
  buildSettingsHref,
  propertySettingsPath,
  resolveHeaderReturnContext,
  resolveSettingsReturnContext,
  settingsBackHref,
} from '@/lib/settings-navigation';

describe('settings-navigation', () => {
  it('resolves header context from pathname', () => {
    expect(resolveHeaderReturnContext('/home')).toEqual({ target: 'home' });
    expect(resolveHeaderReturnContext('/home/settings')).toEqual({ target: 'settings' });
    expect(resolveHeaderReturnContext('/home/properties/p1/chat')).toEqual({
      target: 'property',
      propertyId: 'p1',
      tab: 'chat',
    });
    expect(resolveHeaderReturnContext('/home/properties/p1/chat/s1')).toEqual({
      target: 'property',
      propertyId: 'p1',
      tab: 'chat',
      sessionId: 's1',
    });
    expect(resolveHeaderReturnContext('/home/properties/p1/checkpoints')).toEqual({
      target: 'property',
      propertyId: 'p1',
      tab: 'timeline',
    });
  });

  it('builds settings href with return params', () => {
    expect(buildSettingsHref('usage', { target: 'home' })).toBe(
      '/home/settings?tab=usage&returnTo=home',
    );
    expect(
      buildSettingsHref('faq', {
        target: 'property',
        propertyId: 'p1',
        tab: 'chat',
        sessionId: 's1',
      }),
    ).toBe(
      '/home/settings?tab=faq&returnTo=property&returnPropertyId=p1&returnPropertyTab=chat&returnSessionId=s1',
    );
  });

  it('resolves return context from search params', () => {
    expect(
      resolveSettingsReturnContext({
        returnTo: 'property',
        returnPropertyId: 'p1',
        returnPropertyTab: 'chat',
        returnSessionId: 's1',
      }),
    ).toEqual({
      target: 'property',
      propertyId: 'p1',
      tab: 'chat',
      sessionId: 's1',
    });
  });

  it('maps back href to origin', () => {
    expect(settingsBackHref({ target: 'home' })).toBe('/home');
    expect(
      settingsBackHref({ target: 'property', propertyId: 'p1', tab: 'chat' }),
    ).toBe('/home/properties/p1/chat');
    expect(
      settingsBackHref({
        target: 'property',
        propertyId: 'p1',
        tab: 'chat',
        sessionId: 's1',
      }),
    ).toBe('/home/properties/p1/chat/s1');
    expect(propertySettingsPath('p1', 'timeline')).toBe('/home/properties/p1/checkpoints');
  });
});
