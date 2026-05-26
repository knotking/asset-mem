"""Parse legacy checkpoint analysis tool args and workflow payloads."""

from __future__ import annotations

import ast
import json
import logging
import re
from typing import Any, Dict, Optional, Tuple

from google.adk.agents.invocation_context import InvocationContext

from ..checkpoint_dual_format_guard import (
    CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY,
    build_checkpoint_analysis_pending_payload,
    ensure_checkpoint_analysis_pending_stashed,
)
from .input_schema import CheckpointAnalysisInput

from .search_query import _text_from_user_content

logger = logging.getLogger(__name__)


def _tool_context(ctx: InvocationContext):
    """Resolve Context via ``agent`` so tests can ``patch.object(caa, 'Context', ...)``."""
    from . import agent as _agent

    return _agent.Context(invocation_context=ctx)


# Legacy prose keys emitted when checkpoint_agent passes a single ``request`` blob.
_LEGACY_ANALYSIS_FIELD_NAMES: Tuple[str, ...] = (
    "checkpoint_results",
    "user_query",
    "search_query",
    "checkpoint_optional_agents",
    "context_doc_uris",
    "property_address",
    "property_id",
    "search_location",
    "location_coordinates",
    "location_radius",
)
_LEGACY_FIELD_MARKER_RE = re.compile(
    r"(?:^|\n)("
    + "|".join(re.escape(k) for k in _LEGACY_ANALYSIS_FIELD_NAMES)
    + r")\s*:\s*",
    re.IGNORECASE,
)
# checkpoint_agent sometimes emits one line: field: '...', user_query: '...', ...
_INLINE_FIELD_MARKER_RE = re.compile(
    r"(?:^|,\s*)("
    + "|".join(re.escape(k) for k in _LEGACY_ANALYSIS_FIELD_NAMES)
    + r")\s*:\s*",
    re.IGNORECASE,
)


def _coerce_legacy_analysis_field(key: str, value_str: str) -> Any:
    """Parse one legacy ``key: value`` field from checkpoint_agent request prose."""
    raw = (value_str or "").strip()
    if not raw:
        return None
    if key in (
        "checkpoint_optional_agents",
        "context_doc_uris",
        "location_coordinates",
        "search_location",
    ):
        try:
            return ast.literal_eval(raw)
        except (SyntaxError, ValueError):
            logger.debug("checkpoint analysis parse: literal_eval failed for %s", key)
            return raw
    if key == "location_radius":
        try:
            return int(raw)
        except ValueError:
            return raw
    return raw


def parse_legacy_checkpoint_analysis_prose(text: str) -> Optional[Dict[str, Any]]:
    """
    Parse checkpoint_agent's legacy single-string tool arg:

        checkpoint_results: ...
        user_query: ...
        search_query: ...
    """
    raw = (text or "").strip()
    if not raw:
        return None
    if not _LEGACY_FIELD_MARKER_RE.search(raw):
        return None

    matches = list(_LEGACY_FIELD_MARKER_RE.finditer(raw))
    if not matches:
        return None

    out: Dict[str, Any] = {}
    for i, match in enumerate(matches):
        key = match.group(1).lower()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        value_str = raw[start:end].strip()
        coerced = _coerce_legacy_analysis_field(key, value_str)
        if coerced is not None:
            out[key] = coerced

    if not out.get("checkpoint_results") and not out.get("user_query"):
        return None
    if not out.get("checkpoint_optional_agents"):
        return None
    return out


def _strip_inline_field_value(value_str: str) -> str:
    """Trim commas, trailing braces, and optional wrapping quotes from inline field values."""
    raw = (value_str or "").strip()
    while raw.endswith("}"):
        raw = raw[:-1].strip()
    while raw.endswith(","):
        raw = raw[:-1].strip()
    if len(raw) >= 2:
        if raw[0] == raw[-1] and raw[0] in ("'", '"'):
            return raw[1:-1].strip()
    return raw


def parse_inline_checkpoint_analysis_request(text: str) -> Optional[Dict[str, Any]]:
    """
    Parse single-line comma-separated tool args from checkpoint_agent, e.g.::

        checkpoint_results: '...', user_query: 'analyse my checkpoints',
        checkpoint_optional_agents: ['coverage', 'diy'], search_query: 'garage paint'
    """
    raw = (text or "").strip()
    if not raw:
        return None
    if not _INLINE_FIELD_MARKER_RE.search(raw):
        return None

    matches = list(_INLINE_FIELD_MARKER_RE.finditer(raw))
    if not matches:
        return None

    out: Dict[str, Any] = {}
    for i, match in enumerate(matches):
        key = match.group(1).lower()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        value_str = _strip_inline_field_value(raw[start:end])
        coerced = _coerce_legacy_analysis_field(key, value_str)
        if coerced is not None:
            out[key] = coerced

    if not out.get("checkpoint_results") and not out.get("user_query"):
        return None
    if not out.get("checkpoint_optional_agents"):
        return None
    return out


