"""ADK callbacks for conversational tool blocking (resolve_turn sets casual state)."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.context import Context
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import BaseTool, ToolContext
from agent_framework.routing.tool_guards import (
    block_tools_on_flag,
    fail_closed_on_resolve_error,
)
from agent_framework.runtime.llm_short_circuit import plain_text_llm_response

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
    should_answer_provider_from_context,
    should_block_checkpoint_pipeline_for_context_turn,
)
from .resolve_turn import resolved_turn_from_state

logger = logging.getLogger(__name__)

_BLOCKED_ROUTING_TOOLS_ON_CASUAL = frozenset(
    {
        "run_checkpoint_pipeline",
        "user_docs_retrieval",
        "knowledge_base_retrieval",
    }
)

_CONTEXT_ONLY_BLOCKED_TOOLS = _BLOCKED_ROUTING_TOOLS_ON_CASUAL

_CONTEXT_ONLY_FALLBACK = (
    "Answer from [SESSION_WORKING_MEMORY] and prior messages in this "
    "conversation. Do not call checkpoint or retrieval tools again for this turn."
)

_CONVERSATIONAL_TOOL_RESULT = (
    "Skipped: conversational turn — respond in plain text only."
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
    return plain_text_llm_response(text)


def fail_closed_before_model_on_resolve_error(
    callback_context: Context,
    *,
    llm_request: Any = None,
) -> Optional[LlmResponse]:
    """When resolve fails, only short-circuit obvious greetings."""
    return fail_closed_on_resolve_error(
        callback_context,
        llm_request=llm_request,
        resolve_user_query=resolve_user_query_for_turn,
        is_greeting_fn=is_greeting_like,
        normalize_query_fn=normalize_user_query,
        build_greeting_fn=lambda ctx: _fail_closed_canned_greeting(ctx.state),
    )


def _conversational_before_tool_impl(
    tool: BaseTool,
    args: Dict[str, Any],
    tool_context: ToolContext,
    **kwargs: Any,
) -> Optional[dict]:
    _ = kwargs
    tool_name = getattr(tool, "name", None) or type(tool).__name__

    resolved = resolved_turn_from_state(tool_context.state)
    user_query = resolve_user_query_from_state(tool_context.state) or str(
        (args or {}).get("user_query") or ""
    )
    if (
        tool_name in _CONTEXT_ONLY_BLOCKED_TOOLS
        and resolved is not None
        and should_block_checkpoint_pipeline_for_context_turn(
            user_query=user_query,
            state=tool_context.state,
            user_goal=str(resolved.user_goal or ""),
            query_mode=str(resolved.query_mode or ""),
            resolved_route=str(resolved.route or ""),
            tool_name=tool_name,
        )
    ):
        answer: str | None = None
        if should_answer_provider_from_context(user_query, state=tool_context.state):
            answer = format_provider_context_answer(user_query, tool_context.state)
        logger.info(
            "before_tool: blocked %s (context-only) query=%r",
            tool_name,
            user_query[:80],
        )
        return {"result": answer or _CONTEXT_ONLY_FALLBACK}

    casual = resolved is not None and resolved.is_casual
    blocked = block_tools_on_flag(
        tool_context.state,
        flag_key=CONVERSATIONAL_TURN_STATE_KEY,
        blocked_tool_names=_BLOCKED_ROUTING_TOOLS_ON_CASUAL,
        result_message=_CONVERSATIONAL_TOOL_RESULT,
        tool_name=tool_name,
        resolved_casual=casual,
    )
    if blocked is not None:
        return blocked

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
            return {"result": _CONVERSATIONAL_TOOL_RESULT}
        if tool_context.state.get(CONVERSATIONAL_TURN_STATE_KEY):
            return {"result": _CONVERSATIONAL_TOOL_RESULT}
        return None


def mark_checkpoint_response_kind(
    callback_context: CallbackContext,
    *,
    kind: str,
) -> None:
    callback_context.state[CHECKPOINT_LAST_RESPONSE_KIND_KEY] = kind
