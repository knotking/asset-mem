import React from 'react';
import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { LandingGradientText } from '@/components/landing/landing-gradient-text';
import { LANDING_COLORS } from '@/lib/landing-theme';
import { cn } from '@/lib/utils';

/** Keep in sync with apps/webapp/src/components/brand/asset-mem-wordmark.tsx */
export const LANDING_BRAND_FONT_SIZE_PX = 24;
export const LANDING_BRAND_AI_SIZE_EM = 0.75;

const WORDMARK_SIZE_PX = {
  header: 18,
  hero: 24,
  footer: 18,
  auth: 24,
} as const;

export type AssetMemWordmarkSize = keyof typeof WORDMARK_SIZE_PX;

type AssetMemWordmarkProps = {
  size?: AssetMemWordmarkSize;
  className?: string;
  /** `app` uses theme foreground; `landing` uses marketing palette. */
  tone?: 'landing' | 'app';
  foregroundColor?: string;
  align?: 'left' | 'center';
};

export function AssetMemWordmark({
  size = 'header',
  className,
  tone = 'app',
  foregroundColor,
  align = 'left',
}: AssetMemWordmarkProps) {
  const brandPx = WORDMARK_SIZE_PX[size];
  const aiPx = Math.round(brandPx * LANDING_BRAND_AI_SIZE_EM);
  const color = tone === 'app' ? undefined : (foregroundColor ?? LANDING_COLORS.foreground);

  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexShrink: 0,
    alignSelf: align === 'center' ? 'center' : 'flex-start',
  };

  const brandStyle: TextStyle = {
    fontSize: brandPx,
    fontWeight: '300',
    lineHeight: brandPx,
    includeFontPadding: false,
    ...(color ? { color } : {}),
  };

  return (
    <View
      className={cn('flex-row items-baseline gap-1', className)}
      style={rowStyle}
      accessibilityLabel="AssetMem AI"
      accessibilityRole="text">
      <Text className={tone === 'app' ? 'text-foreground' : undefined} style={brandStyle}>
        AssetMem
      </Text>
      <LandingGradientText
        inline
        style={{
          fontSize: aiPx,
          fontWeight: '700',
          letterSpacing: 0.4,
        }}>
        AI
      </LandingGradientText>
    </View>
  );
}
