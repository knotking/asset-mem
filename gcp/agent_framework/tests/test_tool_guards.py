"""Tests for tool_guards helpers."""

from __future__ import annotations

from agent_framework.routing.tool_guards import block_tools_on_flag


def test_block_tools_on_flag() -> None:
    result = block_tools_on_flag(
        {"conversational_turn": True},
        flag_key="conversational_turn",
        blocked_tool_names=frozenset({"run_checkpoint_pipeline"}),
        result_message="blocked",
        tool_name="run_checkpoint_pipeline",
    )
    assert result == {"result": "blocked"}
