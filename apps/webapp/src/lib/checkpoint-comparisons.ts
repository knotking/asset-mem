import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  writeBatch,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';
import type { ChangeRegion, Checkpoint, CheckpointComparisonRecord, VisualDiffAnalysis } from '@/lib/types';

export type PersistCheckpointComparisonParams = {
  userId: string;
  propertyId: string;
  checkpointId: string;
  visualDiff: VisualDiffAnalysis;
  source: CheckpointComparisonRecord['source'];
};

function checkpointRef(db: Firestore, userId: string, propertyId: string, checkpointId: string) {
  return doc(db, `users/${userId}/properties/${propertyId}/checkpoints/${checkpointId}`);
}

/** Remove undefined values — Firestore rejects undefined field values. */
function stripUndefinedForFirestore<T extends Record<string, unknown>>(value: T): T {
  const cleaned: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue !== undefined) {
      cleaned[key] = fieldValue;
    }
  }
  return cleaned as T;
}

export async function persistCheckpointComparison(
  db: Firestore,
  params: PersistCheckpointComparisonParams
): Promise<string> {
  const comparisonId = params.visualDiff.id || `diff_${Date.now()}`;
  const record: CheckpointComparisonRecord = {
    ...params.visualDiff,
    id: comparisonId,
    source: params.source,
  };
  const cpRef = checkpointRef(db, params.userId, params.propertyId, params.checkpointId);
  const compRef = doc(collection(cpRef, 'comparisons'), comparisonId);
  const batch = writeBatch(db);
  batch.set(compRef, stripUndefinedForFirestore(record));
  batch.update(cpRef, { visualDiff: stripUndefinedForFirestore(params.visualDiff) });
  await batch.commit();
  return comparisonId;
}

