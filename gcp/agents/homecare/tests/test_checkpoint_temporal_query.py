"""Tests for checkpoint temporal query parsing and retrieval."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from property_agent.checkpoint.analysis.assembler import prepend_temporal_disclosure_to_blob
from property_agent.checkpoint.retrieval.agent import ask_checkpoints_retrieval
from property_agent.checkpoint.retrieval.firestore_checkpoint_list import (
    list_checkpoints_in_date_range,
)
from property_agent.checkpoint.retrieval.temporal_query import (
    CheckpointDateRange,
    parse_checkpoint_date_range,
    query_requests_temporal_filter,
)


REF = datetime(2026, 6, 13, tzinfo=timezone.utc)


def test_query_requests_temporal_filter_positive() -> None:
    assert query_requests_temporal_filter("Any issues of previous month?")
    assert query_requests_temporal_filter("How about april month?")
    assert query_requests_temporal_filter("How about last year?")


def test_query_requests_temporal_filter_negative() -> None:
    assert not query_requests_temporal_filter("Summarize the issues")
    assert not query_requests_temporal_filter("water damage in the garage")


def test_parse_previous_month() -> None:
    parsed = parse_checkpoint_date_range(
        "Any issues of previous month that needs attention?",
        reference_date=REF,
    )
    assert parsed is not None
    assert parsed.label == "May 2026"
    assert parsed.start_utc == datetime(2026, 5, 1, tzinfo=timezone.utc)
    assert parsed.end_utc == datetime(2026, 6, 1, tzinfo=timezone.utc)


def test_parse_named_month() -> None:
    parsed = parse_checkpoint_date_range(
        "How about april month?",
        reference_date=REF,
    )
    assert parsed is not None
    assert parsed.label == "April 2026"


def test_parse_last_year() -> None:
    parsed = parse_checkpoint_date_range(
        "How about last year?",
        reference_date=REF,
    )
    assert parsed is not None
    assert parsed.label == "2025"
    assert parsed.start_utc == datetime(2025, 1, 1, tzinfo=timezone.utc)
    assert parsed.end_utc == datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_list_checkpoints_in_date_range_filters_created_at() -> None:
    in_range = MagicMock()
    in_range.id = "cp-in"
    in_range.to_dict.return_value = {
        "createdAt": "2026-06-08T14:27:46.213Z",
        "location": "Garage",
    }

    mock_query = MagicMock()
    mock_query.stream.return_value = [in_range]
    mock_ref = MagicMock()
    mock_ref.where.return_value.where.return_value.order_by.return_value.limit.return_value = (
        mock_query
    )
    mock_db = MagicMock()
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.collection.return_value = (
        mock_ref
    )

    date_range = CheckpointDateRange(
        start_utc=datetime(2026, 6, 1, tzinfo=timezone.utc),
        end_utc=datetime(2026, 7, 1, tzinfo=timezone.utc),
        label="June 2026",
    )

    with patch("property_agent.checkpoint.retrieval.firestore_checkpoint_list._firestore") as mock_fs:
        mock_fs.FieldFilter = MagicMock(side_effect=lambda field, op, value: (field, op, value))
        mock_fs.Query.DESCENDING = "DESCENDING"
        out = list_checkpoints_in_date_range(
            mock_db,
            user_id="u1",
            property_id="p1",
            date_range=date_range,
        )

    assert len(out["checkpoints"]) == 1
    assert out["temporal_meta"]["label"] == "June 2026"
    assert out["temporal_meta"]["returned_count"] == 1


def test_ask_checkpoints_retrieval_uses_date_range_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    def _fake_temporal(_db, **kwargs):
        captured.update(kwargs)
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
        "property_agent.checkpoint.retrieval.agent.list_checkpoints_in_date_range",
        _fake_temporal,
    )
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.search_checkpoints_by_vector",
        lambda *_a, **_k: pytest.fail("vector search should not run for temporal query"),
    )
    monkeypatch.setattr("property_agent.checkpoint.retrieval.agent._FIRESTORE_CLIENT", MagicMock())

    state = {"user_id": "u1", "current_date_utc": "2026-06-13"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    out = ask_checkpoints_retrieval(
        user_query="Any issues of previous month that needs attention?",
        property_id="p1",
        tool_context=tool_context,
        refine_branch_intents=False,
    )

    assert captured["user_id"] == "u1"
    assert captured["property_id"] == "p1"
    assert captured["date_range"].label == "May 2026"
    assert out["checkpoints"] == []
    assert out["temporal_meta"]["label"] == "May 2026"


def test_prepend_temporal_disclosure_to_blob() -> None:
    blob = prepend_temporal_disclosure_to_blob(
        "Checkpoint Name: Garage",
        {
            "label": "May 2026",
            "start_utc": "2026-05-01T00:00:00+00:00",
            "end_utc": "2026-06-01T00:00:00+00:00",
            "returned_count": 0,
            "scope": "temporal",
        },
    )
    assert blob.startswith("Temporal scope: checkpoints captured during May 2026 (UTC).")
