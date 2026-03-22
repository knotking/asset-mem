import * as React from 'react';
import { View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLlmTokenUsage } from '@homeapp/common/contexts/llm-token-usage-context';
import { formatTokensCompact, formatTokensFull } from '@homeapp/common/lib/format-tokens';
import { cn } from '@/lib/utils';

const nf = new Intl.NumberFormat('en-US');

function StatRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View className="gap-0.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="font-mono text-sm font-medium tabular-nums text-foreground">{value}</Text>
      {hint ? (
        <Text className="text-[10px] leading-tight text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
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
          <View className="flex-row items-center gap-2">
            <Icon as={Activity} className="size-5 text-foreground" />
            <CardTitle>AI usage</CardTitle>
          </View>
          <CardDescription>Aggregated token usage from chat and background features</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-28 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <View className="flex-row items-center gap-2">
            <Icon as={Activity} className="size-5 text-foreground" />
            <CardTitle>AI usage</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <Text className="text-sm text-destructive">{error}</Text>
        </CardContent>
      </Card>
    );
  }

  const pctUsed =
    effectiveMonthlyLimit != null && effectiveMonthlyLimit > 0
      ? Math.min(100, Math.round((100 * periodTotalTokens) / effectiveMonthlyLimit))
      : null;

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <Icon as={Activity} className="size-5 text-foreground" />
          <CardTitle>AI usage</CardTitle>
        </View>
        <CardDescription>
          Monthly quotas use calendar months. All-time totals below. Limits enforced on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        {effectiveMonthlyLimit != null && periodTotalTokens >= effectiveMonthlyLimit ? (
          <Text className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            You are at or over your monthly token limit. AI features may be blocked until the next
            month or your limit is raised.
          </Text>
        ) : effectiveMonthlyLimit != null && periodTotalTokens >= effectiveMonthlyLimit * 0.9 ? (
          <Text className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            You have used about {pctUsed}% of your monthly token allowance.
          </Text>
        ) : null}

        {pctUsed != null ? (
          <View className="items-center rounded-xl border border-border bg-muted/40 px-4 py-4">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Monthly quota used
            </Text>
            <Text
              className={cn(
                'mt-1 text-4xl font-bold tabular-nums leading-none',
                pctUsed >= 100 && 'text-destructive',
                pctUsed >= 90 && pctUsed < 100 && 'text-amber-600 dark:text-amber-400',
                pctUsed < 90 && 'text-emerald-700 dark:text-emerald-400',
              )}>
              {pctUsed}%
            </Text>
            <Text className="mt-2 text-center text-xs text-muted-foreground">
              {formatTokensCompact(periodTotalTokens)} of {formatTokensCompact(effectiveMonthlyLimit)}{' '}
              tokens this month
            </Text>
          </View>
        ) : (
          <View className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
            <Text className="text-center text-sm text-muted-foreground">
              No monthly token cap is set, so usage isn’t shown as a percentage. See limits below if
              your org configures one via Firestore or the proxy.
            </Text>
          </View>
        )}

        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          This month — quota
        </Text>
        <StatRow label="Billing period" value={quotaPeriodKey ?? '—'} />
        <StatRow
          label="Tokens this month"
          value={formatTokensCompact(periodTotalTokens)}
          hint={`Exact: ${formatTokensFull(periodTotalTokens)}.`}
        />
        <StatRow
          label="Input tokens (month)"
          value={formatTokensCompact(periodInputTokens)}
          hint={`Exact: ${formatTokensFull(periodInputTokens)}.`}
        />
        <StatRow
          label="Output tokens (month)"
          value={formatTokensCompact(periodOutputTokens)}
          hint={`Exact: ${formatTokensFull(periodOutputTokens)}.`}
        />
        <StatRow
          label="Your monthly limit"
          value={
            effectiveMonthlyLimit != null ? formatTokensCompact(effectiveMonthlyLimit) : 'Unlimited'
          }
          hint={
            monthlyLimit != null
              ? `From Firestore preferences (monthlyTokenLimit).${effectiveMonthlyLimit != null ? ` Exact: ${formatTokensFull(effectiveMonthlyLimit)}.` : ''}`
              : effectiveMonthlyLimit != null
                ? `From proxy / token-quota-status.${proxyDefaultLimit === 'pending' ? ' (Showing env fallback until proxy responds.)' : ''} Exact: ${formatTokensFull(effectiveMonthlyLimit)}.`
                : 'Unlimited: no preference or proxy default cap.'
          }
        />

        <Text className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          All time
        </Text>
        <StatRow
          label="Total tokens"
          value={formatTokensCompact(totalTokens)}
          hint={`Exact: ${formatTokensFull(totalTokens)}.`}
        />
        <StatRow
          label="Input tokens"
          value={formatTokensCompact(inputTokens)}
          hint={`Exact: ${formatTokensFull(inputTokens)}.`}
        />
        <StatRow
          label="Output tokens"
          value={formatTokensCompact(outputTokens)}
          hint={`Exact: ${formatTokensFull(outputTokens)}.`}
        />
        <StatRow label="Chat agent streams" value={nf.format(agentStreamCount)} />
        <StatRow label="Background AI calls" value={nf.format(workerLlmCallCount)} />

        {updatedAt ? (
          <Text className="text-xs text-muted-foreground">Last updated: {updatedAt}</Text>
        ) : totalTokens === 0 && agentStreamCount === 0 && workerLlmCallCount === 0 ? (
          <Text className="text-xs text-muted-foreground">
            No usage recorded yet. Numbers appear after you use the assistant or checkpoint AI.
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
