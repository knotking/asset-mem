/**
 * HSL tokens aligned with apps/mapp/global.css (:root and .dark:root).
 * Used by chat-message-native-styles to avoid NativeWind opacity/shadow classNames.
 */

export type HslTriplet = readonly [h: number, s: number, l: number];

export function hslTripletToCss([h, s, l]: HslTriplet): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function hslTripletToHsla([h, s, l]: HslTriplet, alpha: number): string {
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

/** Matches global.css :root */
export const lightThemeTokens = {
  background: [0, 0, 100] as HslTriplet,
  secondary: [0, 0, 96.1] as HslTriplet,
  muted: [0, 0, 96.1] as HslTriplet,
  border: [0, 0, 89.8] as HslTriplet,
  info: [217, 91, 60] as HslTriplet,
} as const;

/** Matches global.css .dark:root */
export const darkThemeTokens = {
  background: [0, 0, 8] as HslTriplet,
  secondary: [0, 0, 22] as HslTriplet,
  muted: [0, 0, 22] as HslTriplet,
  border: [0, 0, 28] as HslTriplet,
  info: [217, 91, 60] as HslTriplet,
} as const;

/** Tailwind amber-800 / amber-950 equivalents for DIY cost callout */
const amber800: HslTriplet = [21, 83, 32];
const amber950: HslTriplet = [21, 91, 9];

export type AppThemeColors = {
  secondary: string;
  muted: string;
  background: string;
  border: string;
  muted40: string;
  muted30: string;
  info10: string;
  diyCostBorder: string;
  diyCostBackground: string;
};

export function getAppThemeColors(isDark: boolean): AppThemeColors {
  const t = isDark ? darkThemeTokens : lightThemeTokens;
  return {
    secondary: hslTripletToCss(t.secondary),
    muted: hslTripletToCss(t.muted),
    background: hslTripletToCss(t.background),
    border: hslTripletToCss(t.border),
    muted40: hslTripletToHsla(t.muted, 0.4),
    muted30: hslTripletToHsla(t.muted, 0.3),
    info10: hslTripletToHsla(t.info, 0.1),
    diyCostBorder: hslTripletToHsla(amber800, 0.3),
    diyCostBackground: hslTripletToHsla(amber950, 0.2),
  };
}
