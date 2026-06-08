import { truncateDeletionError } from '../../src/lib/deletion/mark-resource-deletion-failed';

describe('mark-resource-deletion-failed', () => {
  it('truncates long error messages', () => {
    const long = 'x'.repeat(600);
    expect(truncateDeletionError(new Error(long)).length).toBe(500);
  });

  it('uses fallback for non-error values', () => {
    expect(truncateDeletionError(null)).toBe('Delete failed');
  });
});
