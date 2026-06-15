import {
  buildVisualDiffFromCompareResult,
  buildComparisonExplorerEntries,
  formatComparisonHistoryLabel,
  formatExplorerEntryTitle,
  formatMatchReasonLabel,
  getSeriesCapturesForCheckpoint,
  mergeComparisonHistory,
} from '../checkpoint-comparisons';
import type { Checkpoint, CheckpointComparisonRecord, VisualDiffAnalysis } from '../../types';

function cp(partial: Partial<Checkpoint> & { id: string }): Checkpoint {
  return partial as Checkpoint;
}

describe('checkpoint-comparisons', () => {
  it('mergeComparisonHistory falls back to visualDiff when subcollection empty', () => {
    const visualDiff: VisualDiffAnalysis = {
      id: 'diff_1',
      status: 'completed',
      comparedWithCheckpointId: 'c1',
      semanticChanges: [],
      regions: [],
      similarityScore: 0.9,
      matchReason: 'series_previous',
      completedAt: {} as VisualDiffAnalysis['completedAt'],
    };
    const merged = mergeComparisonHistory([], visualDiff);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('auto');
  });

  it('prefers subcollection records over visualDiff fallback', () => {
    const records: CheckpointComparisonRecord[] = [
      {
        id: 'diff_2',
        status: 'completed',
        comparedWithCheckpointId: 'c1',
        semanticChanges: [],
        regions: [],
        similarityScore: 0.8,
        completedAt: {} as CheckpointComparisonRecord['completedAt'],
        source: 'manual',
      },
    ];
    expect(mergeComparisonHistory(records, undefined)).toEqual(records);
  });

  it('buildVisualDiffFromCompareResult sets matchReason', () => {
    const diff = buildVisualDiffFromCompareResult({
      result: { summary: 'Changed', similarityScore: 0.7, semanticChanges: ['crack'] },
      comparedWithCheckpointId: 'before',
      matchReason: 'manual',
      completedAt: {} as VisualDiffAnalysis['completedAt'],
    });
    expect(diff.matchReason).toBe('manual');
    expect(diff.comparedWithCheckpointId).toBe('before');
    expect('comparedWithRevisionNumber' in diff).toBe(false);
  });

  it('buildVisualDiffFromCompareResult omits undefined revision number', () => {
    const diff = buildVisualDiffFromCompareResult({
      result: { summary: 'Ok' },
      comparedWithCheckpointId: 'before',
      completedAt: {} as VisualDiffAnalysis['completedAt'],
    });
    expect(diff).not.toHaveProperty('comparedWithRevisionNumber');
  });

  it('formatComparisonHistoryLabel includes partner and revision', () => {
    const label = formatComparisonHistoryLabel(
      {
        id: 'd1',
        status: 'completed',
        semanticChanges: [],
        regions: [],
        similarityScore: 1,
        completedAt: {} as CheckpointComparisonRecord['completedAt'],
        source: 'auto',
        comparedWithRevisionNumber: 2,
      },
      'Kitchen v1'
    );
    expect(label).toContain('Auto');
    expect(label).toContain('Kitchen v1');
    expect(label).toContain('rev 2');
  });

  it('buildComparisonExplorerEntries resolves before/after checkpoints', () => {
    const all = [
      cp({ id: 'c1', seriesId: 's1', revisionNumber: 1, name: 'Kitchen v1' }),
      cp({ id: 'c2', seriesId: 's1', revisionNumber: 2, name: 'Kitchen v2' }),
    ];
    const record: CheckpointComparisonRecord = {
      id: 'diff_1',
      status: 'completed',
      comparedWithCheckpointId: 'c1',
      comparedWithRevisionNumber: 1,
      semanticChanges: ['stain'],
      regions: [],
      similarityScore: 0.8,
      matchReason: 'series_previous',
      completedAt: { seconds: 1000 } as CheckpointComparisonRecord['completedAt'],
      source: 'auto',
    };
    const entries = buildComparisonExplorerEntries(
      [all[1]],
      new Map([[ 'c2', [record] ]]),
      all
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].beforeCheckpoint?.id).toBe('c1');
    expect(entries[0].afterCheckpoint?.id).toBe('c2');
    expect(formatExplorerEntryTitle(entries[0])).toContain('v1 → v2');
  });

  it('getSeriesCapturesForCheckpoint orders by revision', () => {
    const focus = cp({ id: 'c2', seriesId: 's1', revisionNumber: 2 });
    const all = [
      cp({ id: 'c2', seriesId: 's1', revisionNumber: 2 }),
      cp({ id: 'c1', seriesId: 's1', revisionNumber: 1 }),
    ];
    expect(getSeriesCapturesForCheckpoint(focus, all).map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('formatMatchReasonLabel maps series_previous', () => {
    expect(formatMatchReasonLabel('series_previous')).toBe('Previous in series');
  });
});
