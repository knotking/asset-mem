"""Tests for compare-checkpoints token quota enforcement."""

from unittest.mock import patch

import pytest

from common.token import TokenQuotaExceeded
from schemas.checkpoint import CheckpointComparisonResponse


@pytest.fixture
def compare_payload():
    return {
        "image1Url": "gs://bucket/prev.jpg",
        "image2Url": "gs://bucket/curr.jpg",
        "contentType1": "image/jpeg",
        "contentType2": "image/jpeg",
        "location": "Kitchen",
    }


@patch("routers.checkpoint.persist_firestore_token_totals")
@patch("routers.checkpoint.compare_checkpoints")
@patch("routers.checkpoint.check_token_quota_or_raise")
@patch("routers.checkpoint.firestore.Client")
def test_compare_checkpoints_blocks_when_token_quota_exceeded(
    _mock_fs_client,
    mock_check,
    mock_compare,
    mock_persist,
    client,
    monkeypatch,
    compare_payload,
):
    monkeypatch.setattr("core.config.settings.DISABLE_FIREBASE_AUTH", False)
    mock_check.side_effect = TokenQuotaExceeded(
        used=1_000_000, limit=1_000_000, period_key="2026-06"
    )

    with (
        patch("core.firebase_auth.verify_id_token", return_value="user-1"),
        patch(
            "core.firebase_auth_middleware.firebase_auth.verify_id_token",
            return_value="user-1",
        ),
    ):
        response = client.post(
            "/compare-checkpoints",
            json=compare_payload,
            headers={"Authorization": "Bearer fake-token"},
        )

    assert response.status_code == 429
    assert response.json()["code"] == "TOKEN_QUOTA_EXCEEDED"
    mock_compare.assert_not_called()
    mock_persist.assert_not_called()


@patch("routers.checkpoint.persist_firestore_token_totals")
@patch("routers.checkpoint.compare_checkpoints")
@patch("routers.checkpoint.check_token_quota_or_raise")
@patch("routers.checkpoint.firestore.Client")
def test_compare_checkpoints_persists_token_usage_after_gemini(
    _mock_fs_client,
    mock_check,
    mock_compare,
    mock_persist,
    client,
    monkeypatch,
    compare_payload,
):
    monkeypatch.setattr("core.config.settings.DISABLE_FIREBASE_AUTH", False)
    mock_check.return_value = None
    mock_compare.return_value = CheckpointComparisonResponse(
        summary="Minor wear",
        similarityScore=0.92,
        semanticChanges=["scuff on floor"],
        regions=[],
    )

    with (
        patch("core.firebase_auth.verify_id_token", return_value="user-1"),
        patch(
            "core.firebase_auth_middleware.firebase_auth.verify_id_token",
            return_value="user-1",
        ),
    ):
        response = client.post(
            "/compare-checkpoints",
            json=compare_payload,
            headers={"Authorization": "Bearer fake-token"},
        )

    assert response.status_code == 200
    assert response.json()["similarityScore"] == 0.92
    mock_check.assert_called_once()
    mock_compare.assert_called_once()
    usage_sink = mock_compare.call_args.kwargs["usage_sink"]
    assert usage_sink is not None
    mock_persist.assert_called_once_with(
        "user-1",
        usage_sink,
        worker_llm_call_increment=usage_sink.get("gemini_calls", 0),
    )
