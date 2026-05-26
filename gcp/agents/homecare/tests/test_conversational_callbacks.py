"""Tests for conversational ADK tool blocking."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from google.genai import types

from property_agent.conversational_callbacks import (
    _state_take,
    conversational_before_tool,
    fail_closed_before_model_on_resolve_error,
)
from property_agent.conversational_intent import CONVERSATIONAL_TURN_STATE_KEY


def test_state_take_works_without_pop() -> None:
    class _NoPopState(dict):
        def pop(self, *args, **kwargs):
            raise AttributeError("'State' object has no attribute 'pop'")

    state = _NoPopState(_saved_checkpoint_optional_agents=["coverage"])
    assert _state_take(state, "_saved_checkpoint_optional_agents") == ["coverage"]
    assert state["_saved_checkpoint_optional_agents"] is None


def test_before_tool_blocks_checkpoint_agent_when_conversational() -> None:
    tool = SimpleNamespace(name="checkpoint_agent")
    tool_context = MagicMock()
    tool_context.state = {CONVERSATIONAL_TURN_STATE_KEY: True}

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is not None
    assert "Skipped" in result.get("result", "")


def test_before_tool_blocks_checkpoint_progress_when_retrieval_only() -> None:
    tool = SimpleNamespace(name="transfer_to_agent")
    tool_context = MagicMock()
    tool_context.state = {
        "resolved_turn": {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "show latest kitchen inspection notes",
            "retrieval_only": True,
            "run_optional_agents": [],
        }
    }
    args = {"agent_name": "checkpoint_progress_agent"}

    result = conversational_before_tool(tool, args, tool_context)

    assert result is not None


def test_before_tool_blocks_when_resolved_casual() -> None:
    tool = SimpleNamespace(name="ask_user_docs_agent")
    tool_context = MagicMock()
    tool_context.state = {
        "resolved_turn": {
            "intent": "greeting",
            "route": "none",
            "expanded_user_query": "hello",
            "retrieval_only": False,
            "run_optional_agents": [],
        }
    }

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is not None


def test_fail_closed_greeting_on_resolve_error() -> None:
    ctx = MagicMock()
    ctx.state = {
        "user_query": "hello",
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
    }
    ctx._invocation_context = SimpleNamespace(
        invocation_id="inv-1",
        session=SimpleNamespace(events=[]),
    )
    llm_request = SimpleNamespace(
        config=types.GenerateContentConfig(),
        tools_dict={},
    )

    response = fail_closed_before_model_on_resolve_error(
        ctx, llm_request=llm_request
    )

    assert response is not None
    text = response.content.parts[0].text
    assert "1982 Helena Way" in text
    assert "Maintenance checkpoints" in text
    assert ctx.state.get(CONVERSATIONAL_TURN_STATE_KEY) is True


def test_fail_closed_skips_substantive_query() -> None:
    ctx = MagicMock()
    ctx.state = {
        "user_query": "show me kitchen inspection notes",
    }
    ctx._invocation_context = SimpleNamespace(
        invocation_id="inv-1",
        session=SimpleNamespace(events=[]),
    )

    response = fail_closed_before_model_on_resolve_error(ctx)

    assert response is None
