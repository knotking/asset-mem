"""Tests for PropertyHookRegistry."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from agent_platform.adk.context_bridge import (
    tool_call_context_from_adk,
    turn_context_from_adk_callback,
)
from agent_platform.core.ports import TurnOutcome

from property_agent.runtime.hook_registry import PropertyHookRegistry


def test_before_turn_maps_llm_response_to_turn_outcome() -> None:
    plugin = MagicMock()
    plugin.resolve_property_id.return_value = "prop-1"
    plugin.prepare_before_model_turn.return_value = SimpleNamespace(
        content=SimpleNamespace(parts=[SimpleNamespace(text="hello")])
    )
    hooks = PropertyHookRegistry(plugin=plugin)
    adk_ctx = SimpleNamespace(state={}, _invocation_context=SimpleNamespace(session=SimpleNamespace(events=[])))
    turn_ctx = turn_context_from_adk_callback(adk_ctx)

    outcome = hooks.before_turn(turn_ctx, llm_request=MagicMock())

    assert outcome == TurnOutcome.skip_executor("hello")


def test_before_tool_blocks_conversational_turn() -> None:
    plugin = MagicMock()
    hooks = PropertyHookRegistry(plugin=plugin)
    tool_context = SimpleNamespace(
        state={"conversational_turn": True},
        _invocation_context=SimpleNamespace(
            invocation_id="i1",
            session=SimpleNamespace(user_id="uid-1"),
        ),
    )
    ctx = tool_call_context_from_adk(tool_context)
    blocked = hooks.before_tool(ctx, "analyze_checkpoints", {"user_query": "hi"})
    assert blocked is not None
    assert "Skipped" in blocked["result"]
