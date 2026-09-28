import { truncateId } from '../src/lib/logger';

describe('@asset-mem/common test harness', () => {
  it('runs jest in node environment', () => {
    expect(truncateId('abcdefghijklmnop', 8)).toBe('abcdefgh…');
  });
});
