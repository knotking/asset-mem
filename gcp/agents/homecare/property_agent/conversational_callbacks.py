"""ADK callbacks for conversational tool blocking (resolve_turn sets casual state)."""

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
    is_greeting_like,
    normalize_user_query,
    resolve_property_address_from_state,
    resolve_user_query_for_turn,
    resolve_user_query_from_state,
)
from .query_mode import (
    format_provider_context_answer,
    should_block_checkpoint_agent_for_context_turn,
)
from .resolve_turn import (
    requests_optional_analysis_from_resolved,
    resolved_turn_from_state,
)

logger = logging.getLogger(__name__)

_BLOCKED_ROUTING_TOOLS_ON_CASUAL = frozenset(
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


def _plain_llm_response(text: str) -> LlmResponse:
    return LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text=text)]),
    )


def _fail_closed_canned_greeting(state: Any) -> LlmResponse:
    """Safe canned reply when resolve fails on a greeting-shaped turn."""
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


def fail_closed_before_model_on_resolve_error(
    callback_context: Context,
    *,
    llm_request: Any = None,
) -> Optional[LlmResponse]:
    """When resolve fails, only short-circuit obvious greetings."""
    try:
        user_query = resolve_user_query_for_turn(callback_context, llm_request=llm_request)
        if user_query and is_greeting_like(normalize_user_query(user_query)):
            return _fail_closed_canned_greeting(callback_context.state)
    except Exception:
        logger.exception("fail_closed_before_model_on_resolve_error failed")
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
        if agent_name == "checkpoint_progress_agent":
            if not requests_optional_analysis_from_resolved(tool_context.state):
                logger.info(
                    "before_tool: blocked checkpoint_progress (retrieval-only query)"
                )
                return dict(_CONVERSATIONAL_TOOL_RESULT)

    resolved = resolved_turn_from_state(tool_context.state)
    user_query = resolve_user_query_from_state(tool_context.state) or str(
        (args or {}).get("user_query") or ""
    )
    if (
        tool_name == "checkpoint_agent"
        and resolved is not None
        and should_block_checkpoint_agent_for_context_turn(
            user_query=user_query,
            state=tool_context.state,
            user_goal=str(resolved.user_goal or ""),
            query_mode=str(resolved.query_mode or ""),
        )
    ):
        answer = format_provider_context_answer(user_query, tool_context.state)
        logger.info(
            "before_tool: blocked checkpoint_agent (context-only) query=%r",
            user_query[:80],
        )
        return {
            "result": answer
            or (
                "Answer from [SESSION_WORKING_MEMORY] and prior messages in this "
                "conversation. Do not call checkpoint tools again for this turn."
            )
        }

    if resolved is not None and resolved.is_casual:
        if tool_name in _BLOCKED_ROUTING_TOOLS_ON_CASUAL:
            logger.info(
                "conversational before_tool: blocked tool=%s (resolved casual)",
                tool_name,
            )
            return dict(_CONVERSATIONAL_TOOL_RESULT)
        if tool_name == "transfer_to_agent":
            agent_name = (args or {}).get("agent_name")
            if agent_name == "checkpoint_progress_agent":
                logger.info(
                    "conversational before_tool: blocked transfer_to_agent=%s",
                    agent_name,
                )
                return dict(_CONVERSATIONAL_TOOL_RESULT)

    if tool_context.state.get(CONVERSATIONAL_TURN_STATE_KEY):
        if tool_name in _BLOCKED_ROUTING_TOOLS_ON_CASUAL:
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
        logger.exception(
            "conversational before_tool failed tool=%s", getattr(tool, "name", tool)
        )
        resolved = resolved_turn_from_state(tool_context.state)
        if resolved is not None and resolved.is_casual:
            return dict(_CONVERSATIONAL_TOOL_RESULT)
        if tool_context.state.get(CONVERSATIONAL_TURN_STATE_KEY):
            return dict(_CONVERSATIONAL_TOOL_RESULT)
        return None


def mark_checkpoint_response_kind(
    callback_context: CallbackContext,
    *,
    kind: str,
) -> None:
    callback_context.state[CHECKPOINT_LAST_RESPONSE_KIND_KEY] = kind
