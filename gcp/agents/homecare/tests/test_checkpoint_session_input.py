"""Tests for checkpoint pipeline session input staging."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from property_agent.checkpoint.analysis.parallel_runner import _build_checkpoint_cost_query
from property_agent.checkpoint.session_input import (
    apply_session_checkpoint_ids_to_tool_args,
    apply_session_location_to_tool_args,
    checkpoint_ids_for_pipeline_from_state,
    normalize_checkpoint_optional_agents,
    resolve_checkpoint_location_fields,
)


def test_checkpoint_ids_for_pipeline_from_state_normalizes() -> None:
    state = {"checkpoint_ids": ["  abc123  ", "", None, "def456"]}
    assert checkpoint_ids_for_pipeline_from_state(state) == ["abc123", "def456"]


def test_normalize_checkpoint_optional_agents_dedupes_preserving_order() -> None:
    assert normalize_checkpoint_optional_agents(["diy", "diy", "cost", "diy"]) == [
        "diy",
        "cost",
    ]
    assert normalize_checkpoint_optional_agents(["bogus", "cost"]) == ["cost"]


def test_apply_session_checkpoint_ids_drops_executor_invented_slugs() -> None:
    state = {"checkpoint_ids": []}
    args = {
        "checkpoint_ids": ["garage"],
        "user_query": "Are there any issues in the garage?",
        "property_id": "p1",
    }
    apply_session_checkpoint_ids_to_tool_args(state, args)
    assert args["checkpoint_ids"] is None


def test_apply_session_checkpoint_ids_keeps_ui_selection() -> None:
    real_id = "ZCeYq22NbWJynQBmlmyt"
    state = {"checkpoint_ids": [real_id]}
    args = {"checkpoint_ids": [real_id], "property_id": "p1"}
    apply_session_checkpoint_ids_to_tool_args(state, args)
    assert args["checkpoint_ids"] == [real_id]


def test_apply_session_checkpoint_ids_replaces_executor_slugs_with_ui() -> None:
    real_id = "ZCeYq22NbWJynQBmlmyt"
    state = {"checkpoint_ids": [real_id]}
    args = {"checkpoint_ids": ["garage"], "property_id": "p1"}
    apply_session_checkpoint_ids_to_tool_args(state, args)
    assert args["checkpoint_ids"] == [real_id]


def test_resolve_checkpoint_location_falls_back_to_session() -> None:
    state = {
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
        "search_location": {
            "source": "property_address",
            "radius_miles": 5,
            "coordinates": {"lat": 37.9319, "lng": -121.6958},
            "label": "1982 Helena Way, Brentwood, CA 94513",
        },
    }
    pa, sl = resolve_checkpoint_location_fields(
        state, property_address=None, search_location=None
    )
    assert pa == "1982 Helena Way, Brentwood, CA 94513"
    assert sl is not None
    assert sl["label"] == "1982 Helena Way, Brentwood, CA 94513"
    assert sl["coordinates"]["lat"] == 37.9319


def test_resolve_checkpoint_location_merges_partial_tool_arg_with_session_label() -> None:
    state = {
        "search_location": {
            "source": "property_address",
            "radius_miles": 5,
            "coordinates": {"lat": 37.9, "lng": -121.7},
            "label": "Brentwood, CA",
        },
    }
    tool_sl = {
        "coordinates": {"lat": 37.9, "lng": -121.7},
        "radius_miles": 5,
    }
    pa, sl = resolve_checkpoint_location_fields(
        state, property_address=None, search_location=tool_sl
    )
    assert sl is not None
    assert sl["label"] == "Brentwood, CA"


def test_apply_session_location_to_tool_args_backfills_missing_fields() -> None:
    state = {
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
        "search_location": {
            "source": "property_address",
            "radius_miles": 5,
            "coordinates": {"lat": 37.9, "lng": -121.7},
            "label": "1982 Helena Way, Brentwood, CA 94513",
        },
    }
    args: dict = {
        "user_query": "Run cost analysis",
        "property_id": "p1",
        "branches": ["cost"],
    }
    apply_session_location_to_tool_args(state, args)
    assert args["property_address"] == "1982 Helena Way, Brentwood, CA 94513"
    assert args["search_location"]["label"] == "1982 Helena Way, Brentwood, CA 94513"


def test_build_cost_query_includes_market_location_from_resolved_payload() -> None:
    pa, sl = resolve_checkpoint_location_fields(
        {
            "property_address": "1982 Helena Way, Brentwood, CA 94513",
            "search_location": {
                "source": "property_address",
                "radius_miles": 5,
                "coordinates": {"lat": 37.9, "lng": -121.7},
                "label": "1982 Helena Way, Brentwood, CA 94513",
            },
        },
        property_address=None,
        search_location=None,
    )
    payload = {
        "checkpoint_retrieval_search_query": "garage door paint repair",
        "property_address": pa,
        "search_location": sl,
    }
    body = json.loads(_build_checkpoint_cost_query(payload))
    assert body["market_location"] == "1982 Helena Way, Brentwood, CA 94513"
    assert body["property_address"] == "1982 Helena Way, Brentwood, CA 94513"


def test_ask_checkpoints_retrieval_falls_back_to_vector_on_by_id_miss(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from property_agent.checkpoint.retrieval.agent import ask_checkpoints_retrieval

    vector_called: dict = {}

    def _fake_vector(**kwargs):
        vector_called.update(kwargs)
        return [
            {
                "id": "ZCeYq22NbWJynQBmlmyt",
                "name": "Garage",
                "location": "Garage",
                "aiAnalysis": {"summary": "Paint chip", "issues": []},
            }
        ]

    class _Doc:
        exists = False
        id = "garage"

        def to_dict(self) -> dict:
            return {}

    class _CheckpointRef:
        def document(self, _doc_id: str) -> "_CheckpointRef":
            return self

    class _CheckpointsCollection:
        def document(self, _doc_id: str) -> _CheckpointRef:
            return _CheckpointRef()

    class _PropertyRef:
        def collection(self, name: str) -> _CheckpointsCollection:
            assert name == "checkpoints"
            return _CheckpointsCollection()

    class _PropertiesCollection:
        def document(self, _doc_id: str) -> _PropertyRef:
            return _PropertyRef()

    class _UserRef:
        def collection(self, name: str) -> _PropertiesCollection:
            assert name == "properties"
            return _PropertiesCollection()

    class _UsersCollection:
        def document(self, _doc_id: str) -> _UserRef:
            return _UserRef()

    class _Db:
        def collection(self, name: str) -> _UsersCollection:
            assert name == "users"
            return _UsersCollection()

        def get_all(self, refs: list) -> list:
            return [_Doc() for _ in refs]

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.search_checkpoints_by_vector",
        _fake_vector,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", None
    )
    monkeypatch.setattr(
        "google.cloud.firestore.Client",
        lambda: _Db(),
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.refine_checkpoint_branch_search_intents",
        lambda *_a, **_k: SimpleNamespace(
            issue_stem="garage issues", to_dict=lambda: {}
        ),
    )

    state: dict = {"user_id": "u1"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    # Scope-neutral query so by_id runs; invalid id misses and falls back to vector.
    user_query = "Summarize the selected checkpoint"
    out = ask_checkpoints_retrieval(
        user_query=user_query,
        property_id="p1",
        checkpoint_ids=["garage"],
        tool_context=tool_context,
    )

    assert vector_called["query_text"] == user_query
    assert len(out["checkpoints"]) == 1
    assert out["checkpoints"][0]["checkpointId"] == "ZCeYq22NbWJynQBmlmyt"


def test_ask_checkpoints_retrieval_skips_refiner_when_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from property_agent.checkpoint.retrieval.agent import ask_checkpoints_retrieval

    def _fake_vector(**_kwargs):
        return [
            {
                "id": "c1",
                "name": "Garage",
                "location": "Garage",
                "aiAnalysis": {"summary": "Paint chip", "issues": ["chipped paint"]},
            }
        ]

    refiner_calls: list = []

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.search_checkpoints_by_vector",
        _fake_vector,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", None
    )
    monkeypatch.setattr("google.cloud.firestore.Client", lambda: SimpleNamespace())
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.refine_checkpoint_branch_search_intents",
        lambda *a, **k: refiner_calls.append((a, k)),
    )

    state: dict = {"user_id": "u1"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    out = ask_checkpoints_retrieval(
        user_query="Summarize the issues for the selected checkpoint",
        property_id="p1",
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert refiner_calls == []
    assert len(out["checkpoints"]) == 1
    assert out["search_query"]
    # Fallback intents must not clobber prior refined intents in session state.
    assert "checkpoint_branch_search_intents" not in state
