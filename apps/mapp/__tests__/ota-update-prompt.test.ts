import { isOtaDevMockAvailable } from '../lib/ota-update-prompt';

describe('isOtaDevMockAvailable', () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it('is true when __DEV__ is true', () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(isOtaDevMockAvailable()).toBe(true);
  });

  it('is false when __DEV__ is false', () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    expect(isOtaDevMockAvailable()).toBe(false);
  });
});
