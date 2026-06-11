"""Tests for conversational ADK tool blocking."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from google.genai import types

from agent_framework.routing.resolved_turn import RESOLVED_TURN_STATE_KEY
from agent_framework.state.session_state import state_take

from property_agent.routing.conversational_callbacks import (
    conversational_before_tool,
    fail_closed_before_model_on_resolve_error,
)
from property_agent.routing.conversational_intent import CONVERSATIONAL_TURN_STATE_KEY
from property_agent.routing.query_mode import SESSION_WORKING_MEMORY_SNAPSHOT_KEY, snapshot_session_analysis_context


def _service_parallel_json(*names: str) -> str:
    serp = [{"name": n, "contact_info": "555-0100", "rating": 4.9} for n in names]
    inner = json.dumps(
        {
            "serviceResults": {
                "localPros": {"serpAPIResults": serp},
            }
        }
    )
    return json.dumps({"checkpoint_parallel_service_result": inner})


def _provider_follow_up_state(*, provider: str, user_query: str) -> dict:
    return {
        "user_query": user_query,
        "checkpoint_parallel_results": _service_parallel_json(provider),
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": user_query,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "query_mode": "interpret_session",
        },
    }


def test_state_take_works_without_pop() -> None:
    class _NoPopState(dict):
        def pop(self, *args, **kwargs):
            raise AttributeError("'State' object has no attribute 'pop'")

    state = _NoPopState(_saved_checkpoint_optional_agents=["coverage"])
    assert state_take(state, "_saved_checkpoint_optional_agents") == ["coverage"]
    assert state["_saved_checkpoint_optional_agents"] is None


def test_before_tool_allows_pipeline_on_cold_checkpoint_inventory_turn() -> None:
    tool = SimpleNamespace(name="analyze_checkpoints")
    tool_context = MagicMock()
    tool_context.state = {
        "user_query": "What checkpoints do I have and what is their current status?",
        "property_id": "prop-1",
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "What checkpoints do I have and what is their current status?",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "new_analysis",
            "query_mode": "interpret_session",
            "discourse_act": "new_work",
        },
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {"property_id": "prop-1"},
    }

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is None


def test_before_tool_blocks_analyze_checkpoints_when_conversational() -> None:
    tool = SimpleNamespace(name="analyze_checkpoints")
    tool_context = MagicMock()
    tool_context.state = {CONVERSATIONAL_TURN_STATE_KEY: True}

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is not None
    assert "Skipped" in result.get("result", "")


@pytest.mark.parametrize(
    "tool_name",
    [
        "user_docs_retrieval",
    ],
)
def test_before_tool_blocks_routing_tools_when_resolved_casual(tool_name: str) -> None:
    tool = SimpleNamespace(name=tool_name)
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


@pytest.mark.parametrize(
    "tool_name",
    [
        "analyze_checkpoints",
        "user_docs_retrieval",
    ],
)
def test_before_tool_blocks_context_tools_on_provider_follow_up(tool_name: str) -> None:
    provider = "Up Right Garage Door Repair"
    user_query = f"More details on {provider}"
    tool = SimpleNamespace(name=tool_name)
    tool_context = MagicMock()
    tool_context.state = _provider_follow_up_state(
        provider=provider,
        user_query=user_query,
    )

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is not None
    body = result.get("result", "")
    assert provider in body
    assert "555-0100" in body or "**Phone:**" in body or "Service results" in body


def test_before_tool_allows_pipeline_when_fresh_retrieval_requested() -> None:
    tool = SimpleNamespace(name="analyze_checkpoints")
    tool_context = MagicMock()
    tool_context.state = {
        "user_query": "find more local service providers for garage door repair",
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "find more local service providers",
            "retrieval_only": False,
            "run_optional_agents": ["service"],
            "user_goal": "new_analysis",
            "query_mode": "branch_issue_search",
        },
        "checkpoint_parallel_results": _service_parallel_json("Up Right Garage Door Repair"),
    }

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is None


def test_before_tool_blocks_user_docs_on_checkpoint_memory_follow_up() -> None:
    tool = SimpleNamespace(name="user_docs_retrieval")
    tool_context = MagicMock()
    tool_context.state = {
        "user_query": "Are there issues in the kitchen?",
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "Are there issues in the kitchen?",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "query_mode": "interpret_session",
        },
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "checkpoint_summary": {
                "locations": ["Garage"],
                "checkpointsAnalyzed": 2,
            },
        },
    }

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is not None
    assert "prior messages" in result.get("result", "")


def test_before_tool_blocks_analyze_checkpoints_on_report_route() -> None:
    tool = SimpleNamespace(name="analyze_checkpoints")
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
            "query_mode": "interpret_session",
            "discourse_act": "accept_offer",
            "focus_branch": "cost",
        },
    }

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is not None
    assert "report mode" in result.get("result", "").lower()
    assert "analyze_checkpoints" in result.get("result", "")


def test_before_tool_allows_report_retrieval_on_report_route_with_session_cache() -> None:
    from property_agent.reports.retrieval import (
        REPORT_RETRIEVAL_CACHE_FP_KEY,
        REPORT_RETRIEVAL_CACHE_TEXT_KEY,
        report_retrieval_fingerprint,
    )

    tool = SimpleNamespace(name="report_retrieval")
    tool_context = MagicMock()
    tool_context.state = {
        "user_query": "summarize the report",
        "report_ids": ["report-1"],
        REPORT_RETRIEVAL_CACHE_FP_KEY: report_retrieval_fingerprint(["report-1"]),
        REPORT_RETRIEVAL_CACHE_TEXT_KEY: "### Move-out report\n\nKitchen ok.\n",
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "report",
            "expanded_user_query": "summarize the report",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "query_mode": "interpret_session",
        },
    }

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is None


def test_before_tool_blocks_repeat_report_retrieval_with_cached_text() -> None:
    from property_agent.reports.retrieval import (
        REPORT_RETRIEVAL_LAST_RESULT_KEY,
        _INVOCATION_REPORT_RESULTS,
        store_invocation_report_result,
    )

    _INVOCATION_REPORT_RESULTS.clear()
    store_invocation_report_result(
        "inv-report-loop",
        "### Move-out report\n\nKitchen ok.\n",
    )

    tool = SimpleNamespace(name="report_retrieval")
    tool_context = MagicMock()
    tool_context._invocation_context.invocation_id = "inv-report-loop"
    tool_context.state = {
        "user_query": "summarize the report",
        "report_ids": ["report-1"],
        REPORT_RETRIEVAL_LAST_RESULT_KEY: "### Move-out report\n\nKitchen ok.\n",
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "report",
            "expanded_user_query": "summarize the report",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "query_mode": "interpret_session",
        },
    }

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is not None
    assert "Kitchen ok." in result.get("result", "")
    assert "SESSION_WORKING_MEMORY" not in result.get("result", "")
    _INVOCATION_REPORT_RESULTS.clear()


def test_before_tool_allows_user_docs_on_user_docs_route() -> None:
    tool = SimpleNamespace(name="user_docs_retrieval")
    tool_context = MagicMock()
    tool_context.state = {
        "user_query": "What does section 4.5 of the lease say?",
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "user_docs",
            "expanded_user_query": "What does section 4.5 of the lease say?",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "query_mode": "interpret_session",
        },
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {
            "checkpoint_summary": {"locations": ["Garage"], "checkpointsAnalyzed": 1},
        },
    }

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is None


def test_before_tool_blocks_user_docs_after_prune_when_snapshot_has_providers() -> None:
    provider = "Ace Handyman Services Brentwood"
    state = {
        "user_query": f"get me more details on {provider}",
        "checkpoint_parallel_results": _service_parallel_json(provider),
        "checkpoint_last_response_kind": "analysis",
    }
    snapshot_session_analysis_context(state)
    state.pop("checkpoint_parallel_results", None)
    state[RESOLVED_TURN_STATE_KEY] = {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": f"get me more details on {provider}",
        "retrieval_only": True,
        "run_optional_agents": [],
        "user_goal": "answer_from_context",
        "query_mode": "interpret_session",
    }
    tool = SimpleNamespace(name="user_docs_retrieval")
    tool_context = MagicMock()
    tool_context.state = state

    result = conversational_before_tool(tool, {}, tool_context)

    assert result is not None
    assert "925" in result.get("result", "") or provider in result.get("result", "")
