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
import { getPublicDefaultMonthlyTokenLimit } from '@/lib/token-quota-public';
import { apiUrls } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { createLogger } from '@/lib/logger';

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
  monthlyLimit: number | null;
  /** Resolved cap for UI: prefs, then proxy default, then build-time fallback */
  effectiveMonthlyLimit: number | null;
  /** pending = still fetching proxy; null = unlimited from proxy; number = cap from proxy */
  proxyDefaultLimit: 'pending' | number | null;
};

const empty: Omit<
  LlmTokenUsageSnapshot,
  'loading' | 'error' | 'monthlyLimit' | 'effectiveMonthlyLimit' | 'proxyDefaultLimit'
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
};

function useLlmTokenUsageSubscription(userId: string | undefined): LlmTokenUsageSnapshot {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState(empty);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [proxyDefaultLimit, setProxyDefaultLimit] = useState<'pending' | number | null>('pending');

  const envDefault = useMemo(() => getPublicDefaultMonthlyTokenLimit(), []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError(null);
      setUsage(empty);
      setMonthlyLimit(null);
      setPrefsLoaded(false);
      setProxyDefaultLimit('pending');
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
    if (!userId || !prefsLoaded || monthlyLimit != null) {
      return;
    }

    let cancelled = false;
    setProxyDefaultLimit('pending');

    (async () => {
      try {
        const { proxyFetch } = await import('@/lib/correlation-id');
        const res = await proxyFetch(apiUrls.tokenQuotaStatus(), {
          method: 'POST',
          body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as { max_tokens?: unknown };
        const raw = data.max_tokens;
        const cap =
          typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
        if (cancelled) return;
        setProxyDefaultLimit(cap > 0 ? cap : null);
      } catch (err) {
        if (!cancelled) {
          quotaLog.warn('tokenQuotaStatus.fetch.failed', {
            cause: err instanceof Error ? err.message : String(err),
          });
          setProxyDefaultLimit('pending');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, prefsLoaded, monthlyLimit]);

  const effectiveMonthlyLimit = useMemo(() => {
    if (monthlyLimit != null) {
      return monthlyLimit;
    }
    if (proxyDefaultLimit !== 'pending') {
      if (proxyDefaultLimit != null && proxyDefaultLimit > 0) {
        return proxyDefaultLimit;
      }
      return null;
    }
    return envDefault;
  }, [monthlyLimit, proxyDefaultLimit, envDefault]);

  return {
    loading,
    error,
    ...usage,
    monthlyLimit,
    effectiveMonthlyLimit,
    proxyDefaultLimit,
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
