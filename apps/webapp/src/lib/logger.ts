/**
 * Webapp logging utility. Namespaced, level-gated debug, structured metadata.
 * Not shared with @homeapp/common — webapp keeps its own copy.
 */

export type LogMeta = Record<string, unknown>;

const isDev =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

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

/** Parse proxy/agent error bodies for known codes (e.g. TOKEN_QUOTA_EXCEEDED). */
export function parseAgentErrorCode(body: string): string | undefined {
  if (!body) return undefined;
  if (body.includes('TOKEN_QUOTA_EXCEEDED')) return 'TOKEN_QUOTA_EXCEEDED';
  try {
    const parsed = JSON.parse(body) as { code?: string; detail?: { code?: string } };
    return parsed.code ?? parsed.detail?.code;
  } catch {
    return undefined;
  }
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
