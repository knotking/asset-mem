from unittest.mock import patch

import pytest

FIREBASE_WEBHOOK_SECRET = "test_secret"


def test_agent_session_requires_bearer(client, monkeypatch):
    monkeypatch.setattr("core.config.settings.DISABLE_FIREBASE_AUTH", False)
    response = client.post(
        "/agent-session",
        json={"user_id": "attacker_uid"},
    )
    assert response.status_code == 401
    detail = response.json().get("detail")
    if isinstance(detail, dict):
        assert detail.get("code") == "UNAUTHORIZED"


def test_agent_session_uses_verified_uid(client, monkeypatch):
    monkeypatch.setattr("core.config.settings.DISABLE_FIREBASE_AUTH", False)
    with patch("core.firebase_auth.verify_id_token", return_value="verified_uid"), patch(
        "core.firebase_auth_middleware.firebase_auth.verify_id_token",
        return_value="verified_uid",
    ):
        with patch(
            "routers.agent.create_reasoning_engine_session",
            return_value={"id": "sess-1"},
        ):
            response = client.post(
                "/agent-session",
                json={"user_id": "spoofed_uid"},
                headers={"Authorization": "Bearer fake-token"},
            )
    assert response.status_code == 200
    assert response.json().get("id") == "sess-1"


def test_legacy_secret_prefix_still_works(client):
    with patch("services.agent_service.handle_firebase_agent_query") as mock_handler:
        mock_handler.return_value = {"status": "success"}
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query",
            json={
                "user_id": "test_user_id",
                "user_query": "Test query",
                "context_doc_uris": [],
                "property_address": "",
                "session_id": "",
            },
        )
    assert response.status_code == 200
