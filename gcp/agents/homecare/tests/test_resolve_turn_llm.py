"""Tests for LLM-only resolve_turn."""

from __future__ import annotations

import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from agent_framework.routing.resolved_turn import RESOLVE_APPLIED_INVOCATION_KEY

from property_agent.routing.resolve_turn import (
    CASUAL_INTENTS,
    ResolvedTurn,
    prepare_before_model_turn,
    requests_optional_analysis_from_resolved,
    resolve_turn,
)
from property_agent.routing.apply_resolved_turn import (
    apply_checkpoint_retrieval_plan as _apply_checkpoint_retrieval_plan,
    apply_primary_agent_constraints as _apply_primary_agent_constraints,
    sanitize_llm_payload as _sanitize_llm_payload,
)
from property_agent.routing.resolve_turn_llm import resolve_llm_disabled


def _ctx(*, query: str, state: dict | None = None) -> MagicMock:
    state = dict(state or {})
    state.setdefault("user_query", query)
    ctx = MagicMock()
    ctx.state = state
    ctx._invocation_context = SimpleNamespace(
        invocation_id="inv-1",
        session=SimpleNamespace(events=[]),
    )
    return ctx


def test_resolve_llm_disabled_env() -> None:
    with patch.dict(os.environ, {}, clear=True):
        assert resolve_llm_disabled() is False
    with patch.dict(os.environ, {"RESOLVE_LLM_DISABLED": "1"}):
        assert resolve_llm_disabled() is True


def test_sanitize_casual_intent() -> None:
    out = _sanitize_llm_payload(
        {
            "intent": "greeting",
            "route": "checkpoint",
            "expanded_user_query": "hello",
            "retrieval_only": False,
            "run_optional_agents": ["cost"],
        },
        user_query="hello",
    )
    assert out is not None
    assert out["intent"] == "greeting"
    assert out["route"] == "none"
    assert out["run_optional_agents"] == []


def test_sanitize_maps_legacy_knowledge_base_route_to_none() -> None:
    out = _sanitize_llm_payload(
        {
            "intent": "substantive",
            "route": "knowledge_base",
            "expanded_user_query": "What does washer error E3 mean?",
            "retrieval_only": True,
            "run_optional_agents": [],
        },
        user_query="What does washer error E3 mean?",
    )
    assert out is not None
    assert out["intent"] == "substantive"
    assert out["route"] == "none"
    assert out["retrieval_only"] is True
    assert out["user_goal"] == "answer_from_context"


def test_sanitize_coerces_retrieval_only_on_interpretive_follow_up() -> None:
    state = {"checkpoint_last_response_kind": "analysis"}
    out = _sanitize_llm_payload(
        {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "What is wrong with my overall conditions?",
            "retrieval_only": False,
            "run_optional_agents": [],
        },
        user_query="whats wrong with my overall conditions?",
        state=state,
    )
    assert out is not None
    assert out["retrieval_only"] is True
    assert out["run_optional_agents"] == []
    assert out["user_goal"] == "answer_from_context"


def test_sanitize_ignores_llm_branches_copied_from_ui_toggles() -> None:
    state = {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_optional_agents": ["coverage", "diy", "service", "cost"],
    }
    out = _sanitize_llm_payload(
        {
            "discourse_act": "explain_prior",
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "What is wrong with my overall condition?",
            "retrieval_only": False,
            "run_optional_agents": ["coverage", "diy", "service", "cost"],
        },
        user_query="what is wrong with my overall condition?",
        state=state,
    )
    assert out is not None
    assert out["retrieval_only"] is True
    assert out["run_optional_agents"] == []
    assert out["user_goal"] == "answer_from_context"


def test_sanitize_advisory_professional_not_service_analysis() -> None:
    state = {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_optional_agents": ["service"],
    }
    out = _sanitize_llm_payload(
        {
            "discourse_act": "explain_prior",
            "focus_branch": "cost",
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "Should I engage a professional for garage door repair?",
            "retrieval_only": False,
            "run_optional_agents": ["service"],
        },
        user_query="should I engage a professional?",
        state=state,
    )
    assert out is not None
    assert out["retrieval_only"] is True
    assert out["run_optional_agents"] == []
    assert out["user_goal"] == "answer_from_context"


