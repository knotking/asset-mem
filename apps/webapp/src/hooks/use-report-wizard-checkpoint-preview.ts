/** Mirrored from @homeapp/common — webapp cannot import common (App Hosting). */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Checkpoint, PropertyReportPurpose, ReportPreviewResponse } from '@/lib/types';
import {
  ReportPreviewCache,
  collectPreviewCheckpointIds,
  comparisonRangesPreviewKey,
  reportWizardDatesDirty,
  snapshotRangesPreviewKey,
  type ReportComparisonDateRanges,
  type ReportSnapshotDateRange,
} from '@/lib/report-preview';
import {
  canResolveReportPreviewLocally,
  prepareReportPreviewFromCheckpoints,
} from '@/lib/report-resolve';

export type ReportPreviewFetchPayload =
  | {
      userId: string;
      propertyId: string;
      mode: 'snapshot';
      snapshotRange: ReportSnapshotDateRange;
    }
  | {
      userId: string;
      propertyId: string;
      mode: 'comparison';
      purpose?: PropertyReportPurpose;
      baselineRange: ReportSnapshotDateRange;
      comparisonRange: ReportSnapshotDateRange;
    };

export type UseReportWizardCheckpointPreviewArgs = {
  enabled: boolean;
  mode: 'snapshot' | 'comparison';
  purpose?: PropertyReportPurpose;
  userId: string | undefined;
  propertyId: string | undefined;
  draftSnapshotRange: ReportSnapshotDateRange;
  draftComparisonRanges: ReportComparisonDateRanges;
  fetchPreview: (payload: ReportPreviewFetchPayload) => Promise<ReportPreviewResponse>;
  /** Timeline-loaded checkpoints — used for instant preview when coverage is complete. */
  localCheckpoints?: Checkpoint[];
  localCheckpointsLoading?: boolean;
  hasMoreLocalCheckpoints?: boolean;
};

