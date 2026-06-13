"""Tests for checkpoint location-aware retrieval."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from property_agent.checkpoint.analysis.assembler import prepend_location_disclosure_to_blob
from property_agent.checkpoint.retrieval.agent import ask_checkpoints_retrieval
from property_agent.checkpoint.retrieval.location_query import (
    parse_checkpoint_location_intent,
    query_requests_location_filter,
    resolve_location_field,
)


def test_parse_kitchen_intent() -> None:
    intent = parse_checkpoint_location_intent(
        "Any issues related to kitchen that needs my attention?"
    )
    assert intent is not None
    assert intent.label == "kitchen"


def test_parse_garage_intent() -> None:
    intent = parse_checkpoint_location_intent("What is wrong with the garage door?")
    assert intent is not None
    assert intent.label == "garage"


def test_resolve_garage_and_vehicle() -> None:
    known = ["Garage", "Vehicle - Exterior"]
    assert resolve_location_field("garage", known) == "Garage"
    assert resolve_location_field("vehicle", known) == "Vehicle - Exterior"
    assert resolve_location_field("kitchen", known) is None


def test_query_requests_location_filter_negative() -> None:
    assert not query_requests_location_filter("Summarize the issues")
    assert not query_requests_location_filter("Any issues from previous month?")


def test_ask_checkpoints_retrieval_uses_location_filter_for_kitchen(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    def _fake_locations(_db, **kwargs):
        captured["locations_kwargs"] = kwargs
        return ["Garage", "Vehicle - Exterior"]

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoint_location_values",
        _fake_locations,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_recent_property_checkpoints",
        lambda *_a, **_k: pytest.fail("list_recent should not run when kitchen unmatched"),
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.search_checkpoints_by_vector",
        lambda *_a, **_k: pytest.fail("vector search should not run for kitchen query"),
    )
    monkeypatch.setattr("property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", MagicMock())

    state = {"user_id": "u1", "current_date_utc": "2026-06-13"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    out = ask_checkpoints_retrieval(
        user_query="Any issues related to kitchen that needs my attention?",
        property_id="p1",
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert out["checkpoints"] == []
    assert out["location_meta"]["requested"] == "kitchen"
    assert out["location_meta"]["matched_field"] is None


def test_ask_checkpoints_retrieval_location_filter_garage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_locations(_db, **kwargs):
        return ["Garage", "Vehicle - Exterior"]

    def _fake_list(_db, **kwargs):
        return {
            "checkpoints": [
                {
                    "id": "cp1",
                    "location": "Garage",
                    "aiAnalysis": {"summary": "Paint chip", "issues": []},
                }
            ],
            "inventory_meta": {
                "total_count": 1,
                "returned_count": 1,
                "truncated": False,
                "scope": "recent",
            },
        }

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_checkpoint_location_values",
        _fake_locations,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.list_recent_property_checkpoints",
        _fake_list,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.search_checkpoints_by_vector",
        lambda *_a, **_k: pytest.fail("vector search should not run"),
    )
    monkeypatch.setattr("property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", MagicMock())

    state = {"user_id": "u1"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    out = ask_checkpoints_retrieval(
        user_query="Any garage issues?",
        property_id="p1",
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert len(out["checkpoints"]) == 1
    assert out["location_meta"]["matched_field"] == "Garage"


def test_prepend_location_disclosure_to_blob() -> None:
    blob = prepend_location_disclosure_to_blob(
        "Checkpoint Name: Garage",
        {
            "requested": "kitchen",
            "matched_field": None,
            "returned_count": 0,
            "scope": "location",
        },
    )
    assert "no checkpoints found for **kitchen**" in blob