def test_apply_checkpoint_retrieval_plan_cold_session_requests_retrieval() -> None:
    payload = {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": "What checkpoints do I have and what is their current status?",
        "retrieval_only": True,
        "run_optional_agents": [],
        "user_goal": "answer_from_context",
    }
    out = _apply_checkpoint_retrieval_plan(
        payload,
        user_query="What checkpoints do I have and what is their current status?",
        state={"property_id": "prop-1"},
    )
    assert out["retrieval_only"] is True
    assert out["run_optional_agents"] == []
    assert out["user_goal"] == "new_analysis"


def test_apply_checkpoint_retrieval_plan_includes_service_from_query_text() -> None:
    payload = {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": "Analyse my checkpoints for coverage, diy, service, and cost",
        "retrieval_only": True,
        "run_optional_agents": [],
    }
    out = _apply_checkpoint_retrieval_plan(
        payload,
        user_query="analyse my checkpoints for coverage, diy, service, and cost",
        state={"checkpoint_optional_agents": ["coverage", "diy", "cost"]},
    )
    assert "service" in out["run_optional_agents"]
    assert out["user_goal"] == "new_analysis"


def test_sanitize_generic_analyse_uses_ui_toggles() -> None:
    state = {
        "checkpoint_optional_agents": ["diy", "cost"],
    }
    out = _sanitize_llm_payload(
        {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "Analyse my checkpoints",
            "retrieval_only": True,
            "run_optional_agents": [],
        },
        user_query="analyse my checkpoints",
        state=state,
    )
    assert out is not None
    assert out["retrieval_only"] is False
    assert out["run_optional_agents"] == ["diy", "cost"]
    assert out["user_goal"] == "new_analysis"


def test_sanitize_keeps_optional_run_for_cost_request() -> None:
    out = _sanitize_llm_payload(
        {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "Estimate repair costs for garage door paint damage.",
            "retrieval_only": False,
            "run_optional_agents": ["cost"],
        },
        user_query="how about cost?",
        state={"primary_agent": "checkpoint"},
    )
    assert out is not None
    assert out["retrieval_only"] is False
    assert out["run_optional_agents"] == ["cost"]


def test_apply_checkpoint_retrieval_plan_full_replay_not_coerced() -> None:
    payload = {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": "Show me the full analysis report again",
        "retrieval_only": True,
        "run_optional_agents": [],
    }
    out = _apply_checkpoint_retrieval_plan(
        payload,
        user_query="show full report again",
        state={"checkpoint_last_response_kind": "analysis"},
    )
    assert out["retrieval_only"] is False
    assert out["user_goal"] == "replay_deliverable"


def test_sanitize_substantive_cost() -> None:
    out = _sanitize_llm_payload(
        {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "Estimate repair costs for garage door paint damage.",
            "retrieval_only": False,
            "run_optional_agents": ["cost"],
            "menu_index": 5,
            "capability_key": "cost",
        },
        user_query="how about cost?",
    )
    assert out is not None
    assert out["intent"] == "substantive"
    assert out["run_optional_agents"] == ["cost"]
    assert out["retrieval_only"] is False


def test_resolve_turn_uses_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RESOLVE_LLM_DISABLED", raising=False)
    llm_out = ResolvedTurn(
        intent="substantive",
        route="checkpoint",
        expanded_user_query="Estimate repair costs.",
        retrieval_only=False,
        run_optional_agents=["cost"],
        capability_key="cost",
        resolve_source="llm",
    )
    ctx = _ctx(query="how about cost?", state={"primary_agent": "checkpoint"})
    with patch(
        "property_agent.routing.resolve_turn_llm.call_resolve_turn_llm",
        return_value=llm_out,
    ) as mock_llm:
        resolved = resolve_turn(ctx)
    mock_llm.assert_called_once()
    assert resolved.run_optional_agents == ["cost"]
    assert resolved.resolve_source == "llm"


