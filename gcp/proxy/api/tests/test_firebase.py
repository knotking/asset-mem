import pytest
import os
from unittest.mock import patch, MagicMock

# The client fixture is provided by conftest.py

# Matches the mock secret in conftest.py
FIREBASE_WEBHOOK_SECRET = "test_secret"

@pytest.mark.asyncio
async def test_firebase_webhook_success(client):
    # Mock the service handling the request
    with patch("services.agent_service.handle_firebase_agent_query") as mock_handler:
        mock_handler.return_value = {"status": "success", "message": "Mocked response"}
        
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query",
            json={
                "user_id": "test_user_id",
                "user_query": "Test query",
                "diagnosis_uris": [],
                "context_doc_uris": [],
                "property_address": "",
                "session_id": ""
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"

@pytest.mark.asyncio
async def test_firebase_webhook_no_user_id(client):
    response = client.post(
        f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query",
        json={
            "user_query": "Test query",
            # user_id missing
        }
    )
    # Validation error from Pydantic
    assert response.status_code == 422 

@pytest.mark.asyncio
async def test_firebase_streaming_webhook_success(client):
    # Mock the streaming service
    async def mock_stream_generator(data):
        yield "Mocked stream part 1"
        yield "Mocked stream part 2"

    with patch("services.agent_service.stream_firebase_agent_answers") as mock_stream:
        mock_stream.side_effect = mock_stream_generator
        
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-stream",
            json={
                "user_id": "test_user_id",
                "user_query": "Test stream",
                "session_id": ""
            }
        )
        assert response.status_code == 200
        assert "Mocked stream part 1" in response.text

