import { cn } from '@/lib/utils';
import { LANDING_COLORS } from '@/lib/landing-theme';

/** Keep in sync with apps/mapp/app/landing.tsx (24px / 18px). */
export const LANDING_BRAND_FONT_SIZE_PX = 24;
export const LANDING_BRAND_AI_FONT_SIZE_PX = 18;
export const LANDING_BRAND_AI_SIZE_EM = 0.75;

const WORDMARK_BRAND_CLASS = {
  header: 'text-xl lg:text-2xl',
  footer: 'text-xl',
  solutions: 'text-lg',
} as const;

export type AssetMemWordmarkSize = keyof typeof WORDMARK_BRAND_CLASS;

type AssetMemWordmarkProps = {
  size?: AssetMemWordmarkSize;
  className?: string;
  foregroundColor?: string;
  primaryColor?: string;
};

export function AssetMemWordmark({
  size = 'header',
  className,
  foregroundColor = LANDING_COLORS.foreground,
  primaryColor = LANDING_COLORS.primary,
}: AssetMemWordmarkProps) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 font-light tracking-tight leading-none',
        WORDMARK_BRAND_CLASS[size],
        className,
      )}
      style={{ color: foregroundColor }}
    >
      <span>AssetMem</span>
      <span
        className="font-bold tracking-normal"
        style={{ color: primaryColor, fontSize: `${LANDING_BRAND_AI_SIZE_EM}em` }}
      >
        AI
      </span>
    </span>
  );
}
