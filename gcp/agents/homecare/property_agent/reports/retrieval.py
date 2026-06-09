"""Load frozen property report snapshots for report-mode chat."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Mapping, Optional

from google.adk.tools import ToolContext

from agent_framework.state.context_ids import resolve_user_id_from_context

logger = logging.getLogger(__name__)

REPORT_RETRIEVAL_CACHE_TEXT_KEY = "_cached_report_retrieval_text"
REPORT_RETRIEVAL_CACHE_FP_KEY = "_cached_report_retrieval_fingerprint"
REPORT_RETRIEVAL_INVOCATION_SERVED_KEY = "_report_retrieval_served_invocation_id"
REPORT_RETRIEVAL_LAST_RESULT_KEY = "_report_retrieval_last_result"

# Process-local guard: Agent Engine may not persist session state between tool
# calls in the same invocation, so block repeat fetches on the same worker.
_INVOCATION_REPORT_RESULTS: dict[str, str] = {}
_MAX_INVOCATION_REPORT_RESULTS = 256


def report_retrieval_fingerprint(
    report_ids: list[str],
    report_revisions: Optional[dict[str, int]] = None,
) -> str:
    revs = report_revisions or {}
    return json.dumps(
        {
            "report_ids": sorted(report_ids),
            "report_revisions": {str(k): int(v) for k, v in sorted(revs.items())},
        },
        sort_keys=True,
    )


def _report_revisions_from_state(state: Mapping[str, Any]) -> dict[str, int]:
    report_revisions_raw = state.get("report_revisions") or {}
    return {
        str(report_id): int(revision)
        for report_id, revision in report_revisions_raw.items()
        if str(report_id).strip() and revision is not None
    }


def _invocation_id_from_tool_context(tool_context: ToolContext) -> str:
    inv = getattr(
        getattr(tool_context, "_invocation_context", None),
        "invocation_id",
        None,
    )
    return str(inv).strip() if inv is not None else ""


def get_invocation_report_result(invocation_id: str) -> Optional[str]:
    inv = (invocation_id or "").strip()
    if not inv:
        return None
    text = _INVOCATION_REPORT_RESULTS.get(inv)
    if isinstance(text, str) and text.strip():
        return text
    return None


def store_invocation_report_result(invocation_id: str, text: str) -> None:
    inv = (invocation_id or "").strip()
    body = (text or "").strip()
    if not inv or not body:
        return
    if len(_INVOCATION_REPORT_RESULTS) >= _MAX_INVOCATION_REPORT_RESULTS:
        oldest = next(iter(_INVOCATION_REPORT_RESULTS))
        _INVOCATION_REPORT_RESULTS.pop(oldest, None)
    _INVOCATION_REPORT_RESULTS[inv] = text


def store_report_retrieval_last_result(state: Any, text: str) -> None:
    if state is None or not hasattr(state, "__setitem__"):
        return
    body = (text or "").strip()
    if body:
        state[REPORT_RETRIEVAL_LAST_RESULT_KEY] = text


def get_report_retrieval_last_result(
    state: Mapping[str, Any] | None,
    *,
    invocation_id: str = "",
) -> Optional[str]:
    inv = (invocation_id or "").strip()
    if inv:
        from_inv = get_invocation_report_result(inv)
        if from_inv:
            return from_inv
    if not state:
        return None
    last = state.get(REPORT_RETRIEVAL_LAST_RESULT_KEY)
    if isinstance(last, str) and last.strip():
        return last
    return None


def get_report_retrieval_cached_text(state: Mapping[str, Any]) -> Optional[str]:
    if not report_retrieval_cache_hit(state):
        return None
    cached = state.get(REPORT_RETRIEVAL_CACHE_TEXT_KEY)
    if isinstance(cached, str) and cached.strip():
        return cached
    return None


def report_retrieval_served_this_invocation(
    state: Mapping[str, Any],
    invocation_id: str,
) -> bool:
    inv = (invocation_id or "").strip()
    if not inv:
        return False
    return state.get(REPORT_RETRIEVAL_INVOCATION_SERVED_KEY) == inv


def mark_report_retrieval_served(state: Any, invocation_id: str) -> None:
    inv = (invocation_id or "").strip()
    if not inv or state is None or not hasattr(state, "__setitem__"):
        return
    state[REPORT_RETRIEVAL_INVOCATION_SERVED_KEY] = inv


def report_retrieval_cache_hit(state: Mapping[str, Any]) -> bool:
    report_ids = [str(rid).strip() for rid in (state.get("report_ids") or []) if str(rid).strip()]
    if not report_ids:
        return False
    fingerprint = report_retrieval_fingerprint(
        report_ids,
        _report_revisions_from_state(state),
    )
    if state.get(REPORT_RETRIEVAL_CACHE_FP_KEY) != fingerprint:
        return False
    cached = state.get(REPORT_RETRIEVAL_CACHE_TEXT_KEY)
    return isinstance(cached, str) and bool(cached.strip())


def _store_report_retrieval_cache(
    state: Any,
    *,
    fingerprint: str,
    text: str,
) -> None:
    if state is None or not hasattr(state, "__setitem__"):
        return
    state[REPORT_RETRIEVAL_CACHE_TEXT_KEY] = text
    state[REPORT_RETRIEVAL_CACHE_FP_KEY] = fingerprint


def _format_report_block(report_id: str, data: dict[str, Any]) -> str:
    title = str(data.get("title") or "Report").strip()
    revision = data.get("revision") or 1
    status = str(data.get("status") or "unknown")
    if status != "ready":
        return (
            f"### {title} (v{revision}, id={report_id})\n"
            f"Status: {status} — this report is not ready for Q&A.\n"
        )

    chat_md = (data.get("chatMarkdown") or "").strip()
    if chat_md:
        return f"### {title} (v{revision}, id={report_id})\n\n{chat_md}\n"

    snapshot = data.get("contentSnapshot")
    if isinstance(snapshot, dict):
        try:
            return (
                f"### {title} (v{revision}, id={report_id})\n\n"
                f"```json\n{json.dumps(snapshot, indent=2, default=str)}\n```\n"
            )
        except (TypeError, ValueError):
            pass

    return (
        f"### {title} (v{revision}, id={report_id})\n"
        "No chatMarkdown or contentSnapshot found on this report.\n"
    )


def _load_report_data(
    reports_ref: Any,
    report_id: str,
    revision: Optional[int],
) -> Optional[dict[str, Any]]:
    doc = reports_ref.document(report_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    current_revision = int(data.get("revision") or 1)
    if revision is None or revision == current_revision:
        return data
    archived = (
        reports_ref.document(report_id)
        .collection("revisions")
        .document(str(revision))
        .get()
    )
    if not archived.exists:
        return data
    archived_data = archived.to_dict() or {}
    merged = {**data, **archived_data}
    merged["revision"] = revision
    return merged


def _load_reports_sync(
    *,
    user_id: str,
    property_id: str,
    report_ids: list[str],
    report_revisions: Optional[dict[str, int]] = None,
) -> str:
    from google.cloud import firestore  # type: ignore[attr-defined]

    db = firestore.Client()
    reports_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("reports")
    )

    blocks: list[str] = []
    missing: list[str] = []
    revisions = report_revisions or {}
    for report_id in report_ids:
        try:
            revision_raw = revisions.get(report_id)
            revision = int(revision_raw) if revision_raw is not None else None
            data = _load_report_data(reports_ref, report_id, revision)
        except Exception as exc:
            logger.error("report_retrieval fetch failed id=%s: %s", report_id, exc, exc_info=True)
            missing.append(report_id)
            continue
        if not data:
            missing.append(report_id)
            continue
        blocks.append(_format_report_block(report_id, data))

    if not blocks:
        return (
            "No saved reports could be loaded. "
            f"Requested ids: {report_ids}. Missing or inaccessible: {missing or report_ids}."
        )

    header = (
        "Frozen property report context. List ONLY the sections and issues below — "
        "do not add roofing, HVAC, plumbing, or other systems not named here. "
        "Not live checkpoints.\n\n"
    )
    body = "\n".join(blocks)
    if missing:
        body += f"\n\nNote: could not load report ids: {missing}."
    return header + body


def _finalize_report_retrieval_result(
    tool_context: ToolContext,
    text: str,
    *,
    invocation_id: str,
) -> str:
    store_report_retrieval_last_result(tool_context.state, text)
    if invocation_id:
        store_invocation_report_result(invocation_id, text)
    return text


def _resolve_report_user_id(tool_context: ToolContext) -> Optional[str]:
    user_id = resolve_user_id_from_context(tool_context)
    if user_id:
        return user_id
    inv = getattr(tool_context, "_invocation_context", None)
    session = getattr(inv, "session", None) if inv is not None else None
    if session is not None:
        uid = getattr(session, "user_id", None)
        if uid is not None and str(uid).strip():
            return str(uid).strip()
    return None


async def report_retrieval(
    user_query: str,
    tool_context: ToolContext,
) -> str:
    """Load persisted report snapshots (contentSnapshot / chatMarkdown) for Q&A."""
    state = tool_context.state
    inv_id = _invocation_id_from_tool_context(tool_context)
    prior = get_report_retrieval_last_result(state, invocation_id=inv_id)
    if prior:
        logger.info(
            "report_retrieval repeat blocked invocation_id=%s chars=%d",
            inv_id or "-",
            len(prior),
        )
        return prior

    report_ids_raw = state.get("report_ids") or []
    report_ids = [str(rid).strip() for rid in report_ids_raw if str(rid).strip()]
    if not report_ids:
        return _finalize_report_retrieval_result(
            tool_context,
            (
                "Error: report_ids are required in Reports mode. "
                "Ask the user to attach one or more ready property reports."
            ),
            invocation_id=inv_id,
        )

    user_id = _resolve_report_user_id(tool_context)
    property_id = str(state.get("property_id") or "").strip()
    if not user_id or not property_id:
        logger.warning(
            "report_retrieval missing identity user_id=%s property_id=%s",
            bool(user_id),
            bool(property_id),
        )
        return _finalize_report_retrieval_result(
            tool_context,
            (
                "Error: property context is missing (user_id or property_id). "
                "Cannot load saved reports."
            ),
            invocation_id=inv_id,
        )

    report_revisions = _report_revisions_from_state(state)
    fingerprint = report_retrieval_fingerprint(report_ids, report_revisions)
    if state.get(REPORT_RETRIEVAL_CACHE_FP_KEY) == fingerprint:
        cached = state.get(REPORT_RETRIEVAL_CACHE_TEXT_KEY)
        if isinstance(cached, str) and cached.strip():
            logger.info(
                "report_retrieval cache hit user_id=%s property_id=%s report_count=%d",
                user_id,
                property_id,
                len(report_ids),
            )
            return cached

    logger.info(
        "report_retrieval start user_id=%s property_id=%s report_count=%d query_len=%d",
        user_id,
        property_id,
        len(report_ids),
        len(user_query or ""),
    )

    loaded = await asyncio.to_thread(
        _load_reports_sync,
        user_id=user_id,
        property_id=property_id,
        report_ids=report_ids,
        report_revisions=report_revisions or None,
    )
    _store_report_retrieval_cache(state, fingerprint=fingerprint, text=loaded)
    _finalize_report_retrieval_result(tool_context, loaded, invocation_id=inv_id)
    logger.info(
        "report_retrieval loaded user_id=%s property_id=%s report_count=%d chars=%d load_failed=%s",
        user_id,
        property_id,
        len(report_ids),
        len(loaded),
        loaded.startswith("No saved reports could be loaded"),
    )
    return loaded


__all__ = [
    "report_retrieval",
    "report_retrieval_cache_hit",
    "report_retrieval_fingerprint",
    "report_retrieval_served_this_invocation",
    "get_report_retrieval_cached_text",
    "get_report_retrieval_last_result",
    "get_invocation_report_result",
    "store_invocation_report_result",
    "store_report_retrieval_last_result",
    "mark_report_retrieval_served",
    "REPORT_RETRIEVAL_CACHE_FP_KEY",
    "REPORT_RETRIEVAL_CACHE_TEXT_KEY",
    "REPORT_RETRIEVAL_INVOCATION_SERVED_KEY",
    "REPORT_RETRIEVAL_LAST_RESULT_KEY",
]