export function useReportWizardCheckpointPreview({
  enabled,
  mode,
  purpose,
  userId,
  propertyId,
  draftSnapshotRange,
  draftComparisonRanges,
  fetchPreview,
  localCheckpoints,
  localCheckpointsLoading = false,
  hasMoreLocalCheckpoints = false,
}: UseReportWizardCheckpointPreviewArgs) {
  const [preview, setPreview] = useState<ReportPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedCheckpointIds, setSelectedCheckpointIds] = useState<Set<string>>(
    new Set()
  );
  const [appliedSnapshotRange, setAppliedSnapshotRange] =
    useState<ReportSnapshotDateRange | null>(null);
  const [appliedComparisonRanges, setAppliedComparisonRanges] =
    useState<ReportComparisonDateRanges | null>(null);

  const cacheRef = useRef(new ReportPreviewCache(8));
  const requestIdRef = useRef(0);
  const loadedParamsKeyRef = useRef<string | null>(null);

  const datesDirty = reportWizardDatesDirty(
    mode,
    draftSnapshotRange,
    appliedSnapshotRange,
    draftComparisonRanges,
    appliedComparisonRanges
  );

  const applyDates = useCallback(
    (overrideComparison?: ReportComparisonDateRanges) => {
      if (mode === 'snapshot') {
        setAppliedSnapshotRange(draftSnapshotRange);
      } else {
        setAppliedComparisonRanges(overrideComparison ?? draftComparisonRanges);
      }
    },
    [
      mode,
      draftSnapshotRange.start,
      draftSnapshotRange.end,
      draftComparisonRanges.baselineStart,
      draftComparisonRanges.baselineEnd,
      draftComparisonRanges.comparisonStart,
      draftComparisonRanges.comparisonEnd,
    ]
  );

  /** Call when entering step 2 — seeds applied ranges only on first visit. */
  const prepareStep2 = useCallback(() => {
    if (mode === 'snapshot') {
      setAppliedSnapshotRange((prev) => prev ?? draftSnapshotRange);
    } else {
      setAppliedComparisonRanges((prev) => prev ?? draftComparisonRanges);
    }
  }, [
    mode,
    draftSnapshotRange.start,
    draftSnapshotRange.end,
    draftComparisonRanges.baselineStart,
    draftComparisonRanges.baselineEnd,
    draftComparisonRanges.comparisonStart,
    draftComparisonRanges.comparisonEnd,
  ]);

  const resetPreviewState = useCallback(() => {
    requestIdRef.current += 1;
    loadedParamsKeyRef.current = null;
    cacheRef.current.clear();
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setSelectedCheckpointIds(new Set());
    setAppliedSnapshotRange(null);
    setAppliedComparisonRanges(null);
  }, []);

  const invalidatePreviewForIntentChange = useCallback(() => {
    requestIdRef.current += 1;
    loadedParamsKeyRef.current = null;
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setSelectedCheckpointIds(new Set());
    setAppliedSnapshotRange(null);
    setAppliedComparisonRanges(null);
  }, []);

  useEffect(() => {
    if (!enabled || !userId || !propertyId) {
      return;
    }

    const paramsKey =
      mode === 'snapshot'
        ? appliedSnapshotRange
          ? snapshotRangesPreviewKey(appliedSnapshotRange)
          : null
        : appliedComparisonRanges
          ? comparisonRangesPreviewKey(appliedComparisonRanges)
          : null;

    if (!paramsKey) {
      return;
    }

    const cached = cacheRef.current.get(paramsKey);
    if (cached) {
      if (loadedParamsKeyRef.current !== paramsKey) {
        loadedParamsKeyRef.current = paramsKey;
        setPreview(cached);
        setSelectedCheckpointIds(new Set(collectPreviewCheckpointIds(cached)));
      }
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    if (loadedParamsKeyRef.current === paramsKey) {
      setPreviewLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setPreviewLoading(true);
    setPreviewError(null);

    const fetchPayload: ReportPreviewFetchPayload | null =
      mode === 'snapshot' && appliedSnapshotRange
        ? {
            userId,
            propertyId,
            mode: 'snapshot',
            snapshotRange: appliedSnapshotRange,
          }
        : appliedComparisonRanges
          ? {
              userId,
              propertyId,
              mode: 'comparison',
              purpose,
              baselineRange: {
                start: appliedComparisonRanges.baselineStart,
                end: appliedComparisonRanges.baselineEnd,
              },
              comparisonRange: {
                start: appliedComparisonRanges.comparisonStart,
                end: appliedComparisonRanges.comparisonEnd,
              },
            }
          : null;

    const tryLocalResolve = (): ReportPreviewResponse | null => {
      if (!fetchPayload || !localCheckpoints) {
        return null;
      }
      const canResolve = canResolveReportPreviewLocally(localCheckpoints, {
        loading: localCheckpointsLoading,
        hasMoreCheckpoints: hasMoreLocalCheckpoints,
        mode,
        snapshotRange:
          fetchPayload.mode === 'snapshot' ? fetchPayload.snapshotRange : null,
        comparisonRanges:
          fetchPayload.mode === 'comparison'
            ? {
                baselineStart: fetchPayload.baselineRange.start,
                baselineEnd: fetchPayload.baselineRange.end,
                comparisonStart: fetchPayload.comparisonRange.start,
                comparisonEnd: fetchPayload.comparisonRange.end,
              }
            : null,
      });
      if (!canResolve) {
        return null;
      }
      try {
        if (fetchPayload.mode === 'snapshot') {
          return prepareReportPreviewFromCheckpoints(localCheckpoints, {
            mode: 'snapshot',
            snapshotRange: fetchPayload.snapshotRange,
          });
        }
        return prepareReportPreviewFromCheckpoints(localCheckpoints, {
          mode: 'comparison',
          baselineRange: fetchPayload.baselineRange,
          comparisonRange: fetchPayload.comparisonRange,
          purpose,
        });
      } catch {
        return null;
      }
    };

    const localResult = tryLocalResolve();
    if (localResult) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      cacheRef.current.set(paramsKey, localResult);
      loadedParamsKeyRef.current = paramsKey;
      setPreview(localResult);
      setSelectedCheckpointIds(new Set(collectPreviewCheckpointIds(localResult)));
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    void (async () => {
      try {
        const result = fetchPayload ? await fetchPreview(fetchPayload) : null;

        if (!result || requestId !== requestIdRef.current) {
          return;
        }

        cacheRef.current.set(paramsKey, result);
        loadedParamsKeyRef.current = paramsKey;
        setPreview(result);
        setSelectedCheckpointIds(new Set(collectPreviewCheckpointIds(result)));
        setPreviewError(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        loadedParamsKeyRef.current = null;
        setPreview(null);
        setSelectedCheckpointIds(new Set());
        setPreviewError(
          err instanceof Error ? err.message : 'Could not preview checkpoints'
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setPreviewLoading(false);
        }
      }
    })();
  }, [
    enabled,
    mode,
    userId,
    propertyId,
    appliedSnapshotRange,
    appliedComparisonRanges,
    fetchPreview,
    localCheckpoints,
    localCheckpointsLoading,
    hasMoreLocalCheckpoints,
    purpose,
  ]);

  const isCheckpointPreviewPending =
    previewError === null && (previewLoading || preview === null) && !datesDirty;

  return {
    preview,
    previewLoading,
    previewError,
    selectedCheckpointIds,
    setSelectedCheckpointIds,
    datesDirty,
    applyDates,
    prepareStep2,
    resetPreviewState,
    invalidatePreviewForIntentChange,
    isCheckpointPreviewPending,
  };
}
