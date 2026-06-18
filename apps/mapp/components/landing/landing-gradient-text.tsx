import React, { memo } from 'react';
import { Platform, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LANDING_CYAN_GRADIENT,
  LANDING_CYAN_WHITE_GRADIENT,
} from '@/lib/landing-theme';

type GradientVariant = 'cyan' | 'cyan-white' | 'cyan-diagonal';

const GRADIENT_CONFIG: Record<
  GradientVariant,
  { colors: readonly [string, string]; start: { x: number; y: number }; end: { x: number; y: number } }
> = {
  cyan: {
    colors: LANDING_CYAN_GRADIENT,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  'cyan-white': {
    colors: LANDING_CYAN_WHITE_GRADIENT,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  'cyan-diagonal': {
    colors: LANDING_CYAN_GRADIENT,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
};

type LandingGradientTextProps = {
  children: string;
  style?: TextStyle;
  variant?: GradientVariant;
  align?: 'left' | 'center';
  /** Wordmark-style placement beside plain Text (baseline-aligned). */
  inline?: boolean;
};

function LandingGradientTextComponent({
  children,
  style,
  variant = 'cyan',
  align = 'center',
  inline = false,
}: LandingGradientTextProps) {
  const gradient = GRADIENT_CONFIG[variant];
  const fontSize = typeof style?.fontSize === 'number' ? style.fontSize : undefined;
  const lineHeight =
    typeof style?.lineHeight === 'number'
      ? style.lineHeight
      : fontSize != null
        ? fontSize
        : undefined;
  const textStyle: TextStyle[] = [
    style ?? {},
    { includeFontPadding: false },
    lineHeight != null ? { lineHeight } : {},
  ];

  const wrapperStyle: ViewStyle = inline
    ? { alignSelf: 'baseline', flexShrink: 0 }
    : { alignSelf: align === 'center' ? 'center' : 'flex-start', maxWidth: '100%' };

  return (
    <View
      collapsable={false}
      style={wrapperStyle}
      {...(Platform.OS === 'android' ? { renderToHardwareTextureAndroid: true } : null)}
      {...(Platform.OS === 'ios' ? { needsOffscreenAlphaCompositing: true } : null)}>
      <MaskedView
        style={inline ? { flexShrink: 0 } : { alignSelf: 'stretch' }}
        maskElement={
          <Text style={[...textStyle, { color: '#000' }]}>{children}</Text>
        }>
        <LinearGradient
          colors={[...gradient.colors]}
          start={gradient.start}
          end={gradient.end}>
          <Text style={[...textStyle, { opacity: 0 }]}>{children}</Text>
        </LinearGradient>
      </MaskedView>
    </View>
  );
}

/** Gradient headlines — rasterized wrapper reduces MaskedView flicker while scrolling. */
export const LandingGradientText = memo(LandingGradientTextComponent);
