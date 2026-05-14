"""Bind authenticated user id to stdlib logging for every log line (Cloud Run / Functions).

Uses a ContextVar + logging.Filter so existing logger.info(...) calls gain an
``auth_uid`` field on the LogRecord without touching each call site.
"""

from __future__ import annotations

import contextvars
import json
import logging
from contextlib import contextmanager
from typing import Any, Iterator, Optional

_auth_uid: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "auth_uid", default=None
)

# LIFO stack of tokens from contextvar.set(), for nested bind/unbind (e.g. workers).
_token_stack: contextvars.ContextVar[list[contextvars.Token[Optional[str]]]] = (
    contextvars.ContextVar("auth_uid_token_stack", default=[])
)


def get_auth_uid() -> Optional[str]:
    return _auth_uid.get()


def bind_auth_uid(uid: Optional[str]) -> None:
    """Push a uid onto the logging context (nested-safe)."""
    if uid is not None and not isinstance(uid, str):
        uid = str(uid)
    stack = list(_token_stack.get())
    stack.append(_auth_uid.set(uid))
    _token_stack.set(stack)


def unbind_auth_uid() -> None:
    """Pop the most recent bind_auth_uid."""
    stack = list(_token_stack.get())
    if not stack:
        return
    tok = stack.pop()
    _token_stack.set(stack)
    _auth_uid.reset(tok)


@contextmanager
def auth_uid_scope(uid: Optional[str]) -> Iterator[None]:
    """Bind auth uid for the duration of the block (nested-safe)."""
    bind_auth_uid(uid)
    try:
        yield
    finally:
        unbind_auth_uid()


def extract_auth_uid_from_json_dict(data: Any) -> Optional[str]:
    """Resolve auth user id from common JSON request shapes (proxy bodies)."""
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


class AuthUidLogFilter(logging.Filter):
    """Sets record.auth_uid for formatters."""

    def filter(self, record: logging.LogRecord) -> bool:
        uid = get_auth_uid()
        record.auth_uid = uid if uid else "-"
        return True


_FILTER_SINGLETON = AuthUidLogFilter()
_INSTALLED = False

_DEFAULT_FORMAT = (
    "%(asctime)s [auth_uid=%(auth_uid)s] %(name)s %(levelname)s %(message)s"
)


def install_auth_uid_logging(
    *,
    level: int = logging.INFO,
    datefmt: Optional[str] = None,
) -> None:
    """Attach AuthUidLogFilter and formatter to the root logger (idempotent)."""
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
                if not fmt_str or "auth_uid" not in fmt_str:
                    h.setFormatter(logging.Formatter(_DEFAULT_FORMAT, datefmt=datefmt))

    _INSTALLED = True


def install_auth_uid_logging_if_needed(
    *, level: int = logging.INFO, datefmt: Optional[str] = None
) -> None:
    """Call from workers after their basicConfig so root handlers already exist."""
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
