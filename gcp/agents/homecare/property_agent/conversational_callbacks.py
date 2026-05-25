"""ADK callbacks for conversational intent bypass."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.context import Context
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import BaseTool, ToolContext
from google.genai import types

from .conversational_intent import (
    CHECKPOINT_LAST_RESPONSE_KIND_KEY,
    CONVERSATIONAL_TURN_STATE_KEY,
    build_conversational_reply,
    classify_turn,
    last_turn_delivered_checkpoint_analysis,
    resolve_property_address_from_state,
    resolve_user_query_from_state,
    should_skip_tools,
)

logger = logging.getLogger(__name__)

_BLOCKED_DOCULINK_TOOLS = frozenset(
    {
        "checkpoint_agent",
        "ask_user_docs_agent",
        "ask_knowledge_base_agent",
    }
)

_CONVERSATIONAL_TOOL_RESULT = {
    "result": "Skipped: conversational turn — respond in plain text only."
}


def _session_events(ctx: Context) -> list:
    invocation = getattr(ctx, "_invocation_context", None)
    if invocation is None:
        return []
    session = getattr(invocation, "session", None)
    if session is None:
        return []
    return list(getattr(session, "events", None) or [])


def _invocation_id(ctx: Context) -> Optional[str]:
    invocation = getattr(ctx, "_invocation_context", None)
    if invocation is None:
        return None
    return getattr(invocation, "invocation_id", None)


def _plain_llm_response(text: str) -> LlmResponse:
    return LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text=text)]),
    )


def apply_conversational_state_for_turn(
    callback_context: Context,
    *,
    agent_name: str,
) -> Optional[LlmResponse]:
    """When conversational, set state and optionally return a canned model response."""
    state = callback_context.state
    user_query = resolve_user_query_from_state(state)
    if not user_query:
        return None

    events = _session_events(callback_context)
    inv_id = _invocation_id(callback_context)
    prior_analysis = last_turn_delivered_checkpoint_analysis(
        events,
        current_invocation_id=inv_id,
        state=state,
    )

    if not should_skip_tools(
        user_query,
        session_events=events,
        current_invocation_id=inv_id,
        state=state,
    ):
        state[CONVERSATIONAL_TURN_STATE_KEY] = False
        return None

    label = classify_turn(
        user_query,
        session_events=events,
        current_invocation_id=inv_id,
        state=state,
    )
    state[CONVERSATIONAL_TURN_STATE_KEY] = True
    # Prevent optional-agent pipeline for this invocation only.
    if "checkpoint_optional_agents" in state:
        state["_saved_checkpoint_optional_agents"] = state.get(
            "checkpoint_optional_agents"
        )
        state["checkpoint_optional_agents"] = []

    logger.info(
        "conversational bypass agent=%s label=%s prior_analysis=%s query_len=%d",
        agent_name,
        label,
        prior_analysis,
        len(user_query),
    )

    # Root and doculink: deterministic plain-text reply (no tools / transfer).
    if agent_name in ("property_agent", "doculink_agent"):
        address = resolve_property_address_from_state(state)
        text = build_conversational_reply(
            label,
            property_address=address,
            prior_analysis=prior_analysis,
        )
        return _plain_llm_response(text)

    return None


def conversational_before_tool(
    tool: BaseTool,
    args: Dict[str, Any],
    tool_context: ToolContext,
    **kwargs: Any,
) -> Optional[dict]:
    _ = (args, kwargs)
    if not tool_context.state.get(CONVERSATIONAL_TURN_STATE_KEY):
        return None

    tool_name = getattr(tool, "name", None) or type(tool).__name__
    if tool_name in _BLOCKED_DOCULINK_TOOLS:
        logger.info("conversational before_tool: blocked tool=%s", tool_name)
        return dict(_CONVERSATIONAL_TOOL_RESULT)

    if tool_name == "transfer_to_agent":
        agent_name = (args or {}).get("agent_name")
        if agent_name == "checkpoint_progress_agent":
            logger.info(
                "conversational before_tool: blocked transfer_to_agent=%s",
                agent_name,
            )
            return dict(_CONVERSATIONAL_TOOL_RESULT)

    return None


def mark_checkpoint_response_kind(
    callback_context: CallbackContext,
    *,
    kind: str,
) -> None:
    callback_context.state[CHECKPOINT_LAST_RESPONSE_KIND_KEY] = kind
