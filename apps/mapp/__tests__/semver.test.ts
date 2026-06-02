import { compareSemver, isVersionLessThan } from '../lib/semver';

describe('semver', () => {
  it('compares dotted versions', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
    expect(compareSemver('1.2.0', '1.1.9')).toBe(1);
    expect(compareSemver('2.0', '2.0.0')).toBe(0);
  });

  it('detects less than', () => {
    expect(isVersionLessThan('0.9.9', '1.0.0')).toBe(true);
    expect(isVersionLessThan('1.0.0', '1.0.0')).toBe(false);
  });
});
