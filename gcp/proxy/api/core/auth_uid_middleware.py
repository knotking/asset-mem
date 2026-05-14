"""ASGI middleware: bind auth uid from JSON body for all stdlib logs in the request."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from common.observability.logging_context import (
    bind_auth_uid,
    parse_json_auth_uid_from_body,
    unbind_auth_uid,
)


class AuthUidLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        uid = None
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type.lower():
                body = await request.body()
                uid = parse_json_auth_uid_from_body(body)

                async def receive():
                    return {"type": "http.request", "body": body, "more_body": False}

                request = Request(request.scope, receive)

        bind_auth_uid(uid)
        try:
            return await call_next(request)
        finally:
            unbind_auth_uid()
