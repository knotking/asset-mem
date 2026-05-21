/**
 * Correlation IDs for proxy requests (matches proxy X-Request-ID / Cloud Logging [req=…]).
 */

export const REQUEST_ID_HEADER = 'X-Request-ID';

export function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function proxyJsonHeaders(
  correlationId: string,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    [REQUEST_ID_HEADER]: correlationId,
    ...extra,
  };
}

export async function proxyFetch(
  url: string,
  init: RequestInit & { correlationId?: string } = {}
): Promise<Response> {
  const correlationId = init.correlationId ?? createCorrelationId();
  const { correlationId: _omit, headers, ...rest } = init;
  const merged =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : (headers as Record<string, string> | undefined);
  return fetch(url, {
    ...rest,
    headers: proxyJsonHeaders(correlationId, merged),
  });
}

export type GetFirebaseIdToken = () => Promise<string | null | undefined>;

/** Proxy request with `Authorization: Bearer <Firebase ID token>`. */
export async function proxyFetchWithAuth(
  url: string,
  getIdToken: GetFirebaseIdToken,
  init: RequestInit & { correlationId?: string } = {}
): Promise<Response> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not signed in — Firebase ID token required for proxy API');
  }
  const { headers, ...rest } = init;
  const merged =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : (headers as Record<string, string> | undefined);
  return proxyFetch(url, {
    ...rest,
    headers: {
      ...merged,
      Authorization: `Bearer ${token}`,
    },
  });
}
