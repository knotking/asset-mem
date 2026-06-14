"""Conformance ADK session user id (Firestore partition for tool calls)."""

from __future__ import annotations

import os

DEFAULT_CONFORMANCE_USER_ID = "adk_conformance_test_user"
_ENV_VAR = "CONFORMANCE_USER_ID"


def resolve_conformance_user_id() -> str:
    """Return ADK session user id for record/replay (default: synthetic test user)."""
    raw = (os.getenv(_ENV_VAR) or "").strip()
    return raw or DEFAULT_CONFORMANCE_USER_ID
