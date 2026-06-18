/**
 * Firebase JS Remote Config expects browser APIs (IndexedDB, navigator.onLine).
 * Apply once before any remote-config fetch on native. Web uses real browser APIs.
 */

import { Platform } from 'react-native';
import { createLogger } from '@/lib/logger';

const log = createLogger('FirebaseRemoteConfigSetup');

let configured = false;
let polyfillFailed = false;

function ensureDomExceptionPolyfill(): void {
  if (typeof globalThis.DOMException !== 'undefined') {
    return;
  }

  class DOMExceptionPolyfill extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
      Object.setPrototypeOf(this, DOMExceptionPolyfill.prototype);
    }
  }

  globalThis.DOMException = DOMExceptionPolyfill as unknown as typeof DOMException;
}

function ensureStructuredClonePolyfill(): void {
  if (typeof globalThis.structuredClone === 'function') {
    return;
  }

  globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
}

export function isFirebaseRemoteConfigEnvironmentReady(): boolean {
  return configured && !polyfillFailed;
}

export function ensureFirebaseRemoteConfigEnvironment(): void {
  if (configured || Platform.OS === 'web') {
    configured = true;
    return;
  }

  try {
    ensureDomExceptionPolyfill();
    ensureStructuredClonePolyfill();

    require('react-native-get-random-values');
    require('fake-indexeddb/auto');

    const globalNavigator = globalThis.navigator as Navigator | undefined;
    if (!globalNavigator) {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });
    } else {
      try {
        Object.defineProperty(globalNavigator, 'onLine', {
          get: () => true,
          configurable: true,
        });
      } catch {
        // read-only in some runtimes
      }
    }

    configured = true;
  } catch (error) {
    polyfillFailed = true;
    configured = true;
    log.warn('polyfill failed; Remote Config may use defaults only', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
