"""Tests for resolve_turn state apply and inject."""

from __future__ import annotations

from types import SimpleNamespace

from google.genai import types

from property_agent.resolve_turn import (
    RESOLVED_TURN_STATE_KEY,
    ResolvedTurn,
    apply_resolved_turn_to_state,
    format_resolved_turn_block,
    inject_resolved_turn_into_llm_request,
)


def test_apply_resolved_clears_ui_optional_on_retrieval_only() -> None:
    state = {"checkpoint_optional_agents": ["coverage", "diy", "service", "cost"]}
    apply_resolved_turn_to_state(
        state,
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="show latest notes",
            retrieval_only=True,
            run_optional_agents=[],
        ),
    )
    assert state["checkpoint_optional_agents"] == []
    assert state[RESOLVED_TURN_STATE_KEY]["retrieval_only"] is True


def test_apply_resolved_sets_optional_branches() -> None:
    state = {"checkpoint_optional_agents": ["coverage", "diy", "service", "cost"]}
    apply_resolved_turn_to_state(
        state,
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="Estimate costs",
            retrieval_only=False,
            run_optional_agents=["cost"],
        ),
    )
    assert state["checkpoint_optional_agents"] == ["cost"]


def test_inject_resolved_turn_uses_string_system_instruction() -> None:
    llm_request = SimpleNamespace(config=types.GenerateContentConfig())
    inject_resolved_turn_into_llm_request(
        llm_request,
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="summarize checkpoints",
            retrieval_only=True,
        ),
    )
    assert isinstance(llm_request.config.system_instruction, str)
    assert "[RESOLVED_TURN]" in llm_request.config.system_instruction


def test_format_resolved_turn_block() -> None:
    block = format_resolved_turn_block(
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="q",
            retrieval_only=True,
        )
    )
    assert "[RESOLVED_TURN]" in block
    assert "ui_context_note" in block