def parse_checkpoint_analysis_payload(text: str) -> Optional[Dict[str, Any]]:
    """JSON object or legacy ``key: value`` prose → dict for CheckpointAnalysisInput."""
    raw = (text or "").strip()
    if not raw:
        return None

    if raw.startswith("{"):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict):
            return data

    legacy = parse_legacy_checkpoint_analysis_prose(raw)
    if legacy is not None:
        return legacy

    inline = parse_inline_checkpoint_analysis_request(raw)
    if inline is not None:
        return inline

    return None


def normalize_checkpoint_analysis_tool_args(
    args: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Normalize checkpoint_analysis_agent tool args to CheckpointAnalysisInput fields.

    Accepts structured args, legacy ``request`` prose, or a JSON string in ``request``.
    """
    if not isinstance(args, dict):
        raise TypeError("checkpoint_analysis_agent args must be a dict")

    structured_keys = {
        "checkpoint_results",
        "user_query",
        "checkpoint_optional_agents",
    }
    if structured_keys.issubset(args.keys()):
        return dict(args)

    merged: Dict[str, Any] = {
        k: v for k, v in args.items() if k != "request" and v is not None
    }
    request_blob = args.get("request")
    if isinstance(request_blob, str) and request_blob.strip():
        parsed = parse_checkpoint_analysis_payload(request_blob)
        if parsed:
            merged = {**parsed, **merged}
        elif "checkpoint_results" not in merged:
            merged["checkpoint_results"] = request_blob.strip()

    return merged


def _checkpoint_analysis_input_from_session_state(
    ctx: InvocationContext,
) -> Optional[CheckpointAnalysisInput]:
    """Build workflow input from session when transfer carries no JSON body."""
    tool_ctx = _tool_context(ctx)
    ensure_checkpoint_analysis_pending_stashed(tool_ctx.state)
    data = build_checkpoint_analysis_pending_payload(tool_ctx.state)
    if data is None:
        return None
    try:
        return CheckpointAnalysisInput.model_validate(data)
    except Exception as exc:
        logger.warning(
            "checkpoint optional parallel: session input validation failed: %s",
            exc,
        )
        return None


def _pending_checkpoint_analysis_input_from_state(
    ctx: InvocationContext,
) -> Optional[CheckpointAnalysisInput]:
    """Load analysis input stashed during checkpoint retrieval (doculink transfer path)."""
    tool_ctx = _tool_context(ctx)
    ensure_checkpoint_analysis_pending_stashed(tool_ctx.state)
    raw = tool_ctx.state.get(CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY)
    data: Optional[Dict[str, Any]] = None
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                data = parsed
        except json.JSONDecodeError:
            data = parse_checkpoint_analysis_payload(raw)
    elif isinstance(raw, dict):
        data = raw
    if data is None:
        data = build_checkpoint_analysis_pending_payload(tool_ctx.state)
    if data is None:
        return None
    try:
        return CheckpointAnalysisInput.model_validate(data)
    except Exception as exc:
        logger.warning(
            "checkpoint optional parallel: pending input validation failed: %s",
            exc,
        )
        return None


def _merge_routing_into_pending(
    routing: Dict[str, Any],
    pending: CheckpointAnalysisInput,
) -> Optional[CheckpointAnalysisInput]:
    """Overlay routing-only workflow JSON onto stashed pending analysis input."""
    merged = pending.model_dump()
    for key in (
        "user_query",
        "search_query",
        "checkpoint_optional_agents",
        "context_doc_uris",
        "property_address",
        "property_id",
        "search_location",
    ):
        if key in routing and routing[key] is not None:
            merged[key] = routing[key]
    try:
        return CheckpointAnalysisInput.model_validate(merged)
    except Exception as exc:
        logger.warning(
            "checkpoint optional parallel: routing merge validation failed: %s",
            exc,
        )
        return pending


def _parse_checkpoint_analysis_input(
    ctx: InvocationContext,
) -> Optional[CheckpointAnalysisInput]:
    """Parse workflow input (JSON or legacy prose) from the invocation user message."""
    text = _text_from_user_content(_tool_context(ctx).user_content)
    pending = _pending_checkpoint_analysis_input_from_state(ctx)

    if text:
        data = parse_checkpoint_analysis_payload(text)
        if data is not None:
            try:
                return CheckpointAnalysisInput.model_validate(data)
            except Exception as exc:
                ck = data.get("checkpoint_results")
                if pending is not None and (not isinstance(ck, str) or not ck.strip()):
                    merged = _merge_routing_into_pending(data, pending)
                    if merged is not None:
                        logger.info(
                            "checkpoint optional parallel: merged routing JSON "
                            "with pending analysis input"
                        )
                        return merged
                logger.warning(
                    "checkpoint optional parallel: workflow input validation failed: %s",
                    exc,
                )
        else:
            logger.warning(
                "checkpoint optional parallel: workflow input is not valid JSON or legacy prose"
            )

    if pending is not None:
        logger.info(
            "checkpoint optional parallel: using pending analysis input from session state"
        )
        return pending

    session_inp = _checkpoint_analysis_input_from_session_state(ctx)
    if session_inp is not None:
        logger.info(
            "checkpoint optional parallel: built analysis input from session fields"
        )
        return session_inp

    if text:
        logger.warning("checkpoint optional parallel: missing workflow input text")
    return None
