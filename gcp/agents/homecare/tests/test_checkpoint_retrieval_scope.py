"""Tests for retrieval scope, similarity threshold, and combined filters."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from property_agent.checkpoint.constants import (
    CHECKPOINT_LOCATION_META_STATE_KEY,
    CHECKPOINT_TEMPORAL_META_STATE_KEY,
    CHECKPOINT_VECTOR_SIMILARITY_MIN,
)
from property_agent.checkpoint.retrieval.agent import ask_checkpoints_retrieval
from property_agent.checkpoint.retrieval.location_query import resolve_location_field
from property_agent.checkpoint.retrieval.retrieval_scope import (
    apply_prior_scope_from_state,
    plan_checkpoint_retrieval,
    query_defines_retrieval_scope,
)


def test_yard_does_not_match_vehicle_exterior() -> None:
    known = ["Garage", "Vehicle - Exterior"]
    assert resolve_location_field("yard", known) is None
    assert resolve_location_field("vehicle", known) == "Vehicle - Exterior"


def test_query_defines_retrieval_scope() -> None:
    assert query_defines_retrieval_scope("kitchen issues in May")
    assert not query_defines_retrieval_scope("yes please")
    assert not query_defines_retrieval_scope("run cost analysis")


def test_plan_prefers_query_scope_over_session_checkpoint_ids() -> None:
    plan = plan_checkpoint_retrieval(
        "Any issues in kitchen last year?",
        location=None,
        checkpoint_ids=["vehicle-cp-1"],
        reference_date="2026-06-13",
        state=None,
    )
    assert plan.mode == "date_range"
    assert plan.location_intent is not None
    assert plan.location_intent.label == "kitchen"
    assert plan.date_range is not None


def test_plan_keeps_by_id_when_query_does_not_define_scope() -> None:
    plan = plan_checkpoint_retrieval(
        "Summarize the selected checkpoint",
        location=None,
        checkpoint_ids=["vehicle-cp-1"],
        reference_date="2026-06-13",
        state=None,
    )
    assert plan.mode == "by_id"


def test_plan_combined_date_and_location() -> None:
    plan = plan_checkpoint_retrieval(
        "Any kitchen issues from May 2026?",
        location=None,
        checkpoint_ids=None,
        reference_date="2026-06-13",
        state=None,
    )
    assert plan.mode == "date_range"
    assert plan.date_range is not None
    assert plan.date_range.label == "May 2026"
    assert plan.location_intent is not None
    assert plan.location_intent.label == "kitchen"


def test_apply_prior_scope_carryover() -> None:
    state = {
        CHECKPOINT_TEMPORAL_META_STATE_KEY: {
            "label": "May 2026",
            "start_utc": "2026-05-01T00:00:00+00:00",
            "end_utc": "2026-06-01T00:00:00+00:00",
            "returned_count": 0,
            "scope": "temporal",
        },
        CHECKPOINT_LOCATION_META_STATE_KEY: {
            "requested": "kitchen",
            "matched_field": None,
            "returned_count": 0,
            "scope": "location",
        },
    }
    plan = plan_checkpoint_retrieval(
        "yes, run cost",
        location=None,
        checkpoint_ids=None,
        reference_date="2026-06-13",
        state=state,
    )
    assert plan.carried_over is True
    assert plan.mode == "date_range"
    assert plan.date_range is not None
    assert plan.date_range.label == "May 2026"
    assert plan.location_intent is not None
    assert plan.location_intent.label == "kitchen"


def test_apply_prior_scope_skips_when_query_redefines_scope() -> None:
    state = {
        CHECKPOINT_LOCATION_META_STATE_KEY: {
            "requested": "kitchen",
            "matched_field": None,
            "returned_count": 0,
            "scope": "location",
        },
    }
    _date_range, _explicit_location, location_intent, carried = apply_prior_scope_from_state(
        state,
        user_query="garage issues",
        date_range=None,
        explicit_location=None,
        location_intent=None,
    )
    assert carried is False
    assert location_intent is None


def test_ask_checkpoints_retrieval_passes_vector_min_similarity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    def _fake_vector(**kwargs):
        captured.update(kwargs)
        return []

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.search_checkpoints_by_vector",
        _fake_vector,
    )
    monkeypatch.setattr("property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", MagicMock())

    state = {"user_id": "u1"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    ask_checkpoints_retrieval(
        user_query="water damage near the foundation",
        property_id="p1",
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert captured.get("min_similarity") == CHECKPOINT_VECTOR_SIMILARITY_MIN


def test_ask_checkpoints_retrieval_combined_date_location_no_match(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoint_location_values",
        lambda *_a, **_k: ["Garage", "Vehicle - Exterior"],
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoints_in_date_range",
        lambda *_a, **_k: pytest.fail("date range should not run when kitchen unmatched"),
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.search_checkpoints_by_vector",
        lambda *_a, **_k: pytest.fail("vector search should not run"),
    )
    monkeypatch.setattr("property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", MagicMock())

    state = {"user_id": "u1", "current_date_utc": "2026-06-13"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    out = ask_checkpoints_retrieval(
        user_query="Any kitchen issues from May 2026?",
        property_id="p1",
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert out["checkpoints"] == []
    assert out["location_meta"]["requested"] == "kitchen"
    assert out["temporal_meta"] is None


def test_ask_checkpoints_retrieval_combined_date_location_match(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    def _fake_date_range(_db, **kwargs):
        captured["date_kwargs"] = kwargs
        return {
            "checkpoints": [
                {
                    "id": "cp1",
                    "location": "Garage",
                    "createdAt": datetime(2026, 5, 10, tzinfo=timezone.utc),
                    "aiAnalysis": {"summary": "Chip", "issues": []},
                }
            ],
            "temporal_meta": {
                "label": "May 2026",
                "start_utc": "2026-05-01T00:00:00+00:00",
                "end_utc": "2026-06-01T00:00:00+00:00",
                "returned_count": 1,
                "scope": "temporal",
            },
        }

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoint_location_values",
        lambda *_a, **_k: ["Garage"],
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoints_in_date_range",
        _fake_date_range,
    )
    monkeypatch.setattr("property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", MagicMock())

    state = {"user_id": "u1", "current_date_utc": "2026-06-13"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    out = ask_checkpoints_retrieval(
        user_query="garage issues from May 2026",
        property_id="p1",
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert len(out["checkpoints"]) == 1
    assert captured["date_kwargs"]["location"] == "Garage"
    assert out["temporal_meta"]["label"] == "May 2026"
    assert out["location_meta"]["matched_field"] == "Garage"


def test_ask_checkpoints_retrieval_scope_carryover_followup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    def _fake_date_range(_db, **kwargs):
        captured["date_kwargs"] = kwargs
        return {
            "checkpoints": [],
            "temporal_meta": {
                "label": "May 2026",
                "start_utc": "2026-05-01T00:00:00+00:00",
                "end_utc": "2026-06-01T00:00:00+00:00",
                "returned_count": 0,
                "scope": "temporal",
            },
        }

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoint_location_values",
        lambda *_a, **_k: ["Garage", "Vehicle - Exterior"],
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoints_in_date_range",
        _fake_date_range,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.search_checkpoints_by_vector",
        lambda *_a, **_k: pytest.fail("vector search should not run on scoped follow-up"),
    )
    monkeypatch.setattr("property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", MagicMock())

    state = {
        "user_id": "u1",
        "current_date_utc": "2026-06-13",
        CHECKPOINT_TEMPORAL_META_STATE_KEY: {
            "label": "May 2026",
            "start_utc": "2026-05-01T00:00:00+00:00",
            "end_utc": "2026-06-01T00:00:00+00:00",
            "returned_count": 0,
            "scope": "temporal",
        },
        CHECKPOINT_LOCATION_META_STATE_KEY: {
            "requested": "kitchen",
            "matched_field": None,
            "returned_count": 0,
            "scope": "location",
        },
    }
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    out = ask_checkpoints_retrieval(
        user_query="yes please",
        property_id="p1",
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert out["checkpoints"] == []
    assert "date_kwargs" not in captured
    assert out["location_meta"]["requested"] == "kitchen"


def test_ask_checkpoints_retrieval_ignores_ids_when_query_defines_kitchen_scope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoint_location_values",
        lambda *_a, **_k: ["Garage", "Vehicle - Exterior"],
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoints_in_date_range",
        lambda *_a, **_k: {
            "checkpoints": [],
            "temporal_meta": {
                "label": "2025",
                "start_utc": "2025-01-01T00:00:00+00:00",
                "end_utc": "2026-01-01T00:00:00+00:00",
                "returned_count": 0,
                "scope": "temporal",
            },
        },
    )

    def _fake_get_all(_refs):
        pytest.fail("by_id fetch should not run when kitchen scoped")

    mock_db = MagicMock()
    mock_db.get_all = _fake_get_all
    monkeypatch.setattr("property_agent.checkpoint.retrieval.agent._firestore_client", lambda: mock_db)

    state = {"user_id": "u1", "current_date_utc": "2026-06-13"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    out = ask_checkpoints_retrieval(
        user_query="Any issues in kitchen last year?",
        property_id="p1",
        checkpoint_ids=["vehicle-cp-1"],
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert out["checkpoints"] == []
    assert out["location_meta"]["requested"] == "kitchen"


def test_ask_checkpoints_retrieval_scope_carryover_with_matched_location(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    def _fake_date_range(_db, **kwargs):
        captured["date_kwargs"] = kwargs
        return {
            "checkpoints": [],
            "temporal_meta": {
                "label": "May 2026",
                "start_utc": "2026-05-01T00:00:00+00:00",
                "end_utc": "2026-06-01T00:00:00+00:00",
                "returned_count": 0,
                "scope": "temporal",
            },
        }

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoint_location_values",
        lambda *_a, **_k: ["Garage"],
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoints_in_date_range",
        _fake_date_range,
    )
    monkeypatch.setattr("property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", MagicMock())

    state = {
        "user_id": "u1",
        CHECKPOINT_TEMPORAL_META_STATE_KEY: {
            "label": "May 2026",
            "start_utc": "2026-05-01T00:00:00+00:00",
            "end_utc": "2026-06-01T00:00:00+00:00",
            "returned_count": 0,
            "scope": "temporal",
        },
        CHECKPOINT_LOCATION_META_STATE_KEY: {
            "requested": "garage",
            "matched_field": "Garage",
            "returned_count": 1,
            "scope": "location",
        },
    }
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    ask_checkpoints_retrieval(
        user_query="yes, analyze cost",
        property_id="p1",
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert captured["date_kwargs"]["location"] == "Garage"
