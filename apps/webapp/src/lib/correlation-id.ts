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
  extra?: HeadersInit
): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set(REQUEST_ID_HEADER, correlationId);
  return headers;
}

/** `fetch` to the HomeApp proxy with `X-Request-ID` (one id per call unless overridden). */
export async function proxyFetch(
  input: RequestInfo | URL,
  init: RequestInit & { correlationId?: string } = {}
): Promise<Response> {
  const correlationId = init.correlationId ?? createCorrelationId();
  const { correlationId: _omit, headers, ...rest } = init;
  return fetch(input, {
    ...rest,
    headers: proxyJsonHeaders(correlationId, headers),
  });
}
