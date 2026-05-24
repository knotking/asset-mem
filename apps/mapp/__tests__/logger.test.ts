/**
 * Logger gating — baseline for Phase 4 prod console behavior.
 * @see docs/CLIENT_LOGGING.md
 */

const originalDev = (global as { __DEV__?: boolean }).__DEV__;

function setDev(value: boolean) {
  (global as { __DEV__?: boolean }).__DEV__ = value;
}

describe('mapp logger', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.EXPO_PUBLIC_DEBUG_LOGS;
  });

  afterEach(() => {
    setDev(originalDev ?? true);
    jest.restoreAllMocks();
  });

  it('suppresses debug and info when not in verbose mode', () => {
    setDev(false);
    const { createLogger } = require('@/lib/logger') as typeof import('@/lib/logger');
    const log = createLogger('test');
    log.debug('should.not.emit');
    log.info('should.not.emit');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });

  it('always emits warn and error', () => {
    setDev(false);
    const { createLogger } = require('@/lib/logger') as typeof import('@/lib/logger');
    const log = createLogger('test');
    log.warn('visible');
    log.error('visible', undefined, new Error('boom'));
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('emits debug when EXPO_PUBLIC_DEBUG_LOGS is true', () => {
    setDev(false);
    process.env.EXPO_PUBLIC_DEBUG_LOGS = 'true';
    const { createLogger } = require('@/lib/logger') as typeof import('@/lib/logger');
    const log = createLogger('test');
    log.debug('verbose');
    expect(console.debug).toHaveBeenCalled();
  });
});
