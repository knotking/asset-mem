"""Tests for checkpoint pipeline session input staging."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from property_agent.checkpoint.session_input import (
    apply_session_checkpoint_ids_to_tool_args,
    checkpoint_ids_for_pipeline_from_state,
)


def test_checkpoint_ids_for_pipeline_from_state_normalizes() -> None:
    state = {"checkpoint_ids": ["  abc123  ", "", None, "def456"]}
    assert checkpoint_ids_for_pipeline_from_state(state) == ["abc123", "def456"]


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
        def exists(self) -> bool:
            return False

        def to_dict(self) -> dict:
            return {}

    class _CheckpointRef:
        def document(self, _doc_id: str) -> "_CheckpointRef":
            return self

        def get(self) -> _Doc:
            return _Doc()

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

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.agent.search_checkpoints_by_vector",
        _fake_vector,
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

    out = ask_checkpoints_retrieval(
        user_query="Are there any issues in the garage?",
        property_id="p1",
        checkpoint_ids=["garage"],
        tool_context=tool_context,
    )

    assert vector_called["query_text"] == "Are there any issues in the garage?"
    assert len(out["checkpoints"]) == 1
    assert out["checkpoints"][0]["checkpointId"] == "ZCeYq22NbWJynQBmlmyt"
