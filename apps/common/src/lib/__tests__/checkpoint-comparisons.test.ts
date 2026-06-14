import {
  buildVisualDiffFromCompareResult,
  formatComparisonHistoryLabel,
  mergeComparisonHistory,
} from '../checkpoint-comparisons';
import type { CheckpointComparisonRecord, VisualDiffAnalysis } from '../../types';

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
});
