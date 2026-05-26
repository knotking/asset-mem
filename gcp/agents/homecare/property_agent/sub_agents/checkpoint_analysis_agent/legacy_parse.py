"""Parse checkpoint analysis workflow input (JSON + session stash)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from google.adk.agents.invocation_context import InvocationContext

from ...conversational_intent import OPTIONAL_CHECKPOINT_BRANCHES
from ..checkpoint_dual_format_guard import (
    CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY,
    build_checkpoint_analysis_pending_payload,
    ensure_checkpoint_analysis_pending_stashed,
)
from .input_schema import CheckpointAnalysisInput

from .search_query import _text_from_user_content

logger = logging.getLogger(__name__)

_VALID_BRANCHES = frozenset(OPTIONAL_CHECKPOINT_BRANCHES)


def _tool_context(ctx: InvocationContext):
    """Resolve Context via ``agent`` so tests can ``patch.object(caa, 'Context', ...)``."""
    from . import agent as _agent

    return _agent.Context(invocation_context=ctx)


def parse_checkpoint_analysis_payload(text: str) -> Optional[Dict[str, Any]]:
    """Parse a JSON object for CheckpointAnalysisInput fields."""
    raw = (text or "").strip()
    if not raw.startswith("{"):
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def normalize_checkpoint_analysis_tool_args(
    args: Dict[str, Any],
) -> Dict[str, Any]:
    """Normalize checkpoint_analysis_agent tool args to CheckpointAnalysisInput fields."""
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
    """Load analysis input stashed during checkpoint_agent retrieval."""
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


def _normalize_optional_branch_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(b) for b in raw if str(b) in _VALID_BRANCHES]


def _authoritative_optional_branches(
    state: Any,
    *,
    pending_branches: list[str],
    routing_branches: list[str],
) -> list[str]:
    """
    Branches for checkpoint_progress — never trust client payload toggles over resolve/pending.

    Priority: [RESOLVED_TURN].run_optional_agents → pending stash → routing JSON.
    """
    if state is not None and hasattr(state, "get"):
        from property_agent.resolve_turn import resolved_turn_from_state

        resolved = resolved_turn_from_state(state)
        if (
            resolved is not None
            and not resolved.retrieval_only
            and resolved.run_optional_agents
        ):
            return list(resolved.run_optional_agents)
    if pending_branches:
        return list(pending_branches)
    return list(routing_branches)


def _merge_routing_into_pending(
    routing: Dict[str, Any],
    pending: CheckpointAnalysisInput,
    *,
    state: Any = None,
) -> Optional[CheckpointAnalysisInput]:
    """Overlay routing workflow JSON onto stashed pending input (optional branches excluded)."""
    merged = pending.model_dump()
    for key in (
        "user_query",
        "search_query",
        "context_doc_uris",
        "property_address",
        "property_id",
        "search_location",
    ):
        if key in routing and routing[key] is not None:
            merged[key] = routing[key]

    merged["checkpoint_optional_agents"] = _authoritative_optional_branches(
        state,
        pending_branches=_normalize_optional_branch_list(
            pending.checkpoint_optional_agents
        ),
        routing_branches=_normalize_optional_branch_list(
            routing.get("checkpoint_optional_agents")
        ),
    )
    try:
        return CheckpointAnalysisInput.model_validate(merged)
    except Exception as exc:
        logger.warning(
            "checkpoint optional parallel: routing merge validation failed: %s",
            exc,
        )
        return pending


def _apply_authoritative_branches_to_input(
    inp: CheckpointAnalysisInput,
    *,
    state: Any,
) -> CheckpointAnalysisInput:
    branches = _authoritative_optional_branches(
        state,
        pending_branches=_normalize_optional_branch_list(inp.checkpoint_optional_agents),
        routing_branches=[],
    )
    if branches == list(inp.checkpoint_optional_agents or []):
        return inp
    merged = inp.model_dump()
    merged["checkpoint_optional_agents"] = branches
    return CheckpointAnalysisInput.model_validate(merged)


def _parse_checkpoint_analysis_input(
    ctx: InvocationContext,
) -> Optional[CheckpointAnalysisInput]:
    """Parse workflow input JSON from the invocation user message."""
    tool_ctx = _tool_context(ctx)
    state = tool_ctx.state
    text = _text_from_user_content(tool_ctx.user_content)
    pending = _pending_checkpoint_analysis_input_from_state(ctx)

    if text:
        data = parse_checkpoint_analysis_payload(text)
        if data is not None:
            try:
                inp = CheckpointAnalysisInput.model_validate(data)
                return _apply_authoritative_branches_to_input(inp, state=state)
            except Exception as exc:
                ck = data.get("checkpoint_results")
                if pending is not None and (not isinstance(ck, str) or not ck.strip()):
                    merged = _merge_routing_into_pending(
                        data, pending, state=state
                    )
                    if merged is not None:
                        logger.info(
                            "checkpoint optional parallel: merged routing JSON "
                            "with pending analysis input branches=%r",
                            merged.checkpoint_optional_agents,
                        )
                        return merged
                logger.warning(
                    "checkpoint optional parallel: workflow input validation failed: %s",
                    exc,
                )
        else:
            logger.warning(
                "checkpoint optional parallel: workflow input is not valid JSON"
            )

    if pending is not None:
        logger.info(
            "checkpoint optional parallel: using pending analysis input from session state"
        )
        return _apply_authoritative_branches_to_input(pending, state=state)

    session_inp = _checkpoint_analysis_input_from_session_state(ctx)
    if session_inp is not None:
        logger.info(
            "checkpoint optional parallel: built analysis input from session fields"
        )
        return _apply_authoritative_branches_to_input(session_inp, state=state)

    if text:
        logger.warning("checkpoint optional parallel: missing workflow input text")
    return None
