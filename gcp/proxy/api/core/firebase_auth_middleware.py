"""Bind auth uid from Bearer token or JSON body for structured logging."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from common.observability.logging_context import (
    bind_auth_uid,
    parse_json_auth_uid_from_body,
    unbind_auth_uid,
)
from core.config import settings
from core import firebase_auth


class FirebaseAuthLoggingMiddleware(BaseHTTPMiddleware):
    """
    Runs before route handlers: verifies Bearer when auth is required, or
    parses body uid when DISABLE_FIREBASE_AUTH is set.
    """

    async def dispatch(self, request: Request, call_next):
        uid = None
        if not settings.DISABLE_FIREBASE_AUTH:
            auth_header = request.headers.get("authorization") or ""
            if auth_header.lower().startswith("bearer "):
                token = auth_header[7:].strip()
                if token:
                    uid = firebase_auth.verify_id_token(token)
                    request.state.auth_uid = uid
        elif request.method in ("POST", "PUT", "PATCH", "DELETE"):
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type.lower():
                body = await request.body()
                uid = parse_json_auth_uid_from_body(body)
                request.state.body_auth_uid = uid

                async def receive():
                    return {"type": "http.request", "body": body, "more_body": False}

                request = Request(request.scope, receive)

        bind_auth_uid(uid)
        try:
            return await call_next(request)
        finally:
            unbind_auth_uid()
