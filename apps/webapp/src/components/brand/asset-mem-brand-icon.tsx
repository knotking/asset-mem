import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const MARK_BOX: Record<Size, string> = {
  xs: 'h-7 w-7 rounded-lg',
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-xl',
  xl: 'h-14 w-14 rounded-xl',
};

const MARK_ICON: Record<Size, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-7 w-7',
};

const PLAIN_ICON: Record<Size, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-7 w-7',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-14 w-14',
};

type AssetMemBrandIconProps = {
  variant?: 'default' | 'mark';
  size?: Size;
  className?: string;
  /** Landing cyan gradient tile; `app` uses theme primary. */
  markTheme?: 'landing' | 'app';
};

export function AssetMemBrandIcon({
  variant = 'default',
  size = 'sm',
  className,
  markTheme = 'app',
}: AssetMemBrandIconProps) {
  if (variant === 'mark') {
    const isLanding = markTheme === 'landing';
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center shadow-lg',
          MARK_BOX[size],
          !isLanding && 'bg-primary',
          className,
        )}
        style={
          isLanding
            ? {
                background:
                  'linear-gradient(to right bottom, #22d3ee, rgba(34, 211, 238, 0.6))',
              }
            : undefined
        }
        aria-hidden
      >
        <Sparkles
          className={cn(
            MARK_ICON[size],
            isLanding ? 'text-white' : 'text-primary-foreground',
          )}
        />
      </div>
    );
  }

  return (
    <Sparkles
      className={cn('shrink-0 text-primary', PLAIN_ICON[size], className)}
      aria-hidden
    />
  );
}
