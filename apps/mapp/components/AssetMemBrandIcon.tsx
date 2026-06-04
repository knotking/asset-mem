import React from 'react';
import { View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

const LANDING_PRIMARY = '#22d3ee';
const LANDING_WHITE = '#ffffff';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const MARK_BOX: Record<Size, number> = {
  xs: 28,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
};

const MARK_ICON: Record<Size, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
};

const PLAIN_ICON: Record<Size, number> = {
  xs: 14,
  sm: 28,
  md: 40,
  lg: 48,
  xl: 56,
};

const MARK_RADIUS: Record<Size, number> = {
  xs: 8,
  sm: 8,
  md: 12,
  lg: 12,
  xl: 14,
};

type AssetMemBrandIconProps = {
  variant?: 'default' | 'mark';
  size?: Size;
  className?: string;
  markTheme?: 'landing' | 'app';
};

export function AssetMemBrandIcon({
  variant = 'default',
  size = 'sm',
  className,
  markTheme = 'app',
}: AssetMemBrandIconProps) {
  if (variant === 'mark') {
    const boxSize = MARK_BOX[size];
    const isLanding = markTheme === 'landing';
    return (
      <View
        className={cn('items-center justify-center', !isLanding && 'bg-primary', className)}
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: MARK_RADIUS[size],
          ...(isLanding ? { backgroundColor: LANDING_PRIMARY } : {}),
        }}
        aria-hidden
      >
        <Icon
          as={Sparkles}
          size={MARK_ICON[size]}
          style={{ color: isLanding ? LANDING_WHITE : undefined }}
          className={!isLanding ? 'text-primary-foreground' : undefined}
        />
      </View>
    );
  }

  return (
    <Icon
      as={Sparkles}
      size={PLAIN_ICON[size]}
      className={cn('shrink-0 text-primary', className)}
      aria-hidden
    />
  );
}
