"use client";

import { useLlmTokenUsage } from "@/contexts/llm-token-usage-context";
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
    documentsLimit,
    checkpointsLimit,
    limitsLoading,
  } = useLlmTokenUsage();

  const monthlyCap =
    effectiveMonthlyLimit ?? FREE_PLAN_LIMITS.tokensPerMonth ?? 1_000_000;
  const pctUsed =
    monthlyCap > 0
      ? Math.min(100, Math.round((100 * periodTotalTokens) / monthlyCap))
      : null;

  if (loading || limitsLoading) {
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
            <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              This month — quota
            </div>
            <StatRow
              label="Billing period"
              hint="Year-month label. Counters reset when the server records the first usage in a new month."
              value={quotaPeriodKey ?? "—"}
            />
            <StatRow
              label="Tokens this month"
              hint={`Total tokens counted toward your monthly quota for this month. Exact: ${formatTokensFull(periodTotalTokens)}.`}
              value={formatTokensCompact(periodTotalTokens)}
            />
            <StatRow
              label="Input tokens (month)"
              hint={`Input tokens recorded this month. Exact: ${formatTokensFull(periodInputTokens)}.`}
              value={formatTokensCompact(periodInputTokens)}
            />
            <StatRow
              label="Output tokens (month)"
              hint={`Output tokens recorded this month. Exact: ${formatTokensFull(periodOutputTokens)}.`}
              value={formatTokensCompact(periodOutputTokens)}
            />
            <StatRow
              label="Documents this month"
              hint="Queued document extractions and RAG file imports (each file counts once)."
              value={nf.format(periodDocumentCreations)}
            />
            <StatRow
              label="Document limit"
              hint={
                documentsLimit
                  ? `Enforced when queuing analysis or RAG import. ${documentsLimit.used} of ${documentsLimit.limit} used.`
                  : "Could not load from proxy; see Plan & billing for subscription caps."
              }
              value={
                documentsLimit
                  ? `${nf.format(documentsLimit.used)} / ${nf.format(documentsLimit.limit)}`
                  : "—"
              }
            />
            <StatRow
              label="Checkpoint AI this month"
              hint="Checkpoint analyses queued through the proxy."
              value={nf.format(periodCheckpointCreations)}
            />
            <StatRow
              label="Checkpoint limit"
              hint={
                checkpointsLimit
                  ? `Enforced when starting checkpoint analysis. ${checkpointsLimit.used} of ${checkpointsLimit.limit} used.`
                  : "Could not load from proxy; see Plan & billing for subscription caps."
              }
              value={
                checkpointsLimit
                  ? `${nf.format(checkpointsLimit.used)} / ${nf.format(checkpointsLimit.limit)}`
                  : "—"
              }
            />
            <StatRow
              label="Your monthly limit"
              hint={
                monthlyLimit != null
                  ? `Exact: ${formatTokensFull(monthlyCap)}.`
                  : `${proxyDefaultLimit === "pending" ? " Checking..." : ""} Exact: ${formatTokensFull(monthlyCap)}.`
              }
              value={formatTokensCompact(monthlyCap)}
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
