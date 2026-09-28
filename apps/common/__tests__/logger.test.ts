/**
 * Shared logger gating — used by messages-context and other common modules.
 */

const originalDev = (global as { __DEV__?: boolean }).__DEV__;

function setDev(value: boolean) {
  (global as { __DEV__?: boolean }).__DEV__ = value;
}

describe('@asset-mem/common logger', () => {
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

  it('suppresses debug and info when not verbose', async () => {
    setDev(false);
    const { createLogger } = await import('../src/lib/logger');
    const log = createLogger('messages');
    log.debug('hidden');
    log.info('hidden');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });

  it('emits warn and error always', async () => {
    setDev(false);
    const { createLogger } = await import('../src/lib/logger');
    const log = createLogger('messages');
    log.warn('shown');
    log.error('shown');
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
