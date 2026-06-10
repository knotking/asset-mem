"""Tests for resolve_turn state apply and inject."""

from __future__ import annotations

import json
from types import SimpleNamespace

from google.genai import types

from property_agent.routing.conversational_intent import CONVERSATIONAL_TURN_STATE_KEY
from property_agent.routing.query_mode import SESSION_WORKING_MEMORY_SNAPSHOT_KEY
from property_agent.routing.resolve_turn import (
    RESOLVED_TURN_STATE_KEY,
    ResolvedTurn,
    _should_inject_session_working_memory,
    apply_resolved_turn_to_state,
    format_resolved_turn_block,
    format_resolved_turn_block_with_memory,
    inject_resolved_turn_into_llm_request,
    is_executor_conversational_turn,
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


def test_apply_resolved_preserves_stash_on_answer_from_context() -> None:
    analysis = {
        "title": "Analysis",
        "checkpointSummary": {"overallCondition": "damaged", "checkpointsAnalyzed": 2},
    }
    state = {
        "checkpoint_analysis": analysis,
        "checkpoint_result": "stale",
        "checkpoint_parallel_results": {"coverage": {}},
    }
    apply_resolved_turn_to_state(
        state,
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="What is wrong overall?",
            retrieval_only=True,
            run_optional_agents=[],
            user_goal="answer_from_context",
        ),
    )
    assert state["checkpoint_analysis"] == analysis
    assert state.get("session_working_memory_snapshot") is not None


def test_apply_resolved_clears_checkpoint_stash_on_retrieval_only_non_context() -> None:
    state = {
        "checkpoint_analysis": {"title": "Old"},
        "checkpoint_result": "stale",
    }
    apply_resolved_turn_to_state(
        state,
        ResolvedTurn(
            intent="substantive",
            route="user_docs",
            expanded_user_query="What does my lease say?",
            retrieval_only=True,
            run_optional_agents=[],
            user_goal="answer_from_context",
        ),
    )
    assert state["checkpoint_analysis"] is None


def test_accept_offer_route_none_with_service_not_conversational() -> None:
    state = {"checkpoint_optional_agents": ["coverage", "diy", "service", "cost"]}
    resolved = ResolvedTurn(
        intent="substantive",
        route="none",
        expanded_user_query="Yes, find local service providers for the garage door repair.",
        retrieval_only=False,
        run_optional_agents=["service"],
        user_goal="new_analysis",
        discourse_act="accept_offer",
        query_mode="branch_explicit",
    )
    assert is_executor_conversational_turn(resolved) is False
    apply_resolved_turn_to_state(state, resolved)
    assert state.get(CONVERSATIONAL_TURN_STATE_KEY) is False
    assert state["checkpoint_optional_agents"] == ["service"]


def test_explain_prior_route_none_stays_conversational() -> None:
    state: dict = {}
    resolved = ResolvedTurn(
        intent="substantive",
        route="none",
        expanded_user_query="Why is professional service so expensive?",
        retrieval_only=True,
        run_optional_agents=[],
        user_goal="answer_from_context",
        discourse_act="explain_prior",
        focus_branch="cost",
    )
    assert is_executor_conversational_turn(resolved) is True
    apply_resolved_turn_to_state(state, resolved)
    assert state.get(CONVERSATIONAL_TURN_STATE_KEY) is True
    assert state["checkpoint_optional_agents"] == []


def test_report_route_substantive_allows_tools() -> None:
    resolved = ResolvedTurn(
        intent="substantive",
        route="report",
        expanded_user_query="Summarize the saved property report.",
        retrieval_only=True,
        run_optional_agents=[],
        user_goal="answer_from_context",
        discourse_act="replay_report",
    )
    assert is_executor_conversational_turn(resolved) is False
    state: dict = {}
    apply_resolved_turn_to_state(state, resolved)
    assert state.get(CONVERSATIONAL_TURN_STATE_KEY) is False


def test_answer_from_context_thin_memory_not_conversational() -> None:
    inventory = ResolvedTurn(
        intent="substantive",
        route="checkpoint",
        expanded_user_query="What checkpoints do I have and what is their current status?",
        retrieval_only=True,
        run_optional_agents=[],
        user_goal="answer_from_context",
        discourse_act="new_work",
        query_mode="interpret_session",
    )
    thin_state = {
        "property_id": "prop-1",
        "session_working_memory_snapshot": {"property_id": "prop-1"},
    }
    assert is_executor_conversational_turn(inventory, state=thin_state) is False

    rich_state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "checkpoint_summary": {"locations": ["Garage"], "checkpointsAnalyzed": 1},
        }
    }
    follow_up = ResolvedTurn(
        intent="substantive",
        route="checkpoint",
        expanded_user_query="Are there issues in the garage?",
        retrieval_only=True,
        run_optional_agents=[],
        user_goal="answer_from_context",
        discourse_act="explain_prior",
        query_mode="interpret_session",
    )
    assert is_executor_conversational_turn(follow_up, state=rich_state) is True
    assert is_executor_conversational_turn(inventory, state=rich_state) is False


