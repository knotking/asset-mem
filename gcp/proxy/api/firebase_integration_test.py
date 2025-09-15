# gcp/proxy/tests/firebase_integration_test.py
import pytest
from fastapi.testclient import TestClient # Use TestClient from fastapi.testclient
from unittest.mock import patch, MagicMock
import json
#import os
#
# Adjust the import path based on your project structure
from main import app
FIREBASE_WEBHOOK_SECRET = "92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376"
# Mock Firebase Admin SDK for testing
# @pytest.fixture(autouse=True)
# def mock_firebase_admin():
#     with patch("firebase_admin.auth.verify_id_token") as mock_verify_id_token:
#         mock_verify_id_token.return_value = {"uid": "test_user_id"}
#         yield

# # Mock Vertex AI client logic
# @pytest.fixture(autouse=True)
# def mock_vertex_client():
#     with patch("gcp.proxy.api.vertex_client.reasoning_engine_resource", MagicMock()) as mock_re_resource:
#         with patch("gcp.proxy.api.vertex_client.stream_agent_answers") as mock_stream_agent_answers:
#             # Configure mock_re_resource if needed, for now just ensure it's not None
#             mock_re_resource.is_initialized = True # Example of setting an attribute

#             async def async_generator():
#                 yield "Mocked agent response part 1"
#                 yield "Mocked agent response part 2"

#             mock_stream_agent_answers.return_value = async_generator()
#             yield

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
    with TestClient(app) as client:
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query",
            json={"user_query": "Give me troubleshooting tips for washing machine",
                "diagnosis_uris": [],
                "context_doc_uris": [],
                "property_address": "",
                "session_id": ""
            }
        )
        print(f"test_firebase-agent-query_no_user_id Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "error"
    assert "User ID is required" in response.json()["message"]

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
    with TestClient(app) as client:
        response = client.post(
            f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-stream",
            json={"user_query": "Give me troubleshooting tips for washing machine",
                "diagnosis_uris": [],
                "context_doc_uris": [],
                "property_address": "",
                "session_id": ""
            },
            # timeout=None is not needed for TestClient
        )
        print(f"test_firebase-agent-stream_no_user_id Response: {response.text}")
    assert response.status_code == 200
    content = response.text
    assert "User ID is required" in content