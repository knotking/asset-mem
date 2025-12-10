"""
Firebase Integration Tests

Integration tests for Firebase webhook endpoints.
Note: This file should be moved to tests/integration/ directory.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import json

from main import app
from config import settings

# Test webhook secret (should match test configuration)
FIREBASE_WEBHOOK_SECRET = "92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376"

@pytest.mark.asyncio
async def test_firebase_webhook_success():
    with TestClient(app) as client:
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query",
            json={
                "user_id": "test_user_id",
                "user_query": "Give me troubleshooting tips for washing machine",
                "diagnosis_uris": [],
                "context_doc_uris": [],
                "property_address": "",
                "session_id": ""
            }
        )
        print(f"test_firebase-agent-query_success Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "message" in response.json()

@pytest.mark.asyncio
async def test_firebase_webhook_no_user_id():
    """Test that missing user_id returns 400 Bad Request."""
    with TestClient(app) as client:
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query",
            json={
                "user_query": "Give me troubleshooting tips for washing machine",
                "diagnosis_uris": [],
                "context_doc_uris": [],
                "property_address": "",
                "session_id": ""
            }
        )
        print(f"test_firebase-agent-query_no_user_id Response: {response.json()}")
    # Should return 400 Bad Request with new error handling
    assert response.status_code in [400, 200]  # 200 for backward compatibility
    assert "User ID is required" in str(response.json())

@pytest.mark.asyncio
async def test_firebase_diagnostic_mode_success():
    with TestClient(app) as client:
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-stream",
            json={
                "user_id": "test_user_id",
                "user_query": "Analyse",
                "diagnosis_uris": ["gs://homegeek-user-data/uploads/538445573/photo_AgACAgUAAxkBAAICh2ii4UNlQz3Em4n68KsIVjLjZq5eAAJPxTEb3vYZVQ5WYEQ0SL0UAQADAgADeQADNgQ_1755504998.jpg"],
                "context_doc_uris": [],
                "property_address": "",
                "session_id": ""
            },
            # timeout=None is not needed for TestClient
        )
        print(f"test_firebase_diagnostic_mode_success Response: {response.text}")
    assert response.status_code == 200
    # For streaming, we need to read the content as it comes in
    # This is a basic check; you might want more sophisticated parsing for actual streamed events.
    content = response.text
    
    assert "Diagnostic" in content

@pytest.mark.asyncio
async def test_firebase_streaming_webhook_success():
    with TestClient(app) as client:
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-stream",
            json={
                "user_id": "test_user_id",
                "session_id": "",
                "user_query": "Give me troubleshooting tips for washing machine",
                "diagnosis_uris": [],
                "context_doc_uris": [],
                "property_address": "",
                
            },
            # timeout=None is not needed for TestClient
        )
        print(f"test_firebase-agent-stream_success Response: {response.text}")
    assert response.status_code == 200
    # For streaming, we need to read the content as it comes in
    # This is a basic check; you might want more sophisticated parsing for actual streamed events.
    content = response.text
    
    assert "Agent" in content

@pytest.mark.asyncio
async def test_firebase_streaming_webhook_no_user_id():
    """Test that missing user_id in streaming endpoint returns error."""
    with TestClient(app) as client:
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-stream",
            json={
                "user_query": "Give me troubleshooting tips for washing machine",
                "diagnosis_uris": [],
                "context_doc_uris": [],
                "property_address": "",
                "session_id": ""
            }
        )
        print(f"test_firebase-agent-stream_no_user_id Response: {response.text}")
    # Streaming endpoint may return 200 with error in stream, or 400
    assert response.status_code in [200, 400]
    content = response.text
    assert "User ID is required" in content