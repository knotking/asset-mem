"use client";

import { useEffect } from "react";
import {
  useLlmTokenUsage,
  type PlanLimitSlice,
} from "@/contexts/llm-token-usage-context";
import { usePreferences } from "@/contexts/preferences-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTokensCompact, formatTokensFull } from "@/lib/format-tokens";
import { FREE_PLAN_LIMITS } from "@/lib/plan-limits-public";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-US");

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
          <span className="font-mono text-sm font-medium tabular-nums">
            {value}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs">{hint}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function SectionHeading({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 sm:col-span-2', className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      {subtitle ? (
        <span className="text-[10px] text-muted-foreground">{subtitle}</span>
      ) : null}
    </div>
  );
}

function GroupHeading({ title }: { title: string }) {
  return (
    <div className="sm:col-span-2">
      <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
    </div>
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
    hint: "Plan limit unavailable — see Plan & billing or refresh later.",
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
    periodReportGenerations,
    documentCreations,
    checkpointCreations,
    reportGenerations,
    documentsLimit,
    checkpointsLimit,
    reportsLimit,
  } = useLlmTokenUsage();
  const { preferences, updatePreferences } = usePreferences();

  useEffect(() => {
    if (preferences?.discoveryAiUsageViewed) return;
    void updatePreferences({ discoveryAiUsageViewed: true });
  }, [preferences?.discoveryAiUsageViewed, updatePreferences]);

  const monthlyCap =
    effectiveMonthlyLimit ?? FREE_PLAN_LIMITS.tokensPerMonth ?? 1_000_000;
  const pctUsed =
    monthlyCap > 0
      ? Math.min(100, Math.round((100 * periodTotalTokens) / monthlyCap))
      : null;
  const documentsQuota = formatCreationQuota(
    documentsLimit,
    periodDocumentCreations,
  );
  const checkpointsQuota = formatCreationQuota(
    checkpointsLimit,
    periodCheckpointCreations,
  );
  const reportsQuota = formatCreationQuota(
    reportsLimit,
    periodReportGenerations,
  );
  const monthSubtitle = quotaPeriodKey
    ? `Billing period ${quotaPeriodKey} (UTC). Counters reset at month rollover.`
    : "Billing period not set yet.";

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
          Monthly quotas use calendar months. All-time totals are shown below.
          Limits are enforced on the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {periodTotalTokens >= monthlyCap ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            You are at or over your monthly token limit. AI features may be
            blocked until the next month or your limit is raised.
          </p>
        ) : monthlyCap > 0 && periodTotalTokens >= monthlyCap * 0.9 ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            You have used about {pctUsed}% of your monthly token allowance.
          </p>
        ) : null}

        {pctUsed != null ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-muted/40 px-4 py-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Monthly quota used
            </span>
            <span
              className={
                pctUsed >= 100
                  ? "mt-1 text-4xl font-bold tabular-nums leading-none text-destructive"
                  : pctUsed >= 90
                    ? "mt-1 text-4xl font-bold tabular-nums leading-none text-amber-600 dark:text-amber-400"
                    : "mt-1 text-4xl font-bold tabular-nums leading-none text-emerald-700 dark:text-emerald-400"
              }
            >
              {pctUsed}%
            </span>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {formatTokensCompact(periodTotalTokens)} of{" "}
              {formatTokensCompact(monthlyCap)} tokens
            </p>
          </div>
        ) : null}

        <TooltipProvider delayDuration={300}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SectionHeading title="This month" subtitle={monthSubtitle} />
            <GroupHeading title="Tokens" />
            <StatRow
              label="Limit"
              hint={
                monthlyLimit != null
                  ? `Exact: ${formatTokensFull(monthlyCap)}. Matches the ring above.`
                  : `${proxyDefaultLimit === "pending" ? "Checking proxy… " : ""}Exact: ${formatTokensFull(monthlyCap)}.`
              }
              value={formatTokensCompact(monthlyCap)}
            />
            <StatRow
              label="Used"
              hint={`Counted toward your monthly quota. Exact: ${formatTokensFull(periodTotalTokens)}.`}
              value={formatTokensCompact(periodTotalTokens)}
            />
            <StatRow
              label="Input"
              hint={`Exact: ${formatTokensFull(periodInputTokens)}.`}
              value={formatTokensCompact(periodInputTokens)}
            />
            <StatRow
              label="Output"
              hint={`Exact: ${formatTokensFull(periodOutputTokens)}.`}
              value={formatTokensCompact(periodOutputTokens)}
            />
            <GroupHeading title="Creations" />
            <StatRow
              label="Documents AI"
              hint={`Extractions and RAG imports (one per file). ${documentsQuota.hint}`}
              value={documentsQuota.value}
            />
            <StatRow
              label="Checkpoint AI"
              hint={`Analyses queued through the proxy. ${checkpointsQuota.hint}`}
              value={checkpointsQuota.value}
            />
            <StatRow
              label="Reports"
              hint={`Property report generations. ${reportsQuota.hint}`}
              value={reportsQuota.value}
            />

            <SectionHeading
              title="All time"
              subtitle="Lifetime totals since you started using AI features."
              className="mt-6"
            />
            <GroupHeading title="Tokens" />
            <StatRow
              label="Total"
              hint={`Exact: ${formatTokensFull(totalTokens)}.`}
              value={formatTokensCompact(totalTokens)}
            />
            <StatRow
              label="Input"
              hint={`Exact: ${formatTokensFull(inputTokens)}.`}
              value={formatTokensCompact(inputTokens)}
            />
            <StatRow
              label="Output"
              hint={`Exact: ${formatTokensFull(outputTokens)}.`}
              value={formatTokensCompact(outputTokens)}
            />
            <GroupHeading title="Creations" />
            <StatRow
              label="Documents AI"
              hint="Lifetime document extractions and RAG imports (one per file)."
              value={nf.format(documentCreations)}
            />
            <StatRow
              label="Checkpoint AI"
              hint="Lifetime checkpoint analyses queued through the proxy."
              value={nf.format(checkpointCreations)}
            />
            <StatRow
              label="Reports"
              hint="Lifetime property report generations."
              value={nf.format(reportGenerations)}
            />
            <GroupHeading title="Activity" />
            <StatRow
              label="Chat agent streams"
              hint="Completed agent runs through the app proxy."
              value={nf.format(agentStreamCount)}
            />
            <StatRow
              label="Background AI calls"
              hint="Worker Gemini calls (checkpoint analysis, embeddings, etc.)."
              value={nf.format(workerLlmCallCount)}
            />
          </div>
        </TooltipProvider>
        {updatedAt ? (
          <p className="text-xs text-muted-foreground">
            Last updated: {updatedAt}
          </p>
        ) : totalTokens === 0 &&
          agentStreamCount === 0 &&
          workerLlmCallCount === 0 ? (
          <p className="text-xs text-muted-foreground">
            No usage recorded yet. Numbers appear after you use the assistant or
            checkpoint AI.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
