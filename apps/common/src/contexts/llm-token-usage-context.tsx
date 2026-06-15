import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, onSnapshot, type Firestore } from "firebase/firestore";
import { createLogger } from "../lib/logger";
import {
  FREE_PLAN_CHECKPOINTS_PER_MONTH,
  FREE_PLAN_DOCUMENTS_PER_MONTH,
  FREE_PLAN_REPORTS_PER_MONTH,
  FREE_PLAN_TOKENS_PER_MONTH,
} from "../lib/plan-defaults";
import {
  type PlanLimitSlice,
  mergePlanLimitUsage,
  toDisplayPlanLimit,
} from "../lib/plan-limit-slice";
import { proxyFetchWithAuth, type GetFirebaseIdToken } from "../lib/correlation-id";

const quotaLog = createLogger("quota");

function formatUpdatedAt(value: unknown): string | null {
  if (value == null) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toLocaleString();
    } catch {
      return null;
    }
  }
  return null;
}

export type { PlanLimitSlice } from "../lib/plan-limit-slice";

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
  periodReportGenerations: number;
  documentCreations: number;
  checkpointCreations: number;
  reportGenerations: number;
  monthlyLimit: number | null;
  effectiveMonthlyLimit: number | null;
  proxyDefaultLimit: "pending" | number | null;
  limitsLoading: boolean;
  documentsLimit: PlanLimitSlice | null;
  checkpointsLimit: PlanLimitSlice | null;
  reportsLimit: PlanLimitSlice | null;
};

const empty: Omit<
  LlmTokenUsageSnapshot,
  | "loading"
  | "error"
  | "monthlyLimit"
  | "effectiveMonthlyLimit"
  | "proxyDefaultLimit"
  | "limitsLoading"
  | "documentsLimit"
  | "checkpointsLimit"
  | "reportsLimit"
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
  periodReportGenerations: 0,
  documentCreations: 0,
  checkpointCreations: 0,
  reportGenerations: 0,
};

export type LlmTokenUsageProviderProps = {
  children: React.ReactNode;
  db: Firestore;
  uid: string | undefined;
  tokenQuotaStatusUrl: string;
  getIdToken: GetFirebaseIdToken;
  publicDefaultMonthlyTokenLimit?: number | null;
};

