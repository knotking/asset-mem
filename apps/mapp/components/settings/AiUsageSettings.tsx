import * as React from 'react';
import { View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useLlmTokenUsage,
  type PlanLimitSlice,
} from '@homeapp/common/contexts/llm-token-usage-context';
import { formatTokensCompact, formatTokensFull } from '@homeapp/common/lib/format-tokens';
import { FREE_PLAN_TOKENS_PER_MONTH } from '@homeapp/common/lib/plan-defaults';
import { usePreferences } from '@homeapp/common/contexts/preferences-context';
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

function UsageSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('gap-3', className)}>
      <View className="gap-0.5">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[10px] text-muted-foreground">{subtitle}</Text>
        ) : null}
      </View>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function UsageGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-[11px] font-medium text-muted-foreground">{title}</Text>
      <View className="gap-2">{children}</View>
    </View>
  );
}

function formatCreationQuota(
  slice: PlanLimitSlice | null,
  periodCount: number,
): { value: string; hint: string } {
  if (slice) {
    return {
      value: `${nf.format(slice.used)} / ${nf.format(slice.limit)}`,
      hint: `${slice.used} used this month; plan allows ${slice.limit} per month.`,
    };
  }
  return {
    value: nf.format(periodCount),
    hint: 'Plan limit unavailable — open Plan & billing or refresh later.',
  };
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
    periodDocumentCreations,
    periodCheckpointCreations,
    documentCreations,
    checkpointCreations,
    documentsLimit,
    checkpointsLimit,
  } = useLlmTokenUsage();
  const { preferences, updatePreferences } = usePreferences();

  React.useEffect(() => {
    if (preferences?.discoveryAiUsageViewed) return;
    void updatePreferences({ discoveryAiUsageViewed: true });
  }, [preferences?.discoveryAiUsageViewed, updatePreferences]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <View className="flex-row items-center gap-2">
            <Icon as={Activity} className="size-5 text-foreground" />
            <CardTitle>AI usage</CardTitle>
          </View>
          <CardDescription>
            Aggregated token usage from chat and background features
          </CardDescription>
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

  const monthlyCap = effectiveMonthlyLimit ?? FREE_PLAN_TOKENS_PER_MONTH;
  const pctUsed =
    monthlyCap > 0 ? Math.min(100, Math.round((100 * periodTotalTokens) / monthlyCap)) : null;
  const documentsQuota = formatCreationQuota(documentsLimit, periodDocumentCreations);
  const checkpointsQuota = formatCreationQuota(checkpointsLimit, periodCheckpointCreations);
  const monthSubtitle = quotaPeriodKey
    ? `Billing period ${quotaPeriodKey} (UTC). Counters reset at month rollover.`
    : 'Billing period not set yet.';

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
        {periodTotalTokens >= monthlyCap ? (
          <Text className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            You are at or over your monthly token limit. AI features may be blocked until the next
            month or your limit is raised.
          </Text>
        ) : monthlyCap > 0 && periodTotalTokens >= monthlyCap * 0.9 ? (
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
                pctUsed < 90 && 'text-emerald-700 dark:text-emerald-400'
              )}>
              {pctUsed}%
            </Text>
            <Text className="mt-2 text-center text-xs text-muted-foreground">
              {formatTokensCompact(periodTotalTokens)} of {formatTokensCompact(monthlyCap)} tokens
              this month
            </Text>
          </View>
        ) : null}

        <UsageSection title="This month" subtitle={monthSubtitle}>
          <UsageGroup title="Tokens">
            <StatRow
              label="Limit"
              value={formatTokensCompact(monthlyCap)}
              hint={
                monthlyLimit != null
                  ? `Exact: ${formatTokensFull(monthlyCap)}. Matches the ring above.`
                  : `${proxyDefaultLimit === 'pending' ? 'Waiting for proxy. ' : ''}Exact: ${formatTokensFull(monthlyCap)}.`
              }
            />
            <StatRow
              label="Used"
              value={formatTokensCompact(periodTotalTokens)}
              hint={`Counted toward your monthly quota. Exact: ${formatTokensFull(periodTotalTokens)}.`}
            />
            <StatRow
              label="Input"
              value={formatTokensCompact(periodInputTokens)}
              hint={`Exact: ${formatTokensFull(periodInputTokens)}.`}
            />
            <StatRow
              label="Output"
              value={formatTokensCompact(periodOutputTokens)}
              hint={`Exact: ${formatTokensFull(periodOutputTokens)}.`}
            />
          </UsageGroup>
          <UsageGroup title="Creations">
            <StatRow
              label="Documents AI"
              value={documentsQuota.value}
              hint={`Extractions and RAG imports (one per file). ${documentsQuota.hint}`}
            />
            <StatRow
              label="Checkpoint AI"
              value={checkpointsQuota.value}
              hint={`Analyses queued through the proxy. ${checkpointsQuota.hint}`}
            />
          </UsageGroup>
        </UsageSection>

        <UsageSection
          title="All time"
          subtitle="Lifetime totals since you started using AI features."
          className="mt-6">
          <UsageGroup title="Tokens">
            <StatRow
              label="Total"
              value={formatTokensCompact(totalTokens)}
              hint={`Exact: ${formatTokensFull(totalTokens)}.`}
            />
            <StatRow
              label="Input"
              value={formatTokensCompact(inputTokens)}
              hint={`Exact: ${formatTokensFull(inputTokens)}.`}
            />
            <StatRow
              label="Output"
              value={formatTokensCompact(outputTokens)}
              hint={`Exact: ${formatTokensFull(outputTokens)}.`}
            />
          </UsageGroup>
          <UsageGroup title="Creations">
            <StatRow
              label="Documents AI"
              value={nf.format(documentCreations)}
              hint="Lifetime document extractions and RAG imports (one per file)."
            />
            <StatRow
              label="Checkpoint AI"
              value={nf.format(checkpointCreations)}
              hint="Lifetime checkpoint analyses queued through the proxy."
            />
          </UsageGroup>
          <UsageGroup title="Activity">
            <StatRow
              label="Chat agent streams"
              value={nf.format(agentStreamCount)}
              hint="Completed agent runs through the app proxy."
            />
            <StatRow
              label="Background AI calls"
              value={nf.format(workerLlmCallCount)}
              hint="Worker Gemini calls (checkpoint analysis, embeddings, etc.)."
            />
          </UsageGroup>
        </UsageSection>

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
