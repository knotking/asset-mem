"""Bind request context (auth uid, correlation id) to stdlib logging.

Uses ContextVars + logging.Filter so existing logger.info(...) calls gain
``auth_uid`` and ``correlation_id`` on each LogRecord without touching call sites.

Deployed Agent Engine packages only ``property_agent``; this file mirrors
``gcp/common/observability/logging_context.py`` — keep behavior in sync when changing either.
"""

from __future__ import annotations

import contextvars
import json
import logging
import re
from contextlib import contextmanager
from typing import Any, Iterator, Optional

REQUEST_ID_HEADER = "X-Request-ID"

_auth_uid: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "auth_uid", default=None
)

_correlation_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)

_token_stack: contextvars.ContextVar[list[contextvars.Token[Optional[str]]]] = (
    contextvars.ContextVar("auth_uid_token_stack", default=[])
)

_correlation_token_stack: contextvars.ContextVar[
    list[contextvars.Token[Optional[str]]]
] = contextvars.ContextVar("correlation_id_token_stack", default=[])

_CORRELATION_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def get_auth_uid() -> Optional[str]:
    return _auth_uid.get()


def get_correlation_id() -> Optional[str]:
    return _correlation_id.get()


def bind_correlation_id(correlation_id: Optional[str]) -> None:
    if correlation_id is not None and not isinstance(correlation_id, str):
        correlation_id = str(correlation_id)
    stack = list(_correlation_token_stack.get())
    stack.append(_correlation_id.set(correlation_id))
    _correlation_token_stack.set(stack)


def unbind_correlation_id() -> None:
    stack = list(_correlation_token_stack.get())
    if not stack:
        return
    tok = stack.pop()
    _correlation_token_stack.set(stack)
    _correlation_id.reset(tok)


@contextmanager
def correlation_id_scope(correlation_id: Optional[str]) -> Iterator[None]:
    bind_correlation_id(correlation_id)
    try:
        yield
    finally:
        unbind_correlation_id()


def bind_auth_uid(uid: Optional[str]) -> None:
    if uid is not None and not isinstance(uid, str):
        uid = str(uid)
    stack = list(_token_stack.get())
    stack.append(_auth_uid.set(uid))
    _token_stack.set(stack)


def unbind_auth_uid() -> None:
    stack = list(_token_stack.get())
    if not stack:
        return
    tok = stack.pop()
    _token_stack.set(stack)
    _auth_uid.reset(tok)


@contextmanager
def auth_uid_scope(uid: Optional[str]) -> Iterator[None]:
    bind_auth_uid(uid)
    try:
        yield
    finally:
        unbind_auth_uid()


def extract_correlation_id_from_json_dict(data: Any) -> Optional[str]:
    if not isinstance(data, dict):
        return None
    for key in ("correlation_id", "correlationId", "request_id", "requestId"):
        val = data.get(key)
        if isinstance(val, str):
            candidate = val.strip()
            if candidate and _CORRELATION_ID_RE.match(candidate):
                return candidate
    for nest_key in ("metadata", "context", "payload"):
        sub = data.get(nest_key)
        if isinstance(sub, dict):
            found = extract_correlation_id_from_json_dict(sub)
            if found:
                return found
    return None


def extract_auth_uid_from_json_dict(data: Any) -> Optional[str]:
    if not isinstance(data, dict):
        return None
    uid = data.get("user_id") or data.get("userId")
    if isinstance(uid, str) and uid.strip():
        return uid.strip()
    for nest_key in ("user", "context", "metadata", "payload"):
        sub = data.get(nest_key)
        if isinstance(sub, dict):
            uid = sub.get("user_id") or sub.get("userId")
            if isinstance(uid, str) and uid.strip():
                return uid.strip()
    return None


class RequestContextLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        uid = get_auth_uid()
        record.auth_uid = uid if uid else "-"
        cid = get_correlation_id()
        record.correlation_id = cid if cid else "-"
        return True


AuthUidLogFilter = RequestContextLogFilter

_FILTER_SINGLETON = RequestContextLogFilter()
_INSTALLED = False

_DEFAULT_FORMAT = (
    "%(asctime)s [auth_uid=%(auth_uid)s] [req=%(correlation_id)s] "
    "%(name)s %(levelname)s %(message)s"
)


def install_auth_uid_logging(
    *,
    level: int = logging.INFO,
    datefmt: Optional[str] = None,
) -> None:
    global _INSTALLED
    root = logging.getLogger()
    root.setLevel(level)

    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setLevel(level)
        handler.setFormatter(logging.Formatter(_DEFAULT_FORMAT, datefmt=datefmt))
        handler.addFilter(_FILTER_SINGLETON)
        root.addHandler(handler)
    else:
        for h in root.handlers:
            if _FILTER_SINGLETON not in h.filters:
                h.addFilter(_FILTER_SINGLETON)
            if isinstance(h, logging.StreamHandler):
                fmt_obj = h.formatter
                fmt_str = ""
                if isinstance(fmt_obj, logging.Formatter):
                    fmt_str = getattr(fmt_obj, "_fmt", "") or ""
                if (
                    not fmt_str
                    or "auth_uid" not in fmt_str
                    or "correlation_id" not in fmt_str
                ):
                    h.setFormatter(logging.Formatter(_DEFAULT_FORMAT, datefmt=datefmt))

    _INSTALLED = True


def install_auth_uid_logging_if_needed(
    *, level: int = logging.INFO, datefmt: Optional[str] = None
) -> None:
    if not _INSTALLED:
        install_auth_uid_logging(level=level, datefmt=datefmt)


def parse_json_auth_uid_from_body(raw: bytes) -> Optional[str]:
    if not raw:
        return None
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return None
    return extract_auth_uid_from_json_dict(data)
