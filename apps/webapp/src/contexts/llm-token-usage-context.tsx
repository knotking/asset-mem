'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { apiUrls } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { createLogger } from '@/lib/logger';
import { FREE_PLAN_LIMITS } from '@/lib/plan-limits-public';

const quotaLog = createLogger('quota');

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

export type PlanLimitSlice = {
  used: number;
  limit: number;
  unlimited: boolean;
};

export type LlmTokenUsageSnapshot = {
  loading: boolean;
  error: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  agentStreamCount: number;
  workerLlmCallCount: number;
  updatedAt: string | null;
  quotaPeriodKey: string | null;
  periodTotalTokens: number;
  periodInputTokens: number;
  periodOutputTokens: number;
  periodDocumentCreations: number;
  periodCheckpointCreations: number;
  monthlyLimit: number | null;
  /** Resolved cap for UI: Firestore prefs, else proxy /token-quota-status */
  effectiveMonthlyLimit: number | null;
  /** pending = still fetching proxy; null = proxy returned unlimited (0); number = cap from proxy */
  proxyDefaultLimit: 'pending' | number | null;
  /** True until prefs and proxy quota (when no Firestore override) have settled. */
  limitsLoading: boolean;
  documentsLimit: PlanLimitSlice | null;
  checkpointsLimit: PlanLimitSlice | null;
};

const empty: Omit<
  LlmTokenUsageSnapshot,
  | 'loading'
  | 'error'
  | 'monthlyLimit'
  | 'effectiveMonthlyLimit'
  | 'proxyDefaultLimit'
  | 'documentsLimit'
  | 'checkpointsLimit'
  | 'limitsLoading'
> = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  agentStreamCount: 0,
  workerLlmCallCount: 0,
  updatedAt: null,
  quotaPeriodKey: null,
  periodTotalTokens: 0,
  periodInputTokens: 0,
  periodOutputTokens: 0,
  periodDocumentCreations: 0,
  periodCheckpointCreations: 0,
};

function toDisplayPlanLimit(
  raw: { used?: number; limit?: number; unlimited?: boolean } | undefined,
  freeDefault: number,
): PlanLimitSlice | null {
  if (!raw || typeof raw.used !== 'number') {
    return null;
  }
  const unlimited = Boolean(raw.unlimited) || (typeof raw.limit === 'number' && raw.limit <= 0);
  const limit =
    unlimited || typeof raw.limit !== 'number'
      ? freeDefault
      : raw.limit;
  return { used: raw.used, limit, unlimited: false };
}

