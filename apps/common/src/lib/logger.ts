/**
 * Shared logger for @homeapp/common (consumed by mapp).
 * Webapp uses its own copy under apps/webapp/src/lib/logger.ts.
 */

export type LogMeta = Record<string, unknown>;

declare const __DEV__: boolean | undefined;

const isDev =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

function formatLine(namespace: string, message: string, meta?: LogMeta): string {
  const base = `[${namespace}] ${message}`;
  if (!meta || Object.keys(meta).length === 0) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return base;
  }
}

function errorMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return undefined;
}

export function truncateId(id: string | undefined | null, len = 8): string | undefined {
  if (!id) return undefined;
  return id.length <= len ? id : `${id.slice(0, len)}…`;
}

export type Logger = {
  debug: (message: string, meta?: LogMeta) => void;
  info: (message: string, meta?: LogMeta) => void;
  warn: (message: string, meta?: LogMeta) => void;
  error: (message: string, meta?: LogMeta, err?: unknown) => void;
};

export function createLogger(namespace: string): Logger {
  return {
    debug(message, meta) {
      if (!isDev) return;
      console.debug(formatLine(namespace, message, meta));
    },
    info(message, meta) {
      console.info(formatLine(namespace, message, meta));
    },
    warn(message, meta) {
      console.warn(formatLine(namespace, message, meta));
    },
    error(message, meta, err) {
      const merged: LogMeta = { ...meta };
      const msg = errorMessage(err);
      if (msg) merged.cause = msg;
      console.error(formatLine(namespace, message, merged));
    },
  };
}