function useLlmTokenUsageSubscription(
  userId: string | undefined,
  db: Firestore | undefined,
  tokenQuotaStatusUrl: string,
  getIdToken: GetFirebaseIdToken,
  envDefault: number | null
): LlmTokenUsageSnapshot {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState(empty);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [proxyDefaultLimit, setProxyDefaultLimit] = useState<
    "pending" | number | null
  >("pending");
  const [documentsLimit, setDocumentsLimit] = useState<PlanLimitSlice | null>(
    null,
  );
  const [checkpointsLimit, setCheckpointsLimit] = useState<PlanLimitSlice | null>(
    null,
  );
  const [reportsLimit, setReportsLimit] = useState<PlanLimitSlice | null>(null);

  useEffect(() => {
    if (!userId || !db) {
      setLoading(false);
      setError(null);
      setUsage(empty);
      setMonthlyLimit(null);
      setPrefsLoaded(false);
      setProxyDefaultLimit("pending");
      setDocumentsLimit(null);
      setCheckpointsLimit(null);
      setReportsLimit(null);
      return;
    }

    setError(null);
    setLoading(true);

    const ref = doc(db, "llm_token_usage", userId);
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
          inputTokens: typeof d.inputTokens === "number" ? d.inputTokens : 0,
          outputTokens:
            typeof d.outputTokens === "number" ? d.outputTokens : 0,
          totalTokens: typeof d.totalTokens === "number" ? d.totalTokens : 0,
          agentStreamCount:
            typeof d.agentStreamCount === "number" ? d.agentStreamCount : 0,
          workerLlmCallCount:
            typeof d.workerLlmCallCount === "number"
              ? d.workerLlmCallCount
              : 0,
          updatedAt: formatUpdatedAt(d.updatedAt),
          quotaPeriodKey:
            typeof d.quotaPeriodKey === "string" ? d.quotaPeriodKey : null,
          periodTotalTokens:
            typeof d.periodTotalTokens === "number" ? d.periodTotalTokens : 0,
          periodInputTokens:
            typeof d.periodInputTokens === "number"
              ? d.periodInputTokens
              : 0,
          periodOutputTokens:
            typeof d.periodOutputTokens === "number"
              ? d.periodOutputTokens
              : 0,
          periodDocumentCreations:
            typeof d.periodDocumentCreations === "number"
              ? d.periodDocumentCreations
              : 0,
          periodCheckpointCreations:
            typeof d.periodCheckpointCreations === "number"
              ? d.periodCheckpointCreations
              : 0,
          periodReportGenerations:
            typeof d.periodReportGenerations === "number"
              ? d.periodReportGenerations
              : 0,
          documentCreations:
            typeof d.documentCreations === "number" ? d.documentCreations : 0,
          checkpointCreations:
            typeof d.checkpointCreations === "number"
              ? d.checkpointCreations
              : 0,
          reportGenerations:
            typeof d.reportGenerations === "number" ? d.reportGenerations : 0,
        });
      },
      (err) => {
        setLoading(false);
        setError(err.message || "Could not load usage");
      }
    );

    return () => unsub();
  }, [userId, db]);

  useEffect(() => {
    if (!userId || !db) return;
    setPrefsLoaded(false);
    const prefRef = doc(db, "users", userId, "preferences", "user");
    const unsub = onSnapshot(
      prefRef,
      (snap) => {
        setPrefsLoaded(true);
        if (!snap.exists()) {
          setMonthlyLimit(null);
          return;
        }
        const v = snap.data()?.monthlyTokenLimit;
        if (typeof v === "number" && Number.isFinite(v) && v > 0) {
          setMonthlyLimit(v);
        } else {
          setMonthlyLimit(null);
        }
      },
      () => {
        setPrefsLoaded(true);
        setMonthlyLimit(null);
      }
    );
    return () => unsub();
  }, [userId, db]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (!tokenQuotaStatusUrl?.trim()) {
      if (monthlyLimit == null) {
        setProxyDefaultLimit("pending");
      }
      return;
    }

    let cancelled = false;
    if (monthlyLimit == null) {
      setProxyDefaultLimit("pending");
    }

    (async () => {
      try {
        const res = await proxyFetchWithAuth(tokenQuotaStatusUrl, getIdToken, {
          method: "POST",
          body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          max_tokens?: unknown;
          documents?: { used?: number; limit?: number; unlimited?: boolean };
          checkpoints?: { used?: number; limit?: number; unlimited?: boolean };
          reports?: { used?: number; limit?: number; unlimited?: boolean };
        };
        if (cancelled) return;

        if (monthlyLimit == null) {
          const raw = data.max_tokens;
          const cap =
            typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
          setProxyDefaultLimit(cap > 0 ? cap : null);
        }

        setDocumentsLimit(
          toDisplayPlanLimit(data.documents, FREE_PLAN_DOCUMENTS_PER_MONTH),
        );
        setCheckpointsLimit(
          toDisplayPlanLimit(data.checkpoints, FREE_PLAN_CHECKPOINTS_PER_MONTH),
        );
        setReportsLimit(
          toDisplayPlanLimit(data.reports, FREE_PLAN_REPORTS_PER_MONTH),
        );
      } catch (err) {
        if (!cancelled) {
          quotaLog.warn("tokenQuotaStatus.fetch.failed", {
            cause: err instanceof Error ? err.message : String(err),
          });
          if (monthlyLimit == null) {
            setProxyDefaultLimit(null);
          }
          setDocumentsLimit(null);
          setCheckpointsLimit(null);
          setReportsLimit(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, monthlyLimit, tokenQuotaStatusUrl, getIdToken]);

  const effectiveMonthlyLimit = useMemo(() => {
    if (monthlyLimit != null && monthlyLimit > 0) {
      return monthlyLimit;
    }
    if (proxyDefaultLimit !== "pending") {
      if (proxyDefaultLimit != null && proxyDefaultLimit > 0) {
        return proxyDefaultLimit;
      }
      return envDefault ?? FREE_PLAN_TOKENS_PER_MONTH;
    }
    return envDefault ?? FREE_PLAN_TOKENS_PER_MONTH;
  }, [monthlyLimit, proxyDefaultLimit, envDefault]);

  const limitsLoading =
    Boolean(userId) &&
    (!prefsLoaded || (monthlyLimit == null && proxyDefaultLimit === "pending"));

  const documentsLimitLive = useMemo(
    () =>
      mergePlanLimitUsage(
        documentsLimit,
        usage.periodDocumentCreations,
        usage.quotaPeriodKey,
      ),
    [documentsLimit, usage.periodDocumentCreations, usage.quotaPeriodKey],
  );
  const checkpointsLimitLive = useMemo(
    () =>
      mergePlanLimitUsage(
        checkpointsLimit,
        usage.periodCheckpointCreations,
        usage.quotaPeriodKey,
      ),
    [checkpointsLimit, usage.periodCheckpointCreations, usage.quotaPeriodKey],
  );
  const reportsLimitLive = useMemo(
    () =>
      mergePlanLimitUsage(
        reportsLimit,
        usage.periodReportGenerations,
        usage.quotaPeriodKey,
      ),
    [reportsLimit, usage.periodReportGenerations, usage.quotaPeriodKey],
  );

  return {
    loading,
    error,
    ...usage,
    monthlyLimit,
    effectiveMonthlyLimit,
    proxyDefaultLimit,
    limitsLoading,
    documentsLimit: documentsLimitLive,
    checkpointsLimit: checkpointsLimitLive,
    reportsLimit: reportsLimitLive,
  };
}

const LlmTokenUsageContext = createContext<LlmTokenUsageSnapshot | null>(null);

export function LlmTokenUsageProvider({
  children,
  db,
  uid,
  tokenQuotaStatusUrl,
  getIdToken,
  publicDefaultMonthlyTokenLimit = FREE_PLAN_TOKENS_PER_MONTH,
}: LlmTokenUsageProviderProps) {
  const value = useLlmTokenUsageSubscription(
    uid,
    db,
    tokenQuotaStatusUrl,
    getIdToken,
    publicDefaultMonthlyTokenLimit ?? null
  );

  return (
    <LlmTokenUsageContext.Provider value={value}>
      {children}
    </LlmTokenUsageContext.Provider>
  );
}

export function useLlmTokenUsage(): LlmTokenUsageSnapshot {
  const ctx = useContext(LlmTokenUsageContext);
  if (!ctx) {
    throw new Error("useLlmTokenUsage must be used within LlmTokenUsageProvider");
  }
  return ctx;
}
