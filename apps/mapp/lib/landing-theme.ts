/** Keep in sync with apps/webapp/src/lib/landing-theme.ts */

export const LANDING_COLORS = {
  primary: '#22d3ee',
  primaryHover: 'rgba(34, 211, 238, 0.9)',
  primaryLight: 'rgba(34, 211, 238, 0.1)',
  primaryBorder: 'rgba(34, 211, 238, 0.2)',
  primary20: 'rgba(34, 211, 238, 0.2)',
  background: '#0a0a0f',
  foreground: '#fafafa',
  foreground90: 'rgba(250, 250, 250, 0.9)',
  foreground70: 'rgba(250, 250, 250, 0.7)',
  foreground60: 'rgba(250, 250, 250, 0.6)',
  mutedForeground: 'rgba(255, 255, 255, 0.65)',
  border: 'rgba(255, 255, 255, 0.08)',
  accent: '#f97316',
  white: 'rgb(255, 255, 255)',
  workflowSection: '#0f0f14',
} as const;

export const LANDING_CYAN_GRADIENT = ['#22d3ee', 'rgba(34,211,238,0.6)'] as const;

export const LANDING_CYAN_WHITE_GRADIENT = [
  LANDING_COLORS.primary,
  LANDING_COLORS.foreground70,
] as const;