function useLlmTokenUsageSubscription(userId: string | undefined): LlmTokenUsageSnapshot {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState(empty);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [proxyDefaultLimit, setProxyDefaultLimit] = useState<'pending' | number | null>('pending');
  const [documentsLimit, setDocumentsLimit] = useState<PlanLimitSlice | null>(null);
  const [checkpointsLimit, setCheckpointsLimit] = useState<PlanLimitSlice | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError(null);
      setUsage(empty);
      setMonthlyLimit(null);
      setPrefsLoaded(false);
      setProxyDefaultLimit('pending');
      setDocumentsLimit(null);
      setCheckpointsLimit(null);
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
          setUsage(empty);
          return;
        }
        const d = snap.data();
        setUsage({
          inputTokens: typeof d.inputTokens === 'number' ? d.inputTokens : 0,
          outputTokens: typeof d.outputTokens === 'number' ? d.outputTokens : 0,
          totalTokens: typeof d.totalTokens === 'number' ? d.totalTokens : 0,
          agentStreamCount: typeof d.agentStreamCount === 'number' ? d.agentStreamCount : 0,
          workerLlmCallCount:
            typeof d.workerLlmCallCount === 'number' ? d.workerLlmCallCount : 0,
          updatedAt: formatUpdatedAt(d.updatedAt),
          quotaPeriodKey: typeof d.quotaPeriodKey === 'string' ? d.quotaPeriodKey : null,
          periodTotalTokens: typeof d.periodTotalTokens === 'number' ? d.periodTotalTokens : 0,
          periodInputTokens: typeof d.periodInputTokens === 'number' ? d.periodInputTokens : 0,
          periodOutputTokens:
            typeof d.periodOutputTokens === 'number' ? d.periodOutputTokens : 0,
          periodDocumentCreations:
            typeof d.periodDocumentCreations === 'number' ? d.periodDocumentCreations : 0,
          periodCheckpointCreations:
            typeof d.periodCheckpointCreations === 'number' ? d.periodCheckpointCreations : 0,
        });
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
    setPrefsLoaded(false);
    const prefRef = doc(db, 'users', userId, 'preferences', 'user');
    const unsub = onSnapshot(
      prefRef,
      (snap) => {
        setPrefsLoaded(true);
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
      () => {
        setPrefsLoaded(true);
        setMonthlyLimit(null);
      },
    );
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId || !prefsLoaded) {
      return;
    }

    let cancelled = false;
    if (monthlyLimit == null) {
      setProxyDefaultLimit('pending');
    }

    (async () => {
      try {
        const { proxyFetchWithAuth } = await import('@/lib/correlation-id');
        const { getFirebaseIdTokenForProxy } = await import('@/lib/proxy-auth');
        const res = await proxyFetchWithAuth(
          apiUrls.tokenQuotaStatus(),
          getFirebaseIdTokenForProxy,
          {
            method: 'POST',
            body: JSON.stringify({ user_id: userId }),
          }
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          max_tokens?: unknown;
          documents?: { used?: number; limit?: number; unlimited?: boolean };
          checkpoints?: { used?: number; limit?: number; unlimited?: boolean };
        };
        if (cancelled) return;

        if (monthlyLimit == null) {
          const raw = data.max_tokens;
          const cap =
            typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
          setProxyDefaultLimit(cap > 0 ? cap : null);
        }

        const doc = data.documents;
        setDocumentsLimit(toDisplayPlanLimit(doc, FREE_PLAN_LIMITS.documentsPerMonth));

        const cp = data.checkpoints;
        setCheckpointsLimit(toDisplayPlanLimit(cp, FREE_PLAN_LIMITS.checkpointsPerMonth));
      } catch (err) {
        if (!cancelled) {
          quotaLog.warn('tokenQuotaStatus.fetch.failed', {
            cause: err instanceof Error ? err.message : String(err),
          });
          if (monthlyLimit == null) {
            setProxyDefaultLimit(null);
          }
          setDocumentsLimit(null);
          setCheckpointsLimit(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, prefsLoaded, monthlyLimit]);

  const freeTokenLimit = FREE_PLAN_LIMITS.tokensPerMonth ?? 1_000_000;

  const effectiveMonthlyLimit = useMemo(() => {
    if (monthlyLimit != null && monthlyLimit > 0) {
      return monthlyLimit;
    }
    if (proxyDefaultLimit !== 'pending') {
      if (proxyDefaultLimit != null && proxyDefaultLimit > 0) {
        return proxyDefaultLimit;
      }
      return freeTokenLimit;
    }
    return freeTokenLimit;
  }, [monthlyLimit, proxyDefaultLimit, freeTokenLimit]);

  const limitsLoading =
    Boolean(userId) &&
    (!prefsLoaded || (monthlyLimit == null && proxyDefaultLimit === 'pending'));

  return {
    loading,
    error,
    ...usage,
    monthlyLimit,
    effectiveMonthlyLimit,
    proxyDefaultLimit,
    limitsLoading,
    documentsLimit,
    checkpointsLimit,
  };
}

const LlmTokenUsageContext = createContext<LlmTokenUsageSnapshot | null>(null);

export function LlmTokenUsageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const value = useLlmTokenUsageSubscription(user?.uid);

  return (
    <LlmTokenUsageContext.Provider value={value}>{children}</LlmTokenUsageContext.Provider>
  );
}

export function useLlmTokenUsage(): LlmTokenUsageSnapshot {
  const ctx = useContext(LlmTokenUsageContext);
  if (!ctx) {
    throw new Error('useLlmTokenUsage must be used within LlmTokenUsageProvider');
  }
  return ctx;
}
