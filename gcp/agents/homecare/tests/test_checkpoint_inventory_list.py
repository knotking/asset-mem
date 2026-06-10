"""Tests for checkpoint inventory list retrieval."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from property_agent.checkpoint.analysis.assembler import (
    build_initial_analysis,
    prepend_inventory_disclosure_to_blob,
)
from property_agent.checkpoint.analysis.markdown_render import render_analysis_markdown
from property_agent.checkpoint.retrieval.agent import ask_checkpoints_retrieval
from property_agent.checkpoint.retrieval.firestore_checkpoint_list import (
    format_checkpoint_inventory_disclosure,
    list_recent_property_checkpoints,
)


def test_format_checkpoint_inventory_disclosure_all() -> None:
    assert (
        format_checkpoint_inventory_disclosure(
            {"total_count": 3, "returned_count": 3, "truncated": False}
        )
        == "Showing all 3 checkpoints."
    )


def test_format_checkpoint_inventory_disclosure_truncated() -> None:
    assert (
        format_checkpoint_inventory_disclosure(
            {"total_count": 127, "returned_count": 20, "truncated": True}
        )
        == "Showing the 20 most recent of 127 checkpoints."
    )


def test_list_recent_property_checkpoints_not_truncated() -> None:
    docs = []
    for idx in range(3):
        doc = MagicMock()
        doc.id = f"cp-{idx}"
        doc.to_dict.return_value = {
            "name": f"Checkpoint {idx}",
            "createdAt": f"2026-06-{10 - idx}",
            "analysisStatus": "completed",
        }
        docs.append(doc)

    mock_query = MagicMock()
    mock_query.stream.return_value = docs
    mock_ref = MagicMock()
    mock_ref.order_by.return_value.limit.return_value = mock_query
    mock_db = MagicMock()
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.collection.return_value = (
        mock_ref
    )

    with patch("property_agent.checkpoint.retrieval.firestore_checkpoint_list._firestore") as mock_fs:
        mock_fs.Query.DESCENDING = "DESCENDING"
        out = list_recent_property_checkpoints(
            mock_db, user_id="u1", property_id="p1", limit=20
        )

    assert len(out["checkpoints"]) == 3
    meta = out["inventory_meta"]
    assert meta["total_count"] == 3
    assert meta["returned_count"] == 3
    assert meta["truncated"] is False


def test_list_recent_property_checkpoints_truncated_runs_count() -> None:
    docs = []
    for idx in range(21):
        doc = MagicMock()
        doc.id = f"cp-{idx}"
        doc.to_dict.return_value = {"name": f"Checkpoint {idx}"}
        docs.append(doc)

    mock_query = MagicMock()
    mock_query.stream.return_value = docs
    mock_count = MagicMock()
    mock_count.get.return_value = [[SimpleNamespace(value=55)]]
    mock_ref = MagicMock()
    mock_ref.order_by.return_value.limit.return_value = mock_query
    mock_ref.count.return_value = mock_count
    mock_db = MagicMock()
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.collection.return_value = (
        mock_ref
    )

    with patch("property_agent.checkpoint.retrieval.firestore_checkpoint_list._firestore") as mock_fs:
        mock_fs.Query.DESCENDING = "DESCENDING"
        out = list_recent_property_checkpoints(
            mock_db, user_id="u1", property_id="p1", limit=20
        )

    assert len(out["checkpoints"]) == 20
    meta = out["inventory_meta"]
    assert meta["truncated"] is True
    assert meta["total_count"] == 55


def test_ask_checkpoints_retrieval_uses_inventory_path(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}

    def _fake_list(_db, **kwargs):
        captured.update(kwargs)
        return {
            "checkpoints": [
                {
                    "id": "c1",
                    "name": "Garage",
                    "analysisStatus": "completed",
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
        "property_agent.checkpoint.retrieval.agent.list_recent_property_checkpoints",
        _fake_list,
    )
    monkeypatch.setattr("google.cloud.firestore.Client", lambda: MagicMock())
    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.refine_checkpoint_branch_search_intents",
        lambda *_a, **_k: SimpleNamespace(
            issue_stem="garage paint", to_dict=lambda: {}
        ),
    )

    state: dict = {"user_id": "u1"}
    session = SimpleNamespace(user_id="u1")
    tool_context = SimpleNamespace(
        state=state, _invocation_context=SimpleNamespace(session=session)
    )

    out = ask_checkpoints_retrieval(
        user_query="What checkpoints do I have and what is their current status?",
        property_id="p1",
        tool_context=tool_context,
    )

    assert captured["user_id"] == "u1"
    assert captured["property_id"] == "p1"
    assert len(out["checkpoints"]) == 1
    assert out["inventory_meta"]["total_count"] == 1
    assert "Status: completed" in out["checkpoints"][0]["text"]


def test_inventory_disclosure_in_markdown() -> None:
    analysis = build_initial_analysis(
        checkpoint_results="Checkpoint Name: Garage\nStatus: completed",
        user_query="list my checkpoints",
        requested_branches=[],
        inventory_meta={
            "total_count": 40,
            "returned_count": 20,
            "truncated": True,
            "scope": "recent",
        },
    )
    md = render_analysis_markdown(analysis)
    assert "20 most recent of 40 checkpoints" in md

    blob = prepend_inventory_disclosure_to_blob(
        "Checkpoint Name: Garage",
        {
            "total_count": 40,
            "returned_count": 20,
            "truncated": True,
            "scope": "recent",
        },
    )
    assert blob.startswith("Inventory scope: Showing the 20 most recent of 40 checkpoints.")
