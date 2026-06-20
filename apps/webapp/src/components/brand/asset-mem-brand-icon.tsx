import Image from 'next/image';
import { cn } from '@/lib/utils';
import appIcon from '@/app/icon.png';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const MARK_PX: Record<Size, number> = {
  xs: 28,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
};

const PLAIN_PX: Record<Size, number> = {
  xs: 14,
  sm: 28,
  md: 40,
  lg: 48,
  xl: 56,
};

const MARK_RADIUS: Record<Size, string> = {
  xs: 'rounded-lg',
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
};

type AssetMemBrandIconProps = {
  variant?: 'default' | 'mark';
  size?: Size;
  className?: string;
  /** Kept for API compatibility; app icon asset includes brand gradient. */
  markTheme?: 'landing' | 'app';
};

export function AssetMemBrandIcon({
  variant = 'default',
  size = 'sm',
  className,
}: AssetMemBrandIconProps) {
  const px = variant === 'mark' ? MARK_PX[size] : PLAIN_PX[size];

  return (
    <Image
      src={appIcon}
      alt=""
      width={px}
      height={px}
      className={cn(
        'shrink-0 object-cover',
        variant === 'mark' ? MARK_RADIUS[size] : 'rounded-[22%]',
        className,
      )}
      aria-hidden
    />
  );
}
