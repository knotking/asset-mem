"""Tests for conversational ADK tool blocking."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from property_agent.conversational_callbacks import (
    CONVERSATIONAL_TURN_STATE_KEY,
    apply_conversational_state_for_turn,
    conversational_before_tool,
)


def test_before_tool_blocks_checkpoint_agent_when_conversational() -> None:
    tool = SimpleNamespace(name="checkpoint_agent")
    tool_context = MagicMock()
    tool_context.state = {CONVERSATIONAL_TURN_STATE_KEY: True}

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is not None
    assert "Skipped" in result.get("result", "")


def test_apply_conversational_returns_plain_response_for_hello() -> None:
    ctx = MagicMock()
    ctx.state = {
        "user_query": "hello",
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
    }
    ctx._invocation_context = SimpleNamespace(
        invocation_id="inv-1",
        session=SimpleNamespace(events=[]),
    )

    response = apply_conversational_state_for_turn(ctx, agent_name="property_agent")

    assert response is not None
    text = response.content.parts[0].text
    assert "Hello" in text
    assert "1982 Helena Way" in text
    assert ctx.state.get(CONVERSATIONAL_TURN_STATE_KEY) is True
