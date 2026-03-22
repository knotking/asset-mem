'use client';

import { useLlmTokenUsage } from '@/contexts/llm-token-usage-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatTokensCompact, formatTokensFull } from '@/lib/format-tokens';

const nf = new Intl.NumberFormat('en-US');

function StatRow({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col gap-0.5 rounded-md border bg-muted/30 px-3 py-2.5 text-left sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="font-mono text-sm font-medium tabular-nums">{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs">{hint}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function AiUsageSettings() {
  const {
    loading,
    error,
    inputTokens,
    outputTokens,
    totalTokens,
    agentStreamCount,
    workerLlmCallCount,
    updatedAt,
    quotaPeriodKey,
    periodTotalTokens,
    periodInputTokens,
    periodOutputTokens,
    monthlyLimit,
    effectiveMonthlyLimit,
    proxyDefaultLimit,
  } = useLlmTokenUsage();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            AI usage
          </CardTitle>
          <CardDescription>
            Aggregated token usage from chat and background features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            AI usage
          </CardTitle>
          <CardDescription>
            Aggregated token usage from chat and background features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          AI usage
        </CardTitle>
        <CardDescription>
          Monthly quotas use UTC calendar months. All-time totals are shown below. Limits are
          enforced on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {effectiveMonthlyLimit != null && periodTotalTokens >= effectiveMonthlyLimit ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            You are at or over your monthly token limit. AI features may be blocked until the next
            UTC month or your limit is raised.
          </p>
        ) : effectiveMonthlyLimit != null && periodTotalTokens >= effectiveMonthlyLimit * 0.9 ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            You have used about{' '}
            {Math.min(
              100,
              Math.round((100 * periodTotalTokens) / effectiveMonthlyLimit),
            )}
            % of your monthly token allowance.
          </p>
        ) : null}
        <TooltipProvider delayDuration={300}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              This month (UTC) — quota
            </div>
            <StatRow
              label="Billing period"
              hint="Year-month in UTC. Counters reset when the server records the first usage in a new month."
              value={quotaPeriodKey ?? '—'}
            />
            <StatRow
              label="Tokens this month"
              hint={`Total tokens counted toward your monthly quota for this UTC month. Exact: ${formatTokensFull(periodTotalTokens)}.`}
              value={formatTokensCompact(periodTotalTokens)}
            />
            <StatRow
              label="Input tokens (month)"
              hint={`Input tokens recorded this UTC month. Exact: ${formatTokensFull(periodInputTokens)}.`}
              value={formatTokensCompact(periodInputTokens)}
            />
            <StatRow
              label="Output tokens (month)"
              hint={`Output tokens recorded this UTC month. Exact: ${formatTokensFull(periodOutputTokens)}.`}
              value={formatTokensCompact(periodOutputTokens)}
            />
            <StatRow
              label="Your monthly limit"
              hint={
                monthlyLimit != null
                  ? `From Firestore preferences (monthlyTokenLimit).${effectiveMonthlyLimit != null ? ` Exact: ${formatTokensFull(effectiveMonthlyLimit)}.` : ''}`
                  : effectiveMonthlyLimit != null
                    ? `Default from the proxy (TOKEN_QUOTA_PERIOD_MAX_TOKENS), fetched via POST /token-quota-status when possible; NEXT_PUBLIC_TOKEN_QUOTA_PERIOD_MAX_TOKENS is only a UI fallback if the proxy is unreachable.${proxyDefaultLimit === 'pending' ? ' (Showing build fallback until the proxy responds.)' : ''} Exact: ${formatTokensFull(effectiveMonthlyLimit)}.`
                    : 'Unlimited: no preference or proxy default cap (TOKEN_QUOTA_PERIOD_MAX_TOKENS unset or 0).'
              }
              value={
                effectiveMonthlyLimit != null
                  ? formatTokensCompact(effectiveMonthlyLimit)
                  : 'Unlimited'
              }
            />
            <div className="sm:col-span-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              All time
            </div>
            <StatRow
              label="Total tokens"
              hint={`Total token count as recorded by the backend (input + output when both are available). Exact: ${formatTokensFull(totalTokens)}.`}
              value={formatTokensCompact(totalTokens)}
            />
            <StatRow
              label="Input tokens"
              hint={`Tokens sent to the model (prompts, context, including multimodal). Exact: ${formatTokensFull(inputTokens)}.`}
              value={formatTokensCompact(inputTokens)}
            />
            <StatRow
              label="Output tokens"
              hint={`Tokens generated in model responses. Exact: ${formatTokensFull(outputTokens)}.`}
              value={formatTokensCompact(outputTokens)}
            />
            <StatRow
              label="Chat agent streams"
              hint="Number of completed agent streaming runs through the app proxy."
              value={nf.format(agentStreamCount)}
            />
            <StatRow
              label="Background AI calls"
              hint="Number of Gemini API calls from workers (e.g. checkpoint analysis and embeddings)."
              value={nf.format(workerLlmCallCount)}
            />
          </div>
        </TooltipProvider>
        {updatedAt ? (
          <p className="text-xs text-muted-foreground">Last updated: {updatedAt}</p>
        ) : totalTokens === 0 && agentStreamCount === 0 && workerLlmCallCount === 0 ? (
          <p className="text-xs text-muted-foreground">
            No usage recorded yet. Numbers appear after you use the assistant or checkpoint AI.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
