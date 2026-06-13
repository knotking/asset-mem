"""Tests for vector similarity threshold filtering."""

from __future__ import annotations

from unittest.mock import MagicMock

from property_agent.checkpoint.retrieval.firestore_vector_search import (
    search_checkpoints_by_vector,
)


def test_vector_search_drops_results_below_min_similarity(
    monkeypatch,
) -> None:
    class _FakeDoc:
        def __init__(self, doc_id: str, vector_distance: float):
            self.id = doc_id
            self._distance = vector_distance

        def to_dict(self):
            return {"vector_distance": self._distance, "aiAnalysis": {"summary": "x"}}

    class _FakeStream:
        def stream(self):
            return iter(
                [
                    _FakeDoc("weak", 0.7),  # similarity 0.3
                    _FakeDoc("strong", 0.2),  # similarity 0.8
                ]
            )

    monkeypatch.setattr(
        "property_agent.checkpoint.retrieval.firestore_vector_search.generate_query_embedding",
        lambda _q: [0.1] * 768,
    )

    fake_ref = MagicMock()
    fake_ref.find_nearest.return_value = _FakeStream()

    fake_db = MagicMock()
    fake_db.collection.return_value.document.return_value.collection.return_value.document.return_value.collection.return_value = (
        fake_ref
    )

    results = search_checkpoints_by_vector(
        fake_db,
        user_id="u1",
        property_id="p1",
        query_text="garage paint",
        limit=5,
        min_similarity=0.5,
    )

    assert len(results) == 1
    assert results[0]["id"] == "strong"
    assert results[0]["similarity_score"] == 0.8