def test_apply_resolved_cold_session_inventory_enables_tools() -> None:
    state = {"property_id": "prop-1", "checkpoint_optional_agents": ["cost"]}
    apply_resolved_turn_to_state(
        state,
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="What checkpoints do I have and what is their current status?",
            retrieval_only=True,
            run_optional_agents=[],
            user_goal="answer_from_context",
            discourse_act="new_work",
        ),
    )
    assert state.get(CONVERSATIONAL_TURN_STATE_KEY) is False


def test_greeting_route_none_stays_conversational() -> None:
    resolved = ResolvedTurn(
        intent="greeting",
        route="none",
        expanded_user_query="hello",
        retrieval_only=True,
        discourse_act="greeting",
    )
    assert is_executor_conversational_turn(resolved) is True


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


def test_apply_resolved_preserves_stash_when_optional_misroutes_provider_follow_up() -> (
    None
):
    state = {
        "checkpoint_parallel_results": json.dumps(
            {
                "checkpoint_parallel_service_result": json.dumps(
                    {
                        "serviceResults": {
                            "localPros": {
                                "serpAPIResults": [
                                    {
                                        "name": "Bay Area Garage Door Repair Brentwood",
                                        "contact": "(925) 234-4255",
                                    }
                                ]
                            }
                        }
                    }
                )
            }
        ),
        "checkpoint_analysis": {"title": "Garage", "serviceResults": {}},
        "checkpoint_optional_agents": ["coverage", "diy", "service", "cost"],
        "user_query": "get me more details on Bay Area Garage Door Repair",
    }
    apply_resolved_turn_to_state(
        state,
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="get me more details on Bay Area Garage Door Repair",
            retrieval_only=False,
            run_optional_agents=["service"],
            user_goal="new_analysis",
        ),
    )
    assert state["checkpoint_analysis"]["title"] == "Garage"
    assert state["checkpoint_optional_agents"] == []


def test_apply_resolved_clears_stale_analysis_on_new_optional_run() -> None:
    state = {
        "checkpoint_analysis": {"title": "Full report"},
        "checkpoint_parallel_results": '{"checkpoint_parallel_service_result": "ok"}',
        "checkpoint_optional_agents": ["coverage", "diy", "service", "cost"],
    }
    apply_resolved_turn_to_state(
        state,
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="list professional service options",
            retrieval_only=False,
            run_optional_agents=["service"],
            user_goal="new_analysis",
        ),
    )
    assert state["checkpoint_optional_agents"] == ["service"]
    assert state["checkpoint_analysis"] is None
    assert state["checkpoint_parallel_results"] is None


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


def test_format_resolved_turn_block_injects_working_memory_when_snapshot() -> None:
    from property_agent.routing.query_mode import SESSION_WORKING_MEMORY_SNAPSHOT_KEY

    block = format_resolved_turn_block(
        ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query="tell me about Hetcho",
            retrieval_only=True,
            user_goal="answer_from_context",
            query_mode="interpret_session",
        ),
        state={
            SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
                "service_providers_mentioned": ["Hetcho Services"],
            }
        },
    )
    assert "[SESSION_WORKING_MEMORY]" in block
    assert "Hetcho" in block


def test_report_route_skips_session_working_memory() -> None:
    resolved = ResolvedTurn(
        intent="substantive",
        route="report",
        expanded_user_query="summarize the report",
        retrieval_only=True,
        user_goal="answer_from_context",
        query_mode="interpret_session",
    )
    state = {
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "checkpoint_summary": {"locations": ["Roof"], "checkpointsAnalyzed": 3},
        }
    }
    assert _should_inject_session_working_memory(resolved, state) is False


def test_format_resolved_turn_block_injects_report_mode_note() -> None:
    block = format_resolved_turn_block_with_memory(
        ResolvedTurn(
            intent="substantive",
            route="report",
            expanded_user_query="summarize the report",
            retrieval_only=True,
            user_goal="answer_from_context",
        ),
        state={
            SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
                "checkpoint_summary": {"locations": ["Roof"], "checkpointsAnalyzed": 3},
            }
        },
    )
    assert "[REPORT_MODE]" in block
    assert "do not invent roofing" in block.lower()
    assert "do not invent report sections" in block.lower()
    assert "never offer to run cost" in block.lower()
    assert "[SESSION_WORKING_MEMORY]" not in block
