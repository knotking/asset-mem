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
import type { ChangeRegion, CheckpointComparisonRecord, VisualDiffAnalysis } from '../types';

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

/** Append to comparisons/ and denormalize latest onto visualDiff. */
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
  batch.set(compRef, record);
  batch.update(cpRef, { visualDiff: params.visualDiff });
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

/** Use subcollection when present; otherwise fall back to denormalized visualDiff. */
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
    matchReason,
    comparedWithRevisionNumber,
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
