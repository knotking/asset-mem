'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

function formatUpdatedAt(value: unknown): string | null {
  if (value == null) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toLocaleString();
    } catch {
      return null;
    }
  }
  return null;
}

export function AiUsageSettings({ userId }: { userId: string | undefined }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [agentStreamCount, setAgentStreamCount] = useState(0);
  const [workerLlmCallCount, setWorkerLlmCallCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [quotaPeriodKey, setQuotaPeriodKey] = useState<string | null>(null);
  const [periodTotalTokens, setPeriodTotalTokens] = useState(0);
  const [periodInputTokens, setPeriodInputTokens] = useState(0);
  const [periodOutputTokens, setPeriodOutputTokens] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    const ref = doc(db, 'llm_token_usage', userId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setInputTokens(0);
          setOutputTokens(0);
          setTotalTokens(0);
          setAgentStreamCount(0);
          setWorkerLlmCallCount(0);
          setUpdatedAt(null);
          setQuotaPeriodKey(null);
          setPeriodTotalTokens(0);
          setPeriodInputTokens(0);
          setPeriodOutputTokens(0);
          return;
        }
        const d = snap.data();
        setInputTokens(typeof d.inputTokens === 'number' ? d.inputTokens : 0);
        setOutputTokens(typeof d.outputTokens === 'number' ? d.outputTokens : 0);
        setTotalTokens(typeof d.totalTokens === 'number' ? d.totalTokens : 0);
        setAgentStreamCount(typeof d.agentStreamCount === 'number' ? d.agentStreamCount : 0);
        setWorkerLlmCallCount(
          typeof d.workerLlmCallCount === 'number' ? d.workerLlmCallCount : 0,
        );
        setUpdatedAt(formatUpdatedAt(d.updatedAt));
        setQuotaPeriodKey(typeof d.quotaPeriodKey === 'string' ? d.quotaPeriodKey : null);
        setPeriodTotalTokens(typeof d.periodTotalTokens === 'number' ? d.periodTotalTokens : 0);
        setPeriodInputTokens(typeof d.periodInputTokens === 'number' ? d.periodInputTokens : 0);
        setPeriodOutputTokens(typeof d.periodOutputTokens === 'number' ? d.periodOutputTokens : 0);
      },
      (err) => {
        setLoading(false);
        setError(err.message || 'Could not load usage');
      },
    );

    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const prefRef = doc(db, 'users', userId, 'preferences', 'user');
    const unsub = onSnapshot(
      prefRef,
      (snap) => {
        if (!snap.exists()) {
          setMonthlyLimit(null);
          return;
        }
        const v = snap.data()?.monthlyTokenLimit;
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          setMonthlyLimit(v);
        } else {
          setMonthlyLimit(null);
        }
      },
      () => setMonthlyLimit(null),
    );
    return () => unsub();
  }, [userId]);

  if (!userId) {
    return null;
  }

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
        {monthlyLimit != null && periodTotalTokens >= monthlyLimit ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            You are at or over your personal monthly token limit. AI features may be blocked until
            the next UTC month or your limit is raised.
          </p>
        ) : monthlyLimit != null && periodTotalTokens >= monthlyLimit * 0.9 ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            You have used about {(100 * periodTotalTokens) / monthlyLimit}% of your monthly token
            allowance.
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
              hint="Total tokens counted toward your monthly quota for this UTC month."
              value={nf.format(periodTotalTokens)}
            />
            <StatRow
              label="Input tokens (month)"
              hint="Input tokens recorded this UTC month."
              value={nf.format(periodInputTokens)}
            />
            <StatRow
              label="Output tokens (month)"
              hint="Output tokens recorded this UTC month."
              value={nf.format(periodOutputTokens)}
            />
            <StatRow
              label="Your monthly limit"
              hint="Set as monthlyTokenLimit on your preferences doc (admin). If unset, the server may still apply a default via environment."
              value={
                monthlyLimit != null ? nf.format(monthlyLimit) : 'Not set (server default if any)'
              }
            />
            <div className="sm:col-span-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              All time
            </div>
            <StatRow
              label="Total tokens"
              hint="Total token count as recorded by the backend (input + output when both are available)."
              value={nf.format(totalTokens)}
            />
            <StatRow
              label="Input tokens"
              hint="Tokens sent to the model (prompts, context, including multimodal)."
              value={nf.format(inputTokens)}
            />
            <StatRow
              label="Output tokens"
              hint="Tokens generated in model responses."
              value={nf.format(outputTokens)}
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
