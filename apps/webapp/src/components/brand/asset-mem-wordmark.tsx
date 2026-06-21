import { cn } from '@/lib/utils';
import { LANDING_COLORS } from '@/lib/landing-theme';

/** Keep in sync with apps/mapp/app/landing.tsx (24px / 18px). */
export const LANDING_BRAND_FONT_SIZE_PX = 24;
export const LANDING_BRAND_AI_FONT_SIZE_PX = 18;
export const LANDING_BRAND_AI_SIZE_EM = 0.75;

const WORDMARK_BRAND_CLASS = {
  xs: 'text-xs',
  eyebrow: 'text-sm font-medium tracking-wide',
  header: 'text-xl lg:text-2xl',
  footer: 'text-xl',
  solutions: 'text-lg',
} as const;

export type AssetMemWordmarkSize = keyof typeof WORDMARK_BRAND_CLASS;

type AssetMemWordmarkProps = {
  size?: AssetMemWordmarkSize;
  className?: string;
  /** `app` uses theme foreground + landing AI gradient; `landing` uses marketing palette. */
  tone?: 'landing' | 'app';
  foregroundColor?: string;
  /** Muted foreground for app tone (e.g. loading footers). */
  subdued?: boolean;
};

export function AssetMemWordmark({
  size = 'header',
  className,
  tone = 'landing',
  foregroundColor = LANDING_COLORS.foreground,
  subdued = false,
}: AssetMemWordmarkProps) {
  if (tone === 'app') {
    return (
      <span
        className={cn(
          'inline-flex items-baseline gap-1 font-light tracking-tight leading-none',
          WORDMARK_BRAND_CLASS[size],
          className,
        )}
      >
        <span className={subdued ? 'text-muted-foreground' : 'text-foreground'}>AssetMem</span>
        <span
          className="brand-ai-gradient-text font-bold tracking-normal"
          style={{ fontSize: `${LANDING_BRAND_AI_SIZE_EM}em` }}
        >
          AI
        </span>
      </span>
    );
  }

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
        className="brand-ai-gradient-text font-bold tracking-normal"
        style={{ fontSize: `${LANDING_BRAND_AI_SIZE_EM}em` }}
      >
        AI
      </span>
    </span>
  );
}
