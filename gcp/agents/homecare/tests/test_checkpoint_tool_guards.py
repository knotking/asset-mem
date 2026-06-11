"""Tests for checkpoint tool-boundary guards (Phase 3)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from agent_framework.routing.resolved_turn import RESOLVED_TURN_STATE_KEY

from property_agent.checkpoint.constants import (
    CHECKPOINT_ANALYSIS_TOOL,
    CHECKPOINT_EXPLICIT_BRANCHES_KEY,
)
from property_agent.checkpoint.session_input import apply_session_checkpoint_ids_to_tool_args
from property_agent.checkpoint.tool_guards import (
    block_checkpoint_tools_in_report_mode,
    prepare_analyze_checkpoints_tool,
    strip_dangling_pending_offer_branches,
    user_requested_branches,
)
from property_agent.routing.pending_user_action import PENDING_USER_ACTION_KEY


def _state_with_pending_cost(*, user_query: str, discourse_act: str = "new_work") -> dict:
    return {
        "user_query": user_query,
        PENDING_USER_ACTION_KEY: {
            "kind": "run_branch",
            "expanded_user_query": "Run cost analysis",
            "run_optional_agents": ["cost"],
            "offered_summary": "Offered cost analysis.",
        },
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": user_query,
            "retrieval_only": False,
            "run_optional_agents": ["cost"],
            "user_goal": "new_analysis",
            "discourse_act": discourse_act,
            "resolve_source": "llm",
        },
    }


def test_strip_dangling_pending_offer_on_plain_question() -> None:
    state = _state_with_pending_cost(
        user_query="Is there any issue with my car based on the selected checkpoints?"
    )
    out = strip_dangling_pending_offer_branches(
        ["cost"], user_query=state["user_query"], state=state
    )
    assert out == []


def test_strip_keeps_branch_when_user_mentions_cost() -> None:
    state = _state_with_pending_cost(user_query="how about cost?")
    out = strip_dangling_pending_offer_branches(
        ["cost"], user_query=state["user_query"], state=state
    )
    assert out == ["cost"]


def test_strip_keeps_branch_on_accept_offer() -> None:
    state = _state_with_pending_cost(user_query="yes", discourse_act="accept_offer")
    out = strip_dangling_pending_offer_branches(
        ["cost"], user_query=state["user_query"], state=state
    )
    assert out == ["cost"]


def test_strip_keeps_branch_on_chip_resolve() -> None:
    state = {
        "user_query": "Run cost analysis and compare DIY vs professional",
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "Run cost analysis and compare DIY vs professional",
            "retrieval_only": False,
            "run_optional_agents": ["cost"],
            "user_goal": "new_analysis",
            "discourse_act": "new_work",
            "resolve_source": "chip",
        },
    }
    out = strip_dangling_pending_offer_branches(
        ["cost"], user_query=state["user_query"], state=state
    )
    assert out == ["cost"]


def test_apply_session_checkpoint_ids_drops_executor_invented_ids() -> None:
    state = {"checkpoint_ids": ["real-id-1"]}
    args = {"checkpoint_ids": ["garage", "real-id-1"]}
    apply_session_checkpoint_ids_to_tool_args(state, args)
    assert args["checkpoint_ids"] == ["real-id-1"]


def test_prepare_analyze_dedupes_and_syncs_branches() -> None:
    state: dict = {"checkpoint_ids": ["cp-1"]}
    args = {"branches": ["diy", "diy", "cost"], "checkpoint_ids": ["bogus"]}
    result = prepare_analyze_checkpoints_tool(
        state,
        args,
        user_query="Run DIY and cost analysis",
    )
    assert result is None
    assert args["branches"] == ["diy", "cost"]
    assert state["checkpoint_optional_agents"] == ["diy", "cost"]
    assert state[CHECKPOINT_EXPLICIT_BRANCHES_KEY] is True
    assert args["checkpoint_ids"] == ["cp-1"]


def test_prepare_analyze_short_circuits_completed_branches() -> None:
    state = {
        "user_query": "Summarize the issues for the selected checkpoint",
        "checkpoint_analysis": {
            "analysisStatus": {"cost": "completed"},
            "costEstimationResults": {"costEstimates": {"DIY": {"cost_range": "$50"}}},
        },
    }
    args = {"branches": ["cost"]}
    result = prepare_analyze_checkpoints_tool(
        state,
        args,
        user_query=state["user_query"],
    )
    assert result is not None
    assert "already completed" in result["result"]


def test_report_mode_blocks_analyze_checkpoints() -> None:
    state = {
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "report",
            "expanded_user_query": "run cost",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
        }
    }
    blocked = block_checkpoint_tools_in_report_mode(
        CHECKPOINT_ANALYSIS_TOOL, state, user_query="run cost"
    )
    assert blocked is not None
    assert "report mode" in blocked["result"].lower()


def test_user_requested_branches_from_query() -> None:
    requested = user_requested_branches("run cost and diy analysis", None)
    assert "cost" in requested
    assert "diy" in requested


def test_conversational_callback_uses_tool_guards_report_block() -> None:
    from property_agent.routing.conversational_callbacks import conversational_before_tool

    tool = SimpleNamespace(name=CHECKPOINT_ANALYSIS_TOOL)
    tool_context = MagicMock()
    tool_context.state = {
        "user_query": "yes do cost analysis",
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "report",
            "expanded_user_query": "Yes, please run a cost analysis.",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "discourse_act": "accept_offer",
        },
    }
    result = conversational_before_tool(tool, {}, tool_context)
    assert result is not None
    assert "report mode" in result.get("result", "").lower()
