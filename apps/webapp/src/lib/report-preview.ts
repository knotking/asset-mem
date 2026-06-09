/** Mirrored from @homeapp/common — webapp cannot import common (App Hosting). */
import type { ReportPreviewPair, ReportPreviewResponse } from '@/lib/types';

export function collectPreviewCheckpointIds(preview: ReportPreviewResponse): string[] {
  if (preview.mode === 'snapshot') {
    return preview.checkpoints.map((row) => row.checkpointId);
  }
  const ids: string[] = [];
  for (const pair of preview.pairs) {
    ids.push(pair.baselineCheckpointId, pair.comparisonCheckpointId);
  }
  for (const row of preview.baselineOnly) {
    ids.push(row.checkpointId);
  }
  for (const row of preview.comparisonOnly) {
    ids.push(row.checkpointId);
  }
  return [...new Set(ids)];
}

export function comparisonPairKey(pair: ReportPreviewPair): string {
  return `${pair.baselineCheckpointId}:${pair.comparisonCheckpointId}`;
}

export function checkpointIdsForComparisonPair(pair: ReportPreviewPair): string[] {
  return [pair.baselineCheckpointId, pair.comparisonCheckpointId];
}

function isPendingCheckpoint(
  row: { checkpointId: string; analysisStatus?: string },
  selectedIds: Set<string>
): boolean {
  return (
    selectedIds.has(row.checkpointId) &&
    (row.analysisStatus ?? '') !== 'completed'
  );
}

export function previewHasPendingAnalysis(
  preview: ReportPreviewResponse,
  selectedIds: Set<string>
): boolean {
  if (selectedIds.size === 0) return false;
  if (preview.mode === 'snapshot') {
    return preview.checkpoints.some((row) => isPendingCheckpoint(row, selectedIds));
  }
  for (const pair of preview.pairs) {
    if (pair.baseline && isPendingCheckpoint(pair.baseline, selectedIds)) return true;
    if (pair.comparison && isPendingCheckpoint(pair.comparison, selectedIds)) return true;
  }
  for (const row of preview.baselineOnly) {
    if (isPendingCheckpoint(row, selectedIds)) return true;
  }
  for (const row of preview.comparisonOnly) {
    if (isPendingCheckpoint(row, selectedIds)) return true;
  }
  return false;
}

export function reportPreviewParamsKey(input: {
  mode: 'snapshot' | 'comparison';
  startDate: string;
  endDate: string;
  baselineStart: string;
  baselineEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
}): string {
  const {
    mode,
    startDate,
    endDate,
    baselineStart,
    baselineEnd,
    comparisonStart,
    comparisonEnd,
  } = input;
  return mode === 'snapshot'
    ? `snapshot:${startDate}:${endDate}`
    : `comparison:${baselineStart}:${baselineEnd}:${comparisonStart}:${comparisonEnd}`;
}

export type ReportSnapshotDateRange = {
  start: string;
  end: string;
};

export type ReportComparisonDateRanges = {
  baselineStart: string;
  baselineEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
};

export function snapshotRangesPreviewKey(range: ReportSnapshotDateRange): string {
  return reportPreviewParamsKey({
    mode: 'snapshot',
    startDate: range.start,
    endDate: range.end,
    baselineStart: '',
    baselineEnd: '',
    comparisonStart: '',
    comparisonEnd: '',
  });
}

export function comparisonRangesPreviewKey(
  ranges: ReportComparisonDateRanges
): string {
  return reportPreviewParamsKey({
    mode: 'comparison',
    startDate: '',
    endDate: '',
    ...ranges,
  });
}

export function snapshotRangesDirty(
  draft: ReportSnapshotDateRange,
  applied: ReportSnapshotDateRange | null
): boolean {
  if (!applied) return false;
  return snapshotRangesPreviewKey(draft) !== snapshotRangesPreviewKey(applied);
}

export function comparisonRangesDirty(
  draft: ReportComparisonDateRanges,
  applied: ReportComparisonDateRanges | null
): boolean {
  if (!applied) return false;
  return comparisonRangesPreviewKey(draft) !== comparisonRangesPreviewKey(applied);
}

export function reportWizardDatesDirty(
  mode: 'snapshot' | 'comparison',
  draftSnapshot: ReportSnapshotDateRange,
  appliedSnapshot: ReportSnapshotDateRange | null,
  draftComparison: ReportComparisonDateRanges,
  appliedComparison: ReportComparisonDateRanges | null
): boolean {
  return mode === 'snapshot'
    ? snapshotRangesDirty(draftSnapshot, appliedSnapshot)
    : comparisonRangesDirty(draftComparison, appliedComparison);
}

/** LRU cache for report checkpoint previews keyed by `reportPreviewParamsKey`. */
export class ReportPreviewCache {
  private readonly cache = new Map<string, ReportPreviewResponse>();

  constructor(private readonly maxSize = 8) {}

  get(key: string): ReportPreviewResponse | undefined {
    const value = this.cache.get(key);
    if (value === undefined) return undefined;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: string, value: ReportPreviewResponse): void {
    this.cache.delete(key);
    this.cache.set(key, value);
    while (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
