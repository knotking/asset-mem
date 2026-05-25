"""Tests for LLM-only resolve_turn."""

from __future__ import annotations

import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from property_agent.conversational_intent import LAST_OFFERED_OPTIONS_KEY
from property_agent.resolve_turn import (
    CASUAL_INTENTS,
    ResolvedTurn,
    prepare_before_model_turn,
    requests_optional_analysis_from_resolved,
    resolve_turn,
)
from property_agent.resolve_turn_llm import (
    _apply_primary_agent_constraints,
    _sanitize_llm_payload,
    resolve_llm_disabled,
    resolve_turn_llm,
)


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
        "property_agent.resolve_turn_llm.call_resolve_turn_llm",
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
        "property_agent.resolve_turn_llm.call_resolve_turn_llm",
        return_value=None,
    ):
        resolved = resolve_turn(ctx)
    assert resolved.resolve_source == "fallback"
    assert resolved.retrieval_only is True


def test_prepare_before_model_casual_returns_response() -> None:
    ctx = _ctx(query="hello")
    llm_out = ResolvedTurn(
        intent="greeting",
        route="none",
        expanded_user_query="hello",
        retrieval_only=True,
        resolve_source="llm",
    )
    with patch("property_agent.resolve_turn.resolve_turn", return_value=llm_out):
        response = prepare_before_model_turn(ctx, llm_request=SimpleNamespace(config=None))
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
