"""Context identity helpers shared across agent runtime modules."""

from __future__ import annotations

from typing import Any, Optional

from agent_framework.observability.logging_context import (
    extract_correlation_id_from_json_dict,
)


def resolve_user_id_from_context(ctx: Any) -> Optional[str]:
    state = getattr(ctx, "state", None)
    if state is not None and hasattr(state, "get"):
        uid = state.get("user_id")
        if uid is not None and str(uid).strip():
            return str(uid).strip()
    session = getattr(ctx, "session", None)
    if session is not None:
        uid = getattr(session, "user_id", None)
        if uid is not None and str(uid).strip():
            return str(uid).strip()
    uid = getattr(ctx, "user_id", None)
    if uid is not None and str(uid).strip():
        return str(uid).strip()
    return None


def resolve_auth_uid_from_context(ctx: Any) -> Optional[str]:
    """Auth uid for logging: state, session, then context ``user_id``."""
    return resolve_user_id_from_context(ctx)


def resolve_correlation_id_from_context(ctx: Any) -> Optional[str]:
    """Correlation / request id from session state when present."""
    session = getattr(ctx, "session", None)
    if session is not None:
        state = getattr(session, "state", None)
        if isinstance(state, dict):
            cid = extract_correlation_id_from_json_dict(state)
            if cid:
                return cid
    return None
