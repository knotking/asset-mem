'use client';

import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';
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

export type TokenUsageToolbarProps = {
  settingsReturnContext?: SettingsReturnContext;
};

export function TokenUsageToolbar({ settingsReturnContext }: TokenUsageToolbarProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { loading, limitsLoading, error, periodTotalTokens, effectiveMonthlyLimit } =
    useLlmTokenUsage();

  if (!user || authLoading) {
    return null;
  }

  if (loading || limitsLoading) {
    return (
      <div className="h-9 w-9 shrink-0 sm:w-24" aria-hidden>
        <Skeleton className="h-9 w-9 rounded-md sm:h-7 sm:w-full" />
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

  if (effectiveMonthlyLimit == null || effectiveMonthlyLimit <= 0) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 shrink-0 px-0 sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2 text-muted-foreground"
              onClick={goSettings}
              aria-label={`${formatTokensCompact(periodTotalTokens)} tokens used this month`}
            >
              <Activity className="h-4 w-4 shrink-0" />
              <span className="hidden max-w-[8rem] truncate text-xs tabular-nums sm:inline">
                {formatTokensCompact(periodTotalTokens)}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">
              {formatTokensCompact(periodTotalTokens)} tokens used this month. Open Settings for
              plan limits.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const pct = Math.min(100, Math.round((100 * periodTotalTokens) / effectiveMonthlyLimit));

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 px-0 sm:h-8 sm:max-w-[11rem] sm:gap-2 sm:px-2"
            onClick={goSettings}
            aria-label={`${pct}% of monthly AI token limit used`}
          >
            <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="hidden min-w-0 flex-1 flex-col gap-0.5 sm:flex">
              <span
                className={cn(
                  'text-left text-xs font-medium tabular-nums leading-none',
                  pct >= 100 && 'text-destructive',
                  pct >= 90 && pct < 100 && 'text-amber-600 dark:text-amber-400',
                )}
              >
                {pct}%
              </span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width]',
                    pct >= 100 && 'bg-destructive',
                    pct >= 90 && pct < 100 && 'bg-amber-500',
                    pct < 90 && 'bg-primary',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">
            {formatTokensCompact(periodTotalTokens)} / {formatTokensCompact(effectiveMonthlyLimit)}{' '}
            tokens this month (Settings for exact figures)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
