from __future__ import annotations

from unittest.mock import MagicMock, patch

from services.checkpoint_service import (
    load_checkpoint_analysis_enqueue_context,
    publish_checkpoint_analysis,
)
from schemas.checkpoint import AnalyzeCheckpointRequest


def test_load_enqueue_context_extracts_checkpoint_comparison():
    db = MagicMock()
    prefs_doc = MagicMock()
    prefs_doc.exists = True
    prefs_doc.to_dict.return_value = {
        "checkpointComparison": {
            "enabled": False,
            "maxAgeDays": 90,
            "minAssetConfidence": 0.5,
        }
    }
    db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = (
        prefs_doc
    )

    context = load_checkpoint_analysis_enqueue_context(db, "user-1")

    assert context["checkpointComparison"]["enabled"] is False
    assert context["checkpointComparison"]["maxAgeDays"] == 90


def test_load_enqueue_context_empty_when_prefs_missing():
    db = MagicMock()
    prefs_doc = MagicMock()
    prefs_doc.exists = False
    db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = (
        prefs_doc
    )

    context = load_checkpoint_analysis_enqueue_context(db, "user-1")

    assert context == {}


@patch("services.checkpoint_service.pubsub_v1.PublisherClient")
def test_publish_checkpoint_analysis_includes_comparison_prefs(mock_publisher_cls):
    publisher = MagicMock()
    future = MagicMock()
    future.result.return_value = "msg-123"
    publisher.publish.return_value = future
    publisher.topic_path.return_value = "projects/p/topics/t"
    mock_publisher_cls.return_value = publisher

    request = AnalyzeCheckpointRequest(
        imageUrl="gs://bucket/a.jpg",
        contentType="image/jpeg",
        checkpointId="cp-1",
        userId="user-1",
        propertyId="prop-1",
    )
    enqueue_context = {
        "checkpointComparison": {"enabled": True, "maxAgeDays": 120},
    }

    message_id = publish_checkpoint_analysis(request, enqueue_context=enqueue_context)

    assert message_id == "msg-123"
    published_data = publisher.publish.call_args[0][1]
    import json

    payload = json.loads(published_data.decode("utf-8"))
    assert payload["checkpointComparison"]["maxAgeDays"] == 120
