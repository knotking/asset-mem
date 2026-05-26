"""Tests for conversational ADK tool blocking."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from google.genai import types

from property_agent.conversational_callbacks import (
    CONVERSATIONAL_TURN_STATE_KEY,
    _state_take,
    apply_conversational_state_for_turn,
    conversational_before_tool,
)
def test_state_take_works_without_pop() -> None:
    class _NoPopState(dict):
        def pop(self, *args, **kwargs):
            raise AttributeError("'State' object has no attribute 'pop'")

    state = _NoPopState(_saved_checkpoint_optional_agents=["coverage"])
    assert _state_take(state, "_saved_checkpoint_optional_agents") == ["coverage"]
    assert state["_saved_checkpoint_optional_agents"] is None


def test_substantive_turn_after_conversational_does_not_pop() -> None:
    class _NoPopState(dict):
        def pop(self, *args, **kwargs):
            raise AttributeError("'State' object has no attribute 'pop'")

    part = SimpleNamespace(
        text=(
            '{ "user_query": "Can you show me the latest inspection notes for the kitchen?", '
            '"checkpoint_optional_agents": ["coverage", "diy", "service", "cost"], '
            '"property_id": "nY3XQ92eUa02Qs14QWEn" }'
        )
    )
    event = SimpleNamespace(
        invocation_id="inv-2",
        author="user",
        content=SimpleNamespace(parts=[part]),
    )
    ctx = MagicMock()
    ctx.state = _NoPopState(
        user_query="I don't know. What do you suggest",
        conversational_turn=True,
        _saved_checkpoint_optional_agents=["coverage"],
        checkpoint_optional_agents=[],
    )
    ctx._invocation_context = SimpleNamespace(
        invocation_id="inv-2",
        session=SimpleNamespace(events=[event]),
    )
    llm_request = SimpleNamespace(
        config=types.GenerateContentConfig(),
        tools_dict={},
    )

    response = apply_conversational_state_for_turn(
        ctx, agent_name="property_agent", llm_request=llm_request
    )

    assert response is None
    assert ctx.state.get(CONVERSATIONAL_TURN_STATE_KEY) is False
    assert "kitchen" in ctx.state.get("user_query", "")


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
    tool_context._invocation_context = SimpleNamespace(
        invocation_id="inv-1",
        session=SimpleNamespace(events=[]),
    )
    args = {"agent_name": "checkpoint_progress_agent"}

    result = conversational_before_tool(tool, args, tool_context)

    assert result is not None


def test_apply_conversational_returns_canned_for_hello() -> None:
    ctx = MagicMock()
    ctx.state = {
        "user_query": "hello",
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
    }
    ctx._invocation_context = SimpleNamespace(
        invocation_id="inv-1",
        session=SimpleNamespace(events=[]),
    )
    tools_dict = {"transfer_to_agent": object()}
    llm_request = SimpleNamespace(
        config=types.GenerateContentConfig(),
        tools_dict=dict(tools_dict),
    )

    response = apply_conversational_state_for_turn(
        ctx, agent_name="property_agent", llm_request=llm_request
    )

    assert response is not None
    text = response.content.parts[0].text
    assert "1982 Helena Way" in text
    assert "Maintenance checkpoints" in text
    assert ctx.state.get(CONVERSATIONAL_TURN_STATE_KEY) is True
    assert ctx.state.get("checkpoint_optional_agents") == []
    assert llm_request.tools_dict == tools_dict
    assert not getattr(llm_request.config, "system_instruction", None) or (
        not llm_request.config.system_instruction
    )


def test_apply_conversational_hydrates_from_event_when_state_empty() -> None:
    part = SimpleNamespace(
        text=(
            '{ "user_query": "Hello. Good morning", '
            '"property_address": "1982 Helena Way, Brentwood, CA 94513" }'
        )
    )
    event = SimpleNamespace(
        invocation_id="inv-2",
        author="user",
        content=SimpleNamespace(parts=[part]),
    )
    ctx = MagicMock()
    ctx.state = {}
    ctx._invocation_context = SimpleNamespace(
        invocation_id="inv-2",
        session=SimpleNamespace(events=[event]),
    )

    llm_request = SimpleNamespace(
        config=types.GenerateContentConfig(),
        tools_dict={},
    )
    response = apply_conversational_state_for_turn(
        ctx, agent_name="property_agent", llm_request=llm_request
    )

    assert response is not None
    text = response.content.parts[0].text
    assert "Maintenance checkpoints" in text
    assert ctx.state.get("user_query") == "Hello. Good morning"
    assert ctx.state.get(CONVERSATIONAL_TURN_STATE_KEY) is True


def test_apply_conversational_expands_second_one_on_substantive_turn() -> None:
    ctx = MagicMock()
    ctx.state = {
        "last_offered_options": [
            "checkpoints",
            "documents",
            "coverage",
            "diy",
            "service",
            "cost",
        ],
        "user_query": "second one",
        "checkpoint_optional_agents": ["coverage"],
    }
    ctx._invocation_context = SimpleNamespace(
        invocation_id="inv-3",
        session=SimpleNamespace(events=[]),
    )
    llm_request = SimpleNamespace(
        config=types.GenerateContentConfig(),
        tools_dict={},
    )

    response = apply_conversational_state_for_turn(
        ctx, agent_name="property_agent", llm_request=llm_request
    )

    assert response is None
    assert ctx.state.get(CONVERSATIONAL_TURN_STATE_KEY) is False
    assert "uploaded property documents" in ctx.state["user_query"].lower()