def test_resolve_fallback_when_llm_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RESOLVE_LLM_DISABLED", raising=False)
    ctx = _ctx(query="how about cost?")
    with patch(
        "property_agent.routing.resolve_turn_llm.call_resolve_turn_llm",
        return_value=None,
    ):
        resolved = resolve_turn(ctx)
    assert resolved.resolve_source == "fallback"
    assert resolved.retrieval_only is True


def test_prepare_before_model_skips_re_resolve_same_invocation() -> None:
    ctx = _ctx(query="analyse my checkpoints")
    llm_out = ResolvedTurn(
        intent="substantive",
        route="checkpoint",
        expanded_user_query="analyse my checkpoints",
        retrieval_only=False,
        run_optional_agents=["coverage", "diy"],
        resolve_source="llm",
    )
    llm_request = SimpleNamespace(config=None)
    with patch(
        "property_agent.routing.resolve_turn.resolve_turn", return_value=llm_out
    ) as mock_resolve:
        assert prepare_before_model_turn(ctx, llm_request=llm_request) is None
        assert mock_resolve.call_count == 1
        assert ctx.state.get(RESOLVE_APPLIED_INVOCATION_KEY) == "inv-1"
        assert prepare_before_model_turn(ctx, llm_request=llm_request) is None
        assert mock_resolve.call_count == 1


def test_prepare_before_model_casual_returns_response() -> None:
    ctx = _ctx(query="hello")
    llm_out = ResolvedTurn(
        intent="greeting",
        route="none",
        expanded_user_query="hello",
        retrieval_only=True,
        resolve_source="llm",
    )
    with patch("property_agent.routing.resolve_turn.resolve_turn", return_value=llm_out):
        response = prepare_before_model_turn(
            ctx, llm_request=SimpleNamespace(config=None)
        )
    assert response is not None
    assert ctx.state.get("conversational_turn") is True


def test_requests_optional_from_resolved_only() -> None:
    state = {
        "resolved_turn": {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": "cost",
            "retrieval_only": False,
            "run_optional_agents": ["cost"],
        }
    }
    assert requests_optional_analysis_from_resolved(state) is True
    state["resolved_turn"]["run_optional_agents"] = []
    state["resolved_turn"]["retrieval_only"] = True
    assert requests_optional_analysis_from_resolved(state) is False


def test_casual_intents_frozenset() -> None:
    assert "greeting" in CASUAL_INTENTS
    assert "substantive" not in CASUAL_INTENTS


def test_primary_agent_docs_insurance_routes_user_docs() -> None:
    payload = {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": "Get more details on my insurance",
        "retrieval_only": False,
        "run_optional_agents": ["coverage"],
        "menu_index": 2,
        "capability_key": "coverage",
    }
    state = {
        "primary_agent": "docs",
        "context_doc_uris": ["gs://bucket/policy.pdf"],
        "checkpoint_ids": ["id1"],
    }
    out = _apply_primary_agent_constraints(
        payload, state=state, user_query="Get more details on my insurance"
    )
    assert out["route"] == "user_docs"
    assert out["retrieval_only"] is True
    assert out["run_optional_agents"] == []


def test_primary_agent_docs_kitchen_inspection_routes_checkpoint() -> None:
    payload = {
        "intent": "substantive",
        "route": "user_docs",
        "expanded_user_query": "Show me the latest inspection notes for the kitchen",
        "retrieval_only": True,
        "run_optional_agents": [],
    }
    state = {
        "primary_agent": "docs",
        "checkpoint_ids": ["id1"],
    }
    out = _apply_primary_agent_constraints(
        payload,
        state=state,
        user_query="Show me the latest inspection notes for the kitchen",
    )
    assert out["route"] == "checkpoint"
    assert out["run_optional_agents"] == []
