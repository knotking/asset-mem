"""Firestore-backed checkpoint analysis stash (property-scoped, cross ADK session)."""

from __future__ import annotations

import logging
import os
from typing import Any, Mapping, Optional

from .memory_bank import resolve_property_id
from .query_mode import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    build_session_working_memory,
)
from .sub_agents.checkpoint_dual_format.constants import (
    CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY,
)
from .sub_agents.checkpoint_dual_format.dual_format_body import (
    dual_format_has_valid_analysis_json,
    dual_format_is_passthrough_quality,
    extract_analysis_object_from_dual_format,
)

logger = logging.getLogger(__name__)

SESSION_ANALYSIS_DOC_ID = "current"
SESSION_ANALYSIS_SCHEMA_VERSION = 1
# Stay under Firestore's ~1 MiB doc limit with headroom for metadata.
_MAX_DUAL_FORMAT_BYTES = 900_000


def session_analysis_firestore_disabled() -> bool:
    raw = (os.getenv("SESSION_ANALYSIS_FIRESTORE_DISABLED") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def session_analysis_hydrate_disabled() -> bool:
    raw = (os.getenv("SESSION_ANALYSIS_FIRESTORE_HYDRATE_DISABLED") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def session_analysis_doc_path(*, user_id: str, property_id: str) -> str:
    return f"users/{user_id}/properties/{property_id}/agentSessionAnalysis/{SESSION_ANALYSIS_DOC_ID}"


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


def resolve_agent_session_id_from_context(ctx: Any) -> Optional[str]:
    session = getattr(ctx, "session", None)
    if session is None:
        return None
    for attr in ("id", "session_id"):
        value = getattr(session, attr, None)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def _analysis_progress_complete(body: str) -> bool:
    analysis = extract_analysis_object_from_dual_format(body)
    if not isinstance(analysis, dict):
        return True
    status = analysis.get("analysisStatus")
    if not isinstance(status, dict):
        return True
    return not any(str(v).lower() == "running" for v in status.values())


def _has_hydratable_dual_format(state: Mapping[str, Any]) -> bool:
    raw = state.get(CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY)
    return (
        isinstance(raw, str)
        and raw.strip()
        and dual_format_is_passthrough_quality(raw)
        and _analysis_progress_complete(raw)
    )


def state_has_complete_session_analysis(state: Mapping[str, Any] | None) -> bool:
    """True when ADK state already has memory + completed dual-format (no Firestore read)."""
    if not state:
        return False
    if not build_session_working_memory(state):
        return False
    return _has_hydratable_dual_format(state)


def _build_persist_payload(
    state: Mapping[str, Any],
    *,
    agent_session_id: Optional[str],
) -> Optional[dict[str, Any]]:
    body = state.get(CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY)
    if not isinstance(body, str) or not body.strip():
        return None
    if not dual_format_is_passthrough_quality(body):
        return None
    if not _analysis_progress_complete(body):
        return None

    snapshot = build_session_working_memory(state)
    if not snapshot:
        return None

    payload: dict[str, Any] = {
        "schemaVersion": SESSION_ANALYSIS_SCHEMA_VERSION,
        "workingMemorySnapshot": snapshot,
        "checkpointIds": state.get("checkpoint_ids") or [],
        "checkpointOptionalAgents": state.get("checkpoint_optional_agents")
        or state.get("_checkpoint_optional_agents_ui")
        or [],
    }
    if agent_session_id:
        payload["agentSessionId"] = agent_session_id

    encoded = body.encode("utf-8")
    if len(encoded) <= _MAX_DUAL_FORMAT_BYTES:
        payload["dualFormatBody"] = body.strip()
    else:
        logger.warning(
            "session_analysis_store: dualFormatBody too large (%d bytes); "
            "persisting working memory only",
            len(encoded),
        )
    return payload


def persist_session_analysis_to_firestore(
    state: Mapping[str, Any] | None,
    *,
    user_id: str,
    property_id: str,
    agent_session_id: Optional[str] = None,
    db: Any = None,
) -> bool:
    """Write latest completed analysis for a property (merge)."""
    if session_analysis_firestore_disabled() or not state:
        return False
    payload = _build_persist_payload(state, agent_session_id=agent_session_id)
    if not payload:
        return False

    try:
        from google.cloud import firestore

        if db is None:
            db = firestore.Client()
        ref = db.document(session_analysis_doc_path(user_id=user_id, property_id=property_id))
        payload["updatedAt"] = firestore.SERVER_TIMESTAMP
        ref.set(payload, merge=True)
    except Exception:
        logger.exception(
            "session_analysis_store: persist failed user_id=%s property_id=%s",
            user_id,
            property_id,
        )
        return False

    logger.info(
        "session_analysis_store: persisted user_id=%s property_id=%s "
        "dual_chars=%d snapshot_keys=%d",
        user_id,
        property_id,
        len(str(payload.get("dualFormatBody") or "")),
        len(payload.get("workingMemorySnapshot") or {}),
    )
    return True


def load_session_analysis_from_firestore(
    *,
    user_id: str,
    property_id: str,
    db: Any = None,
) -> Optional[dict[str, Any]]:
    if session_analysis_firestore_disabled() or session_analysis_hydrate_disabled():
        return None
    try:
        if db is None:
            from google.cloud import firestore

            db = firestore.Client()
        snap = db.document(
            session_analysis_doc_path(user_id=user_id, property_id=property_id)
        ).get()
    except Exception:
        logger.exception(
            "session_analysis_store: load failed user_id=%s property_id=%s",
            user_id,
            property_id,
        )
        return None
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    if not isinstance(data.get("workingMemorySnapshot"), dict):
        return None
    return data


def apply_session_analysis_doc_to_state(state: Any, doc: Mapping[str, Any]) -> bool:
    if state is None or not hasattr(state, "__setitem__"):
        return False
    snapshot = doc.get("workingMemorySnapshot")
    if not isinstance(snapshot, dict) or not snapshot:
        return False

    state[SESSION_WORKING_MEMORY_SNAPSHOT_KEY] = dict(snapshot)
    body = doc.get("dualFormatBody")
    if isinstance(body, str) and body.strip() and dual_format_has_valid_analysis_json(body):
        trimmed = body.strip()
        state[CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY] = trimmed
        state["checkpoint_result"] = trimmed
    state["checkpoint_last_response_kind"] = "analysis"
    if doc.get("checkpointIds"):
        state["checkpoint_ids"] = doc.get("checkpoint_ids")
    optional = doc.get("checkpointOptionalAgents")
    if isinstance(optional, list) and optional:
        state["_checkpoint_optional_agents_ui"] = list(optional)
    state["_session_analysis_hydrated_from_firestore"] = True
    return True


def maybe_hydrate_session_analysis_from_firestore(
    state: Any,
    *,
    user_id: Optional[str],
    property_id: Optional[str],
    db: Any = None,
) -> bool:
    """Load property analysis into ADK state when this session has no memory yet."""
    if not user_id or not property_id or state is None:
        return False
    if state_has_complete_session_analysis(state):
        return False
    optional = state.get("checkpoint_optional_agents")
    if isinstance(optional, list) and optional:
        return False
    doc = load_session_analysis_from_firestore(
        user_id=user_id,
        property_id=property_id,
        db=db,
    )
    if not doc:
        return False
    applied = apply_session_analysis_doc_to_state(state, doc)
    if applied:
        logger.info(
            "session_analysis_store: hydrated user_id=%s property_id=%s "
            "dual_chars=%d",
            user_id,
            property_id,
            len(str(doc.get("dualFormatBody") or "")),
        )
    return applied


def maybe_persist_session_analysis_from_state(
    state: Mapping[str, Any] | None,
    *,
    user_id: Optional[str] = None,
    property_id: Optional[str] = None,
    agent_session_id: Optional[str] = None,
    db: Any = None,
) -> bool:
    uid = (user_id or "").strip() if user_id else None
    pid = property_id or resolve_property_id(state)
    if not uid or not pid or not state:
        return False
    if state.get("user_id") is None and hasattr(state, "__setitem__"):
        try:
            state["user_id"] = uid  # type: ignore[index]
        except Exception:
            pass
    return persist_session_analysis_to_firestore(
        state,
        user_id=uid,
        property_id=pid,
        agent_session_id=agent_session_id,
        db=db,
    )
