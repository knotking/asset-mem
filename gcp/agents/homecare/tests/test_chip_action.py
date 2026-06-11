"""Tests for the chip fast-path (deterministic ResolvedTurn, single-loop pre-routing)."""

from __future__ import annotations

from property_agent.routing.chip_action import (
    CHIP_ACTION_STATE_KEY,
    ChipAction,
    parse_chip_action,
    resolve_turn_from_chip,
    resolved_turn_from_chip_action,
    take_chip_action,
)
from property_agent.routing.pending_user_action import (
    PENDING_USER_ACTION_KEY,
    get_pending_user_action,
)


def test_parse_run_branch_valid() -> None:
    action = parse_chip_action({"type": "run_branch", "branch": "cost"})
    assert action == ChipAction(type="run_branch", branch="cost")


def test_parse_rejects_invalid_branch_and_type() -> None:
    assert parse_chip_action({"type": "run_branch", "branch": "bogus"}) is None
    assert parse_chip_action({"type": "self_destruct"}) is None
    assert parse_chip_action("run_branch") is None
    assert parse_chip_action(None) is None


def test_parse_discuss_drops_unknown_topic() -> None:
    action = parse_chip_action({"type": "discuss", "topic": "weather"})
    assert action is not None and action.topic is None
    action = parse_chip_action({"type": "discuss", "topic": "cost"})
    assert action is not None and action.topic == "cost"


def test_run_branch_resolved_turn_fields() -> None:
    resolved = resolved_turn_from_chip_action(
        ChipAction(type="run_branch", branch="diy"),
        user_query="What are the DIY steps for this repair?",
    )
    assert resolved.resolve_source == "chip"
    assert resolved.intent == "substantive"
    assert resolved.route == "checkpoint"
    assert resolved.retrieval_only is False
    assert resolved.run_optional_agents == ["diy"]
    assert resolved.user_goal == "new_analysis"
    assert resolved.query_mode == "branch_explicit"
    assert resolved.discourse_act == "new_work"
    assert resolved.focus_branch == "diy"
    assert resolved.expanded_user_query == "What are the DIY steps for this repair?"


def test_discuss_resolved_turn_fields() -> None:
    resolved = resolved_turn_from_chip_action(
        ChipAction(type="discuss", topic="cost"),
        user_query="Why is professional repair so expensive compared to DIY?",
    )
    assert resolved.resolve_source == "chip"
    assert resolved.retrieval_only is True
    assert resolved.run_optional_agents == []
    assert resolved.user_goal == "answer_from_context"
    assert resolved.discourse_act == "explain_prior"
    assert resolved.focus_branch == "cost"


def test_replay_resolved_turn_fields() -> None:
    resolved = resolved_turn_from_chip_action(
        ChipAction(type="replay_analysis"),
        user_query="Show me the full analysis again",
    )
    assert resolved.resolve_source == "chip"
    assert resolved.retrieval_only is True
    assert resolved.run_optional_agents == []
    assert resolved.user_goal == "replay_deliverable"
    assert resolved.discourse_act == "replay_analysis"


def test_take_chip_action_consumes_state() -> None:
    state: dict = {CHIP_ACTION_STATE_KEY: {"type": "run_branch", "branch": "cost"}}
    action = take_chip_action(state)
    assert action is not None and action.branch == "cost"
    assert state[CHIP_ACTION_STATE_KEY] is None
    assert take_chip_action(state) is None


def test_resolve_turn_from_chip_clears_pending_offer() -> None:
    state: dict = {
        CHIP_ACTION_STATE_KEY: {"type": "run_branch", "branch": "service"},
        PENDING_USER_ACTION_KEY: {
            "kind": "run_branch",
            "expanded_user_query": "Run cost analysis",
            "run_optional_agents": ["cost"],
        },
    }
    resolved = resolve_turn_from_chip(
        state, user_query="Find local service providers for this repair"
    )
    assert resolved is not None
    assert resolved.run_optional_agents == ["service"]
    assert get_pending_user_action(state) is None


def test_resolve_turn_from_chip_none_without_action() -> None:
    assert resolve_turn_from_chip({}, user_query="hello") is None
    # Malformed action is consumed but falls through to the LLM path.
    state: dict = {CHIP_ACTION_STATE_KEY: {"type": "bogus"}}
    assert resolve_turn_from_chip(state, user_query="hello") is None
    assert state[CHIP_ACTION_STATE_KEY] is None
