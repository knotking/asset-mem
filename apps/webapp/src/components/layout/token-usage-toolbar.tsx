'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useLlmTokenUsage } from '@/contexts/llm-token-usage-context';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatTokensCompact } from '@/lib/format-tokens';
import {
  buildSettingsHref,
  type SettingsReturnContext,
} from '@/lib/settings-navigation';
import { usePrefersFinePointer } from '@/hooks/use-prefers-fine-pointer';

const RING_SIZE = 24;
const STROKE = 2;

/** Ring + Sparkles tint: green (healthy) → amber (warning) → red (critical). */
function ringColors(pct: number, isDark: boolean) {
  const track = isDark ? 'hsl(0, 0%, 22%)' : 'hsl(0, 0%, 96.1%)';
  let progress: string;
  if (pct >= 100) progress = isDark ? 'hsl(0, 70.9%, 59.4%)' : 'hsl(0, 84.2%, 60.2%)';
  else if (pct >= 90) progress = isDark ? 'hsl(38, 92%, 50%)' : 'hsl(38, 92%, 45%)';
  else progress = isDark ? 'hsl(142, 71%, 48%)' : 'hsl(142, 71%, 40%)';
  return { track, progress };
}

function sparklesClass(pct: number) {
  if (pct >= 100) return 'text-destructive';
  if (pct >= 90) return 'text-amber-500 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

/** Tier-colored Sparkles + circular quota ring (no numeric label in the header). */
function AiQuotaRing({ pct, size = RING_SIZE }: { pct: number; size?: number }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { track, progress } = ringColors(pct, isDark);
  const r = (size - STROKE) / 2 - 0.5;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle cx={cx} cy={cy} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={progress}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <Sparkles className={cn('h-3 w-3', sparklesClass(pct))} />
    </span>
  );
}

export type TokenUsageToolbarProps = {
  settingsReturnContext?: SettingsReturnContext;
};

export function TokenUsageToolbar({ settingsReturnContext }: TokenUsageToolbarProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const showTooltip = usePrefersFinePointer();
  const { loading, limitsLoading, error, periodTotalTokens, effectiveMonthlyLimit } =
    useLlmTokenUsage();

  if (!user || authLoading) {
    return null;
  }

  if (loading || limitsLoading) {
    return (
      <div className="h-9 w-9 shrink-0" aria-hidden>
        <Skeleton className="mx-auto h-6 w-6 rounded-full" />
      </div>
    );
  }

  if (error) {
    return null;
  }

  const goSettings = () => {
    if (settingsReturnContext) {
      router.push(buildSettingsHref('usage', settingsReturnContext));
      return;
    }
    router.push('/home/settings?tab=usage');
  };

  const hasMonthlyCap = effectiveMonthlyLimit != null && effectiveMonthlyLimit > 0;
  const pct = hasMonthlyCap
    ? Math.min(100, Math.round((100 * periodTotalTokens) / effectiveMonthlyLimit))
    : null;

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0"
      onClick={goSettings}
      aria-label={
        pct != null
          ? `AI token usage ${pct} percent, open settings`
          : `${formatTokensCompact(periodTotalTokens)} tokens used this month, open settings`
      }
    >
      {pct != null ? (
        <AiQuotaRing pct={pct} />
      ) : (
        <Sparkles className="h-4 w-4 text-muted-foreground opacity-60" />
      )}
    </Button>
  );

  if (!showTooltip) {
    return button;
  }

  const tooltipText =
    pct != null
      ? `${formatTokensCompact(periodTotalTokens)} / ${formatTokensCompact(effectiveMonthlyLimit!)} tokens this month (${pct}%)`
      : `${formatTokensCompact(periodTotalTokens)} tokens used this month. Open Settings for plan limits.`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
