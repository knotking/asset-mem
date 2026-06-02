import { otaUpdateShortId } from '../lib/ota-update-display';

describe('otaUpdateShortId', () => {
  it('returns first 8 characters of updateId', () => {
    expect(otaUpdateShortId('a3f91c2b-4e5f-6789-abcd-ef0123456789')).toBe('a3f91c2b');
  });

  it('returns null for empty or missing id', () => {
    expect(otaUpdateShortId(null)).toBeNull();
    expect(otaUpdateShortId(undefined)).toBeNull();
    expect(otaUpdateShortId('   ')).toBeNull();
  });
});