export async function fetchCheckpointComparisons(
  db: Firestore,
  userId: string,
  propertyId: string,
  checkpointId: string
): Promise<CheckpointComparisonRecord[]> {
  const compCol = collection(
    db,
    `users/${userId}/properties/${propertyId}/checkpoints/${checkpointId}/comparisons`
  );
  const snap = await getDocs(query(compCol, orderBy('completedAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CheckpointComparisonRecord, 'id'>) }));
}

export function mergeComparisonHistory(
  records: CheckpointComparisonRecord[],
  visualDiff?: VisualDiffAnalysis
): CheckpointComparisonRecord[] {
  if (records.length > 0) {
    return records;
  }
  if (!visualDiff || visualDiff.status !== 'completed') {
    return [];
  }
  return [
    {
      ...visualDiff,
      id: visualDiff.id || 'legacy',
      source: visualDiff.matchReason === 'manual' ? 'manual' : 'auto',
    },
  ];
}

export function comparisonRecordToVisualDiff(
  record: CheckpointComparisonRecord
): VisualDiffAnalysis {
  const { source: _source, ...visualDiff } = record;
  return visualDiff;
}

export function buildVisualDiffFromCompareResult(params: {
  result: {
    summary?: string;
    semanticChanges?: string[];
    regions?: Array<Partial<ChangeRegion>>;
    similarityScore?: number;
  };
  comparedWithCheckpointId: string;
  matchReason?: VisualDiffAnalysis['matchReason'];
  comparedWithRevisionNumber?: number;
  completedAt: Timestamp;
}): VisualDiffAnalysis {
  const { result, comparedWithCheckpointId, matchReason, comparedWithRevisionNumber, completedAt } =
    params;
  return {
    id: `diff_${Date.now()}`,
    status: 'completed',
    comparedWithCheckpointId,
    summary: result.summary ?? '',
    semanticChanges: result.semanticChanges ?? [],
    regions: (result.regions ?? []).map((r, i) => ({
      id: `region_${i}`,
      bbox: r.bbox ?? { x: 0, y: 0, width: 0, height: 0 },
      changeType: (r.changeType as ChangeRegion['changeType']) ?? 'modified',
      severity: (r.severity as ChangeRegion['severity']) ?? 'minor',
      confidence: r.confidence ?? 0.5,
      description: r.description ?? '',
      changePercentage: 0,
    })),
    similarityScore: result.similarityScore ?? 0,
    ...(matchReason != null ? { matchReason } : {}),
    ...(comparedWithRevisionNumber != null
      ? { comparedWithRevisionNumber }
      : {}),
    completedAt,
  };
}

export function formatComparisonHistoryLabel(
  record: CheckpointComparisonRecord,
  partnerName?: string
): string {
  const partner = partnerName ? ` vs ${partnerName}` : '';
  const rev =
    record.comparedWithRevisionNumber != null
      ? ` (rev ${record.comparedWithRevisionNumber})`
      : '';
  const source = record.source === 'manual' ? 'Manual' : 'Auto';
  return `${source}${partner}${rev}`;
}

export type ComparisonExplorerScope = 'capture' | 'series';

export type ComparisonExplorerEntry = {
  id: string;
  afterCaptureId: string;
  beforeCaptureId: string;
  record: CheckpointComparisonRecord;
  afterCheckpoint?: Checkpoint;
  beforeCheckpoint?: Checkpoint;
  completedAtMs: number;
};

export function timestampToMs(value: unknown): number {
  if (value == null) return 0;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof (value as { seconds?: number }).seconds === 'number') {
    return (value as { seconds: number }).seconds * 1000;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return 0;
}

export function formatMatchReasonLabel(
  reason?: VisualDiffAnalysis['matchReason']
): string | null {
  switch (reason) {
    case 'series_previous':
      return 'Previous in series';
    case 'series_baseline':
      return 'Vs baseline';
    case 'same_location':
      return 'Same location';
    case 'same_detected_asset':
      return 'Same detected area';
    case 'manual':
      return 'Manual compare';
    default:
      return null;
  }
}

export function getSeriesCapturesForCheckpoint(
  focus: Checkpoint,
  allCheckpoints: Checkpoint[]
): Checkpoint[] {
  if (!focus.seriesId) {
    return [focus];
  }
  return allCheckpoints
    .filter((c) => c.seriesId === focus.seriesId)
    .sort((a, b) => (a.revisionNumber ?? 0) - (b.revisionNumber ?? 0));
}

export function buildComparisonExplorerEntries(
  captures: Checkpoint[],
  recordsByCaptureId: Map<string, CheckpointComparisonRecord[]>,
  allCheckpoints: Checkpoint[]
): ComparisonExplorerEntry[] {
  const byId = new Map(allCheckpoints.map((c) => [c.id, c]));
  const entries: ComparisonExplorerEntry[] = [];

  for (const capture of captures) {
    const records = recordsByCaptureId.get(capture.id) ?? [];
    for (const record of records) {
      const beforeId = record.comparedWithCheckpointId;
      if (!beforeId) continue;
      entries.push({
        id: `${capture.id}:${record.id}`,
        afterCaptureId: capture.id,
        beforeCaptureId: beforeId,
        record,
        afterCheckpoint: byId.get(capture.id) ?? capture,
        beforeCheckpoint: byId.get(beforeId),
        completedAtMs: timestampToMs(record.completedAt),
      });
    }
  }

  return entries.sort((a, b) => b.completedAtMs - a.completedAtMs);
}

export async function fetchComparisonExplorerEntries(
  db: Firestore,
  userId: string,
  propertyId: string,
  focusCheckpoint: Checkpoint,
  allCheckpoints: Checkpoint[],
  scope: ComparisonExplorerScope
): Promise<ComparisonExplorerEntry[]> {
  const captures =
    scope === 'series'
      ? getSeriesCapturesForCheckpoint(focusCheckpoint, allCheckpoints)
      : [focusCheckpoint];

  const recordsByCaptureId = new Map<string, CheckpointComparisonRecord[]>();

  await Promise.all(
    captures.map(async (capture) => {
      const fetched = await fetchCheckpointComparisons(
        db,
        userId,
        propertyId,
        capture.id
      );
      recordsByCaptureId.set(
        capture.id,
        mergeComparisonHistory(fetched, capture.visualDiff)
      );
    })
  );

  return buildComparisonExplorerEntries(captures, recordsByCaptureId, allCheckpoints);
}

export function formatExplorerEntryTitle(
  entry: ComparisonExplorerEntry,
  latestVisualDiffId?: string
): string {
  const before = entry.beforeCheckpoint;
  const after = entry.afterCheckpoint;
  const beforeRev =
    before?.revisionNumber != null ? `v${before.revisionNumber}` : before?.name ?? 'Before';
  const afterRev =
    after?.revisionNumber != null ? `v${after.revisionNumber}` : after?.name ?? 'After';
  const latest =
    entry.record.id === latestVisualDiffId || entry.record.id === after?.visualDiff?.id
      ? ' · Latest'
      : '';
  return `${beforeRev} → ${afterRev}${latest}`;
}
