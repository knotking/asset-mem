import { formatCheckpointOverallCondition } from '../checkpoint-summary-display';

describe('formatCheckpointOverallCondition', () => {
  it('uppercases the first character', () => {
    expect(formatCheckpointOverallCondition('damaged, wear and tear')).toBe(
      'Damaged, wear and tear'
    );
  });

  it('leaves already-capitalized values unchanged', () => {
    expect(formatCheckpointOverallCondition('Damaged (wear and tear)')).toBe(
      'Damaged (wear and tear)'
    );
  });

  it('returns empty strings unchanged', () => {
    expect(formatCheckpointOverallCondition('')).toBe('');
    expect(formatCheckpointOverallCondition('   ')).toBe('   ');
  });
});
