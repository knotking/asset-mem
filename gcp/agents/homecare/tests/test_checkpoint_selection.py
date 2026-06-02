"""Tests for UI checkpoint selection change detection."""

from __future__ import annotations

from property_agent.checkpoint.constants import CHECKPOINT_IDS_ANALYZED_STATE_KEY
from property_agent.routing.apply_resolved_turn import apply_checkpoint_retrieval_plan
from property_agent.routing.checkpoint_selection import (
    checkpoint_selection_changed,
    record_checkpoint_ids_analyzed,
)
from property_agent.routing.turn_intent_llm import apply_turn_intent_guardrails


def _payload() -> dict:
    return {
        "intent": "substantive",
        "route": "checkpoint",
        "expanded_user_query": "",
        "retrieval_only": True,
        "run_optional_agents": [],
    }


def _prior_analysis_state(*, checkpoint_ids: list[str]) -> dict:
    return {
        "checkpoint_last_response_kind": "analysis",
        "checkpoint_ids": checkpoint_ids,
        CHECKPOINT_IDS_ANALYZED_STATE_KEY: ["door-cp"],
        "checkpoint_analysis": {
            "analysis": {
                "checkpointSummary": {
                    "checkpointsAnalyzed": 1,
                    "locations": ["Door"],
                    "issuesDetected": ["Paint damage"],
                }
            }
        },
        "checkpoint_optional_agents": ["coverage", "diy", "service", "cost"],
    }


def test_checkpoint_selection_changed_when_id_added() -> None:
    state = _prior_analysis_state(checkpoint_ids=["door-cp", "car-cp"])
    assert checkpoint_selection_changed(state)


def test_checkpoint_selection_unchanged() -> None:
    state = _prior_analysis_state(checkpoint_ids=["door-cp"])
    assert not checkpoint_selection_changed(state)


def test_reanalysis_after_adding_checkpoint_runs_pipeline() -> None:
    state = _prior_analysis_state(checkpoint_ids=["door-cp", "car-cp"])
    out = apply_checkpoint_retrieval_plan(
        _payload(),
        user_query="run analysis on my checkpoints",
        state=state,
    )
    assert out["user_goal"] == "new_analysis"
    assert out["retrieval_only"] is False
    assert out["run_optional_agents"]

def test_reanalysis_after_adding_checkpoint_without_optional_branches() -> None:
    state = _prior_analysis_state(checkpoint_ids=["door-cp", "car-cp"])
    # Simulate the user's second turn where optional-branch toggles are off
    # (matches the deployed logs: checkpoint_optional_agents=0).
    state["checkpoint_optional_agents"] = []
    out = apply_checkpoint_retrieval_plan(
        _payload(),
        user_query="is there any issue with my car based on the selected checkpoints?",
        state=state,
    )
    # Even though no DIY/coverage/service/cost keywords are present, the
    # checkpoint selection changed so we must re-run checkpoint retrieval.
    assert out["user_goal"] == "new_analysis"
    assert out["retrieval_only"] is False
    assert out["run_optional_agents"] == []


def test_explain_follow_up_still_context_when_selection_unchanged() -> None:
    state = _prior_analysis_state(checkpoint_ids=["door-cp"])
    out = apply_checkpoint_retrieval_plan(
        _payload(),
        user_query="can you explain DIY steps?",
        state=state,
    )
    assert out["user_goal"] == "answer_from_context"


def test_guardrail_keeps_new_analysis_when_selection_changed() -> None:
    state = _prior_analysis_state(checkpoint_ids=["door-cp", "car-cp"])
    guarded = apply_turn_intent_guardrails(
        {"user_goal": "new_analysis", "run_optional_agents": ["diy"], "reason": "test"},
        user_query="can you explain DIY steps?",
        expanded_user_query="can you explain DIY steps?",
        state=state,
    )
    assert guarded["user_goal"] == "new_analysis"
    assert guarded["run_optional_agents"] == ["diy"]


def test_record_checkpoint_ids_analyzed() -> None:
    state: dict = {"checkpoint_ids": ["a", "b"]}
    record_checkpoint_ids_analyzed(state)
    assert state[CHECKPOINT_IDS_ANALYZED_STATE_KEY] == ["a", "b"]
