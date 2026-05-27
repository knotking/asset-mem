"""Tests for checkpoint follow-up intent LLM + guardrails."""

from __future__ import annotations

import json
from unittest.mock import patch

from property_agent.resolve_turn_llm import _apply_checkpoint_retrieval_plan
from property_agent.turn_intent_llm import (
    apply_turn_intent_guardrails,
    classify_checkpoint_follow_up_intent,
    intent_to_checkpoint_payload,
    turn_intent_llm_disabled,
)


def _dual_format_with_diy_and_cost() -> str:
    inner = {
        "analysis": {
            "title": "Garage analysis",
            "checkpointSummary": {"checkpointsAnalyzed": 2, "locations": ["Garage"]},
            "diyResults": {
                "diySteps": {
                    "summary": "Refinish door",
                    "steps": [{"stepNumber": 1, "description": "Clean surface"}],
                }
            },
            "costEstimationResults": {
                "costEstimates": {
                    "repair_type": "Garage door",
                    "Service": {"cost_range": "$300 - $800"},
                }
            },
        }
    }
    return f"# Analysis\n\n```json\n{json.dumps(inner)}\n```\n"


def _payload() -> dict:
    return {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": "",
        "retrieval_only": True,
        "run_optional_agents": [],
    }


def test_explain_diy_after_prior_analysis_uses_context() -> None:
    state = {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_analysis_dual_format": _dual_format_with_diy_and_cost(),
    }
    with patch(
        "property_agent.turn_intent_llm.turn_intent_llm_disabled",
        return_value=True,
    ):
        out = _apply_checkpoint_retrieval_plan(
            _payload(),
            user_query="can you explain DIY steps?",
            state=state,
        )
    assert out["user_goal"] == "answer_from_context"
    assert out["retrieval_only"] is True
    assert out["run_optional_agents"] == []


def test_why_cost_high_after_prior_analysis_uses_context() -> None:
    state = {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_analysis_dual_format": _dual_format_with_diy_and_cost(),
    }
    with patch(
        "property_agent.turn_intent_llm.turn_intent_llm_disabled",
        return_value=True,
    ):
        out = _apply_checkpoint_retrieval_plan(
            _payload(),
            user_query="why is cost high for professional expert?",
            state=state,
        )
    assert out["user_goal"] == "answer_from_context"
    assert out["run_optional_agents"] == []


def test_find_more_providers_still_runs_service() -> None:
    state = {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_analysis_dual_format": _dual_format_with_diy_and_cost(),
    }
    with patch(
        "property_agent.turn_intent_llm.turn_intent_llm_disabled",
        return_value=True,
    ):
        out = _apply_checkpoint_retrieval_plan(
            _payload(),
            user_query="Ok. find me more service providers",
            state=state,
        )
    assert out["user_goal"] == "new_analysis"
    assert out["run_optional_agents"] == ["service"]


def test_how_about_cost_still_runs_cost_when_prior_has_cost() -> None:
    """Explicit menu-style branch pick should still run even if cost exists."""
    state = {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_analysis_dual_format": _dual_format_with_diy_and_cost(),
    }
    with patch(
        "property_agent.turn_intent_llm.turn_intent_llm_disabled",
        return_value=True,
    ):
        out = _apply_checkpoint_retrieval_plan(
            _payload(),
            user_query="how about cost?",
            state=state,
        )
    assert out["user_goal"] == "new_analysis"
    assert out["run_optional_agents"] == ["cost"]


def test_llm_intent_guardrail_overrides_false_new_analysis() -> None:
    state = {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_analysis_dual_format": _dual_format_with_diy_and_cost(),
    }
    raw = {
        "user_goal": "new_analysis",
        "run_optional_agents": ["diy"],
        "reason": "llm thought diy keyword",
        "source": "llm",
    }
    guarded = apply_turn_intent_guardrails(
        raw,
        user_query="can you explain DIY steps?",
        expanded_user_query="can you explain DIY steps?",
        state=state,
    )
    assert guarded["user_goal"] == "answer_from_context"
    assert guarded["run_optional_agents"] == []


def test_classify_uses_llm_when_enabled() -> None:
    state = {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_analysis_dual_format": _dual_format_with_diy_and_cost(),
    }
    with patch(
        "property_agent.turn_intent_llm.turn_intent_llm_disabled",
        return_value=False,
    ), patch(
        "property_agent.turn_intent_llm.call_turn_intent_llm",
        return_value={
            "user_goal": "answer_from_context",
            "run_optional_agents": [],
            "reason": "mock",
            "source": "llm",
        },
    ) as mock_llm:
        result = classify_checkpoint_follow_up_intent(
            user_query="explain DIY steps",
            expanded_user_query="explain DIY steps",
            state=state,
        )
    mock_llm.assert_called_once()
    assert result["user_goal"] == "answer_from_context"


def test_intent_to_checkpoint_payload_new_analysis() -> None:
    out = intent_to_checkpoint_payload(
        {"user_goal": "new_analysis", "run_optional_agents": ["service"]},
        _payload(),
    )
    assert out["user_goal"] == "new_analysis"
    assert out["run_optional_agents"] == ["service"]
    assert out["retrieval_only"] is False


def test_turn_intent_llm_disabled_env() -> None:
    import os

    with patch.dict(os.environ, {"TURN_INTENT_LLM_DISABLED": "1"}):
        assert turn_intent_llm_disabled() is True
