import React, { useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

type LayoutSize = { width: number; height: number };

function useBackgroundLayout() {
  const [layout, setLayout] = useState<LayoutSize>({ width: 0, height: 0 });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);
  return { layout, onLayout };
}

type LandingRadialGlowSpec = {
  id: string;
  cxPct: number;
  cyPct: number;
  color: string;
  peakOpacity: number;
  radiusScale?: number;
};

function renderRadialGlows(layout: LayoutSize, glows: LandingRadialGlowSpec[]) {
  const { width, height } = layout;
  if (width <= 0 || height <= 0 || glows.length === 0) {
    return null;
  }

  const radius = Math.max(width, height) * 0.55;

  return (
    <Svg width={width} height={height} style={styles.absoluteTopLeft}>
      <Defs>
        {glows.map((glow) => (
          <RadialGradient
            key={glow.id}
            id={glow.id}
            gradientUnits="userSpaceOnUse"
            cx={(width * glow.cxPct) / 100}
            cy={(height * glow.cyPct) / 100}
            rx={radius * (glow.radiusScale ?? 1)}
            ry={radius * (glow.radiusScale ?? 1)}>
            <Stop offset="0%" stopColor={glow.color} stopOpacity={glow.peakOpacity} />
            <Stop offset="50%" stopColor={glow.color} stopOpacity={0} />
            <Stop offset="100%" stopColor={glow.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {glows.map((glow) => (
        <Rect key={`${glow.id}-rect`} width={width} height={height} fill={`url(#${glow.id})`} />
      ))}
    </Svg>
  );
}

function LandingGridOverlaySvg({
  layout,
  lineOpacity = 0.03,
  cellSize = 24,
  id = 'landing-grid',
}: {
  layout: LayoutSize;
  lineOpacity?: number;
  cellSize?: number;
  id?: string;
}) {
  const { width, height } = layout;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const stroke = `rgba(255,255,255,${lineOpacity})`;

  return (
    <Svg width={width} height={height} style={styles.absoluteTopLeft}>
      <Defs>
        <Pattern id={id} width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
          <Line x1={cellSize} y1={0} x2={cellSize} y2={cellSize} stroke={stroke} strokeWidth={1} />
          <Line x1={0} y1={cellSize} x2={cellSize} y2={cellSize} stroke={stroke} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

type LandingHeroBackgroundProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
};

/** Matches apps/webapp/src/components/landing/landing-hero.tsx gradient stack. */
export function LandingHeroBackground({ children, style, contentStyle }: LandingHeroBackgroundProps) {
  const { layout, onLayout } = useBackgroundLayout();
  const { width, height } = layout;

  return (
    <View style={[styles.overflowHidden, styles.relative, style]} onLayout={onLayout}>
      {width > 0 && height > 0 ? (
        <View style={[styles.absoluteFill, styles.layer]} pointerEvents="none">
          <LinearGradient
            colors={['#0a0a0f', '#0f172a', '#0a0a0f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width, height }}
          />
          {renderRadialGlows(layout, [
            { id: 'hero-cyan', cxPct: 30, cyPct: 20, color: '#22d3ee', peakOpacity: 0.12 },
            { id: 'hero-orange', cxPct: 70, cyPct: 80, color: '#f97316', peakOpacity: 0.08 },
          ])}
        </View>
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

export type LandingSectionBackgroundVariant =
  | 'workflow'
  | 'ai-pipeline'
  | 'use-cases'
  | 'enterprise'
  | 'pricing';

type LandingSectionBackgroundProps = {
  children: React.ReactNode;
  backgroundColor: string;
  variant?: LandingSectionBackgroundVariant;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
};

/** Section overlays aligned with apps/webapp/src/app/landing/landing-client.tsx */
export function LandingSectionBackground({
  children,
  backgroundColor,
  variant,
  style,
  contentStyle,
}: LandingSectionBackgroundProps) {
  const { layout, onLayout } = useBackgroundLayout();
  const { width, height } = layout;

  const glows: LandingRadialGlowSpec[] =
    variant === 'ai-pipeline'
      ? [{ id: 'ai-ellipse', cxPct: 50, cyPct: 60, color: '#22d3ee', peakOpacity: 0.07 }]
      : variant === 'enterprise' || variant === 'pricing'
        ? [
            {
              id: `${variant}-cyan`,
              cxPct: 15,
              cyPct: 30,
              color: '#22d3ee',
              peakOpacity: 0.08,
            },
            {
              id: `${variant}-orange`,
              cxPct: 85,
              cyPct: 70,
              color: '#f97316',
              peakOpacity: 0.06,
            },
          ]
        : [];

  return (
    <View
      style={[{ backgroundColor }, styles.overflowHidden, styles.relative, style]}
      onLayout={onLayout}>
      {width > 0 && height > 0 ? (
        <View style={[styles.absoluteFill, styles.layer]} pointerEvents="none">
          {renderRadialGlows(layout, glows)}
          {variant === 'workflow' ? (
            <LandingGridOverlaySvg layout={layout} id="workflow-grid" lineOpacity={0.03} />
          ) : null}
          {variant === 'ai-pipeline' ? (
            <LandingGridOverlaySvg layout={layout} id="ai-grid" lineOpacity={0.02} />
          ) : null}
          {variant === 'use-cases' ? (
            <LandingGridOverlaySvg layout={layout} id="use-cases-grid" lineOpacity={0.02} />
          ) : null}
        </View>
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

type LandingGradientBadgeProps = {
  children: React.ReactNode;
  size?: number;
  borderRadius?: number;
  colors?: readonly [string, string, ...string[]];
  diagonal?: boolean;
};

export function LandingGradientBadge({
  children,
  size = 64,
  borderRadius = 16,
  colors = ['#22d3ee', 'rgba(34,211,238,0.6)'],
  diagonal = true,
}: LandingGradientBadgeProps) {
  return (
    <LinearGradient
      colors={[...colors]}
      start={{ x: 0, y: 0 }}
      end={diagonal ? { x: 1, y: 1 } : { x: 1, y: 0 }}
      style={{
        width: size,
        height: size,
        borderRadius,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      {children}
    </LinearGradient>
  );
}

export function withHexAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  absoluteTopLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  overflowHidden: {
    overflow: 'hidden',
  },
  relative: {
    position: 'relative',
  },
  layer: {
    zIndex: 0,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
