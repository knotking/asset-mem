"""Propagate X-Request-ID from clients through proxy logs and responses."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from common.observability.logging_context import (
    REQUEST_ID_HEADER,
    bind_correlation_id,
    resolve_correlation_id,
    unbind_correlation_id,
)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        cid = resolve_correlation_id(
            request.headers.get(REQUEST_ID_HEADER)
            or request.headers.get("X-Correlation-ID")
        )
        bind_correlation_id(cid)
        try:
            response = await call_next(request)
            response.headers[REQUEST_ID_HEADER] = cid
            return response
        finally:
            unbind_correlation_id()
