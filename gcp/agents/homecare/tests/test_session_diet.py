"""Tests for G4 ADK session diet (structured checkpoint_analysis)."""

from __future__ import annotations

import importlib

from property_agent.runtime.session_diet import (
    filter_state_delta_for_session_storage,
    prune_heavy_checkpoint_state,
    slim_analysis_for_session,
)
from property_agent.checkpoint.constants import CHECKPOINT_ANALYSIS_STATE_KEY
from property_agent.checkpoint.analysis.assembler import stash_checkpoint_analysis_in_state


def _sample_analysis() -> dict:
    return {
        "title": "Roof inspection",
        "analysisStatus": {"coverage": "completed", "diy": "running"},
        "checkpointSummary": {
            "checkpointsAnalyzed": 1,
            "locations": ["Attic"],
            "issuesDetected": ["Wear on shingles"],
            "overallCondition": "Fair",
        },
    }


def test_slim_analysis_progress_drops_heavy_sections():
    slim = slim_analysis_for_session(_sample_analysis())
    assert "diyResults" not in slim
    assert "roof" in slim.lower() or "progress" in slim.lower()


def test_filter_state_delta_strips_message_patch_keys():
    delta = {
        "contentMarkdown": "# Roof",
        "contentJson": {"analysis": _sample_analysis()},
        "checkpoint_parallel_results": '{"x": 1}',
        CHECKPOINT_ANALYSIS_STATE_KEY: _sample_analysis(),
    }
    filtered = filter_state_delta_for_session_storage(delta)
    assert "contentMarkdown" not in filtered
    assert CHECKPOINT_ANALYSIS_STATE_KEY in filtered


def test_stash_analysis_in_state():
    state: dict = {}
    stash_checkpoint_analysis_in_state(state, _sample_analysis())
    assert state[CHECKPOINT_ANALYSIS_STATE_KEY]["title"] == "Roof inspection"


def test_prune_removes_heavy_checkpoint_keys():
    state = {
        CHECKPOINT_ANALYSIS_STATE_KEY: _sample_analysis(),
        "checkpoint_parallel_results": "{}",
    }
    prune_heavy_checkpoint_state(state)
    assert state == {}


def test_g4_compaction_env_override(monkeypatch):
    monkeypatch.setenv("ADK_COMPACTION_TOKEN_THRESHOLD", "100000")
    monkeypatch.setenv("ADK_COMPACTION_EVENT_RETENTION_SIZE", "16")
    from property_agent.runtime import app_config

    importlib.reload(app_config)
    config = app_config.build_events_compaction_config()
    assert config is not None
    assert config.token_threshold == 100_000
    assert config.event_retention_size == 16
    importlib.reload(app_config)


def test_g4_compaction_defaults(monkeypatch):
    for key in (
        "ADK_EVENTS_COMPACTION_DISABLED",
        "ADK_COMPACTION_TOKEN_THRESHOLD",
        "ADK_COMPACTION_EVENT_RETENTION_SIZE",
    ):
        monkeypatch.delenv(key, raising=False)
    from property_agent.runtime import app_config

    importlib.reload(app_config)
    config = app_config.build_events_compaction_config()
    assert config is not None
    assert config.token_threshold == 130_000
    importlib.reload(app_config)
