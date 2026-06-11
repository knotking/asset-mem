"""Tests for UI checkpoint selection change detection."""

from __future__ import annotations

from property_agent.checkpoint.constants import CHECKPOINT_IDS_ANALYZED_STATE_KEY
from property_agent.routing.checkpoint_selection import (
    checkpoint_selection_changed,
    checkpoint_selection_cleared,
    clear_stale_checkpoint_analysis_state,
    record_checkpoint_ids_analyzed,
)
from property_agent.routing.conversational_intent import (
    CHECKPOINT_LAST_RESPONSE_KIND_KEY,
    prior_checkpoint_analysis_in_session,
)


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


def test_checkpoint_selection_cleared_when_ids_removed() -> None:
    state = _prior_analysis_state(checkpoint_ids=[])
    assert checkpoint_selection_cleared(state)
    assert checkpoint_selection_changed(state)


def test_record_checkpoint_ids_analyzed() -> None:
    state: dict = {"checkpoint_ids": ["a", "b"]}
    record_checkpoint_ids_analyzed(state)
    assert state[CHECKPOINT_IDS_ANALYZED_STATE_KEY] == ["a", "b"]


def test_clear_stale_checkpoint_analysis_state_drops_lingering_flags() -> None:
    state = _prior_analysis_state(checkpoint_ids=["door-cp", "car-cp"])
    assert prior_checkpoint_analysis_in_session(state)

    cleared = clear_stale_checkpoint_analysis_state(state)

    assert cleared is True
    assert CHECKPOINT_IDS_ANALYZED_STATE_KEY not in state
    assert CHECKPOINT_LAST_RESPONSE_KIND_KEY not in state
    assert "checkpoint_analysis" not in state
    assert not prior_checkpoint_analysis_in_session(state)
