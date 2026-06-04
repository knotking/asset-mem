import type { Checkpoint } from '../../types';
import { getCheckpointListConditionBadge } from '../checkpoint-list-badge';

function cp(overrides: Pick<Checkpoint, 'analysisStatus'> & { aiAnalysis?: Checkpoint['aiAnalysis'] }): Checkpoint {
  return { analysisStatus: overrides.analysisStatus, aiAnalysis: overrides.aiAnalysis } as Checkpoint;
}

describe('getCheckpointListConditionBadge', () => {
  it('returns null while processing or failed', () => {
    expect(getCheckpointListConditionBadge(cp({ analysisStatus: 'processing' }))).toBeNull();
    expect(getCheckpointListConditionBadge(cp({ analysisStatus: 'failed' }))).toBeNull();
  });

  it('tiers issues by severity', () => {
    const issues = [
      { severity: 'minor', description: 'a' },
      { severity: 'major', description: 'b' },
    ];
    expect(
      getCheckpointListConditionBadge(
        cp({ analysisStatus: 'completed', aiAnalysis: { issues } as Checkpoint['aiAnalysis'] })
      )?.label
    ).toBe('Major Issues');

    expect(
      getCheckpointListConditionBadge(
        cp({
          analysisStatus: 'completed',
          aiAnalysis: {
            issues: [{ severity: 'critical', description: 'c' }, ...issues],
          } as Checkpoint['aiAnalysis'],
        })
      )?.label
    ).toBe('Critical Issues');

    expect(
      getCheckpointListConditionBadge(
        cp({
          analysisStatus: 'completed',
          aiAnalysis: {
            issues: [{ severity: 'minor', description: 'd' }],
          } as Checkpoint['aiAnalysis'],
        })
      )?.label
    ).toBe('Needs Attention');
  });

  it('returns good when analysis has no issues', () => {
    expect(
      getCheckpointListConditionBadge(
        cp({
          analysisStatus: 'completed',
          aiAnalysis: { issues: [] } as unknown as Checkpoint['aiAnalysis'],
        })
      )?.label
    ).toBe('Good Condition');
  });
});
