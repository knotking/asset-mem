"""Tests for Firestore session analysis persist/hydrate (Phase 3)."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from property_agent.query_mode import SESSION_WORKING_MEMORY_SNAPSHOT_KEY
from property_agent.session_analysis_store import (
    apply_session_analysis_doc_to_state,
    maybe_hydrate_session_analysis_from_firestore,
    maybe_persist_session_analysis_from_state,
    persist_session_analysis_to_firestore,
    session_analysis_doc_path,
    state_has_complete_session_analysis,
)
from property_agent.sub_agents.checkpoint_dual_format.constants import (
    CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY,
)


def _dual_body() -> str:
    return """# Analysis

```json
{
  "analysis": {
    "title": "Garage Checkpoint Overview",
    "checkpointSummary": {
      "checkpointsAnalyzed": 1,
      "queryType": "location-specific",
      "locations": ["Garage"]
    }
  }
}
```
"""


def _service_parallel_json() -> str:
    inner = json.dumps(
        {
            "serviceResults": {
                "localPros": {"serpAPIResults": [{"name": "OneHandyPro"}]},
            }
        }
    )
    return json.dumps({"checkpoint_parallel_service_result": inner})


def test_session_analysis_doc_path() -> None:
    assert session_analysis_doc_path(user_id="u1", property_id="p1") == (
        "users/u1/properties/p1/agentSessionAnalysis/current"
    )


def test_persist_writes_firestore_doc() -> None:
    state = {
        CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY: _dual_body(),
        "checkpoint_parallel_results": _service_parallel_json(),
        "property_id": "prop-1",
    }
    mock_db = MagicMock()
    mock_ref = MagicMock()
    mock_db.document.return_value = mock_ref

    with patch(
        "property_agent.session_analysis_store.session_analysis_firestore_disabled",
        return_value=False,
    ):
        ok = persist_session_analysis_to_firestore(
            state,
            user_id="user-1",
            property_id="prop-1",
            agent_session_id="sess-1",
            db=mock_db,
        )

    assert ok is True
    mock_db.document.assert_called_once()
    mock_ref.set.assert_called_once()
    payload = mock_ref.set.call_args[0][0]
    assert "dualFormatBody" in payload
    assert payload["workingMemorySnapshot"]


def test_hydrate_applies_snapshot_and_dual_format() -> None:
    state: dict = {}
    doc = {
        "dualFormatBody": _dual_body(),
        "workingMemorySnapshot": {
            "areas_analyzed": ["Garage"],
            "checkpoint_summary": "Door needs service",
        },
        "checkpointOptionalAgents": ["service"],
    }
    assert apply_session_analysis_doc_to_state(state, doc) is True
    assert state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    assert state.get(CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY)
    assert state.get("_session_analysis_hydrated_from_firestore") is True


def test_hydrate_skips_when_state_complete() -> None:
    state = {
        CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY: _dual_body(),
        SESSION_WORKING_MEMORY_SNAPSHOT_KEY: {"areas_analyzed": ["Garage"]},
    }
    assert state_has_complete_session_analysis(state) is True
    mock_db = MagicMock()
    with patch(
        "property_agent.session_analysis_store.session_analysis_hydrate_disabled",
        return_value=False,
    ):
        loaded = maybe_hydrate_session_analysis_from_firestore(
            state,
            user_id="user-1",
            property_id="prop-1",
            db=mock_db,
        )
    assert loaded is False
    mock_db.document.assert_not_called()


def test_maybe_hydrate_loads_from_firestore() -> None:
    state: dict = {}
    mock_db = MagicMock()
    mock_snap = MagicMock()
    mock_snap.exists = True
    mock_snap.to_dict.return_value = {
        "dualFormatBody": _dual_body(),
        "workingMemorySnapshot": {"areas_analyzed": ["Garage"]},
    }
    mock_db.document.return_value.get.return_value = mock_snap

    with patch(
        "property_agent.session_analysis_store.session_analysis_firestore_disabled",
        return_value=False,
    ), patch(
        "property_agent.session_analysis_store.session_analysis_hydrate_disabled",
        return_value=False,
    ):
        assert maybe_hydrate_session_analysis_from_firestore(
            state,
            user_id="user-1",
            property_id="prop-1",
            db=mock_db,
        )

    assert state.get("_session_analysis_hydrated_from_firestore") is True


def test_maybe_persist_from_state() -> None:
    state = {
        CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY: _dual_body(),
        "checkpoint_parallel_results": _service_parallel_json(),
        "property_id": "prop-1",
    }
    with patch(
        "property_agent.session_analysis_store.persist_session_analysis_to_firestore",
        return_value=True,
    ) as mock_persist:
        assert maybe_persist_session_analysis_from_state(
            state,
            user_id="user-1",
        )
    mock_persist.assert_called_once()
