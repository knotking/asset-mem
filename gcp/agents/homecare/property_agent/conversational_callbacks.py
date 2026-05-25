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
    expand_indexical_user_query,
    is_greeting_like,
    last_turn_delivered_checkpoint_analysis,
    normalize_user_query,
    resolve_property_address_from_state,
    resolve_user_query_for_turn,
    should_skip_tools,
)
from .resolve_turn import (
    requests_optional_analysis_from_resolved,
    resolved_turn_from_state,
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


def _state_take(state: Any, key: str, default: Any = None) -> Any:
    """Read and clear a session state key (ADK ``State`` has no ``dict.pop``)."""
    if state is None or not hasattr(state, "get"):
        return default
    value = state.get(key, default)
    if hasattr(state, "__setitem__"):
        state[key] = None
    return value


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


def _fail_closed_canned_greeting(state: Any) -> LlmResponse:
    """Safe canned reply when callbacks error on a greeting-shaped turn."""
    address = resolve_property_address_from_state(state)
    if state is not None and hasattr(state, "__setitem__"):
        state[CONVERSATIONAL_TURN_STATE_KEY] = True
        state["_saved_checkpoint_optional_agents"] = state.get(
            "checkpoint_optional_agents"
        )
        state["checkpoint_optional_agents"] = []
    text = build_conversational_reply(
        "greeting",
        property_address=address,
        state=state,
    )
    return _plain_llm_response(text)


def _apply_conversational_state_for_turn_impl(
    callback_context: Context,
    *,
    agent_name: str,
    llm_request: Any = None,
) -> Optional[LlmResponse]:
    """When conversational, set state and return a canned model response (no extra LLM)."""
    state = callback_context.state
    user_query = resolve_user_query_for_turn(
        callback_context, llm_request=llm_request
    )
    if not user_query:
        logger.debug(
            "conversational bypass skipped agent=%s (no user_query in state or events)",
            agent_name,
        )
        return None

    expanded = expand_indexical_user_query(user_query, state)
    if expanded != user_query and hasattr(state, "__setitem__"):
        state["user_query"] = expanded
        user_query = expanded

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
        saved = _state_take(state, "_saved_checkpoint_optional_agents")
        if saved and not state.get("checkpoint_optional_agents"):
            state["checkpoint_optional_agents"] = saved
        return None

    label = classify_turn(
        user_query,
        session_events=events,
        current_invocation_id=inv_id,
        state=state,
    )
    state[CONVERSATIONAL_TURN_STATE_KEY] = True
    state["_saved_checkpoint_optional_agents"] = state.get(
        "checkpoint_optional_agents"
    )
    state["checkpoint_optional_agents"] = []

    address = resolve_property_address_from_state(state)
    scaffold = build_conversational_reply(
        label,
        property_address=address,
        prior_analysis=prior_analysis,
        state=state,
    )

    if agent_name == "property_agent":
        logger.info(
            "conversational canned agent=%s label=%s prior_analysis=%s query=%r",
            agent_name,
            label,
            prior_analysis,
            user_query[:80],
        )
        return _plain_llm_response(scaffold)

    return None


def apply_conversational_state_for_turn(
    callback_context: Context,
    *,
    agent_name: str,
    llm_request: Any = None,
) -> Optional[LlmResponse]:
    try:
        return _apply_conversational_state_for_turn_impl(
            callback_context,
            agent_name=agent_name,
            llm_request=llm_request,
        )
    except Exception:
        logger.exception(
            "conversational before_model failed agent=%s",
            agent_name,
        )
        try:
            user_query = resolve_user_query_for_turn(
                callback_context, llm_request=llm_request
            )
            if user_query and is_greeting_like(normalize_user_query(user_query)):
                return _fail_closed_canned_greeting(callback_context.state)
        except Exception:
            logger.exception("conversational fail-closed fallback failed")
        return None


def _conversational_before_tool_impl(
    tool: BaseTool,
    args: Dict[str, Any],
    tool_context: ToolContext,
    **kwargs: Any,
) -> Optional[dict]:
    _ = kwargs
    tool_name = getattr(tool, "name", None) or type(tool).__name__

    if tool_name == "transfer_to_agent":
        agent_name = (args or {}).get("agent_name")
        uq = resolve_user_query_for_turn(tool_context)
        if agent_name == "checkpoint_progress_agent":
            if not requests_optional_analysis_from_resolved(
                tool_context.state, user_query=uq
            ):
                logger.info(
                    "before_tool: blocked checkpoint_progress (retrieval-only query)"
                )
                return dict(_CONVERSATIONAL_TOOL_RESULT)

    resolved = resolved_turn_from_state(tool_context.state)
    if resolved is not None and resolved.is_casual:
        if tool_name in _BLOCKED_DOCULINK_TOOLS:
            logger.info("conversational before_tool: blocked tool=%s (resolved casual)", tool_name)
            return dict(_CONVERSATIONAL_TOOL_RESULT)
        if tool_name == "transfer_to_agent":
            agent_name = (args or {}).get("agent_name")
            if agent_name == "checkpoint_progress_agent":
                logger.info(
                    "conversational before_tool: blocked transfer_to_agent=%s",
                    agent_name,
                )
                return dict(_CONVERSATIONAL_TOOL_RESULT)

    if not tool_context.state.get(CONVERSATIONAL_TURN_STATE_KEY):
        return None

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


def conversational_before_tool(
    tool: BaseTool,
    args: Dict[str, Any],
    tool_context: ToolContext,
    **kwargs: Any,
) -> Optional[dict]:
    try:
        return _conversational_before_tool_impl(tool, args, tool_context, **kwargs)
    except Exception:
        logger.exception("conversational before_tool failed tool=%s", getattr(tool, "name", tool))
        try:
            uq = resolve_user_query_for_turn(tool_context)
            events = _session_events(tool_context)
            inv_id = _invocation_id(tool_context)
            if should_skip_tools(
                uq,
                session_events=events,
                current_invocation_id=inv_id,
                state=tool_context.state,
            ):
                return dict(_CONVERSATIONAL_TOOL_RESULT)
        except Exception:
            logger.exception("conversational before_tool fail-closed failed")
        return None


def mark_checkpoint_response_kind(
    callback_context: CallbackContext,
    *,
    kind: str,
) -> None:
    callback_context.state[CHECKPOINT_LAST_RESPONSE_KIND_KEY] = kind
