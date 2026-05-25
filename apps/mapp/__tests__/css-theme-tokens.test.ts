import {
  darkThemeTokens,
  getAppThemeColors,
  hslTripletToCss,
  hslTripletToHsla,
  lightThemeTokens,
} from '@/lib/css-theme-tokens';

describe('css-theme-tokens', () => {
  it('maps light tokens from global.css :root', () => {
    const colors = getAppThemeColors(false);
    expect(colors.background).toBe(hslTripletToCss(lightThemeTokens.background));
    expect(colors.secondary).toBe(hslTripletToCss(lightThemeTokens.secondary));
    expect(colors.muted).toBe(hslTripletToCss(lightThemeTokens.muted));
    expect(colors.border).toBe(hslTripletToCss(lightThemeTokens.border));
    expect(colors.muted40).toBe(hslTripletToHsla(lightThemeTokens.muted, 0.4));
    expect(colors.info10).toBe(hslTripletToHsla(lightThemeTokens.info, 0.1));
  });

  it('maps dark tokens from global.css .dark:root', () => {
    const colors = getAppThemeColors(true);
    expect(colors.background).toBe(hslTripletToCss(darkThemeTokens.background));
    expect(colors.secondary).toBe(hslTripletToCss(darkThemeTokens.secondary));
    expect(colors.muted).toBe(hslTripletToCss(darkThemeTokens.muted));
    expect(colors.border).toBe(hslTripletToCss(darkThemeTokens.border));
    expect(colors.muted40).toBe(hslTripletToHsla(darkThemeTokens.muted, 0.4));
  });

  it('uses distinct light vs dark backgrounds', () => {
    expect(getAppThemeColors(false).background).not.toBe(getAppThemeColors(true).background);
    expect(getAppThemeColors(true).background).toBe('hsl(0, 0%, 8%)');
  });
});
