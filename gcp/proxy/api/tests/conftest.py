import pytest
import os
import sys
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

# Add the parent directory to sys.path to import main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

@pytest.fixture(scope="module")
def client():
    # Mock environment variables if needed
    os.environ["FIREBASE_WEBHOOK_SECRET"] = "test_secret"
    os.environ["TELEGRAM_WEBHOOK_SECRET"] = "test_telegram_secret"
    
    with TestClient(app) as c:
        yield c

@pytest.fixture(autouse=True)
def mock_external_services(monkeypatch):
    """
    Mock external services like Vertex AI, Firebase Admin, etc.
    to prevent tests from hitting real APIs.
    """
    # Mock Vertex Service
    monkeypatch.setattr("services.vertex_service.reasoning_engine_resource", MagicMock())
    
    # Mock Firebase Admin (if initialized at module level, this might need more work)
    monkeypatch.setattr("firebase_admin.initialize_app", MagicMock())
    
    # Add more mocks as needed

