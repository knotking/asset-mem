"""Tests for ADK-aligned state_delta merge and tool-context application."""

from types import SimpleNamespace

from property_agent.state_delta_merge import merge_state_delta
from property_agent.sub_agents.checkpoint_dual_format_guard import (
    apply_tool_context_state_delta,
)


def test_merge_state_delta_concatenates_lists():
    existing = {"checkpoint_optional_agents": ["coverage"]}
    incoming = {"checkpoint_optional_agents": ["diy"]}
    merged = merge_state_delta(existing, incoming)
    assert merged["checkpoint_optional_agents"] == ["coverage", "diy"]


def test_merge_state_delta_dedupes_repeated_checkpoint_optional_agents():
    branches = ["coverage", "diy", "service", "cost"]
    merged = merge_state_delta(
        {"checkpoint_optional_agents": list(branches)},
        {"checkpoint_optional_agents": list(branches)},
    )
    assert merged["checkpoint_optional_agents"] == branches


def test_merge_state_delta_deep_merges_nested_dicts():
    existing = {"meta": {"a": 1, "b": 2}}
    incoming = {"meta": {"b": 3, "c": 4}}
    merged = merge_state_delta(existing, incoming)
    assert merged["meta"] == {"a": 1, "b": 3, "c": 4}


def test_merge_state_delta_overwrites_scalar_keys():
    existing = {"checkpoint_results": "old"}
    incoming = {"checkpoint_results": "new"}
    merged = merge_state_delta(existing, incoming)
    assert merged["checkpoint_results"] == "new"


def test_apply_tool_context_state_delta_merges_actions():
    actions = SimpleNamespace(
        state_delta={"checkpoint_optional_agents": ["coverage", "diy", "service", "cost"]}
    )
    tool_context = SimpleNamespace(
        state={},
        actions=actions,
    )
    apply_tool_context_state_delta(
        tool_context,
        {
            "checkpoint_optional_agents": ["coverage", "diy", "service", "cost"],
            "checkpoint_results": "blob",
        },
    )
    assert tool_context.state["checkpoint_results"] == "blob"
    assert actions.state_delta["checkpoint_optional_agents"] == [
        "coverage",
        "diy",
        "service",
        "cost",
    ]
    assert actions.state_delta["checkpoint_results"] == "blob"
