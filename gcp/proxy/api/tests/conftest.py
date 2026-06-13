import pytest
import os
import sys
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

# Add the parent directory to sys.path to import main
_api_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(_api_dir)

from bootstrap_agent_platform import ensure_agent_platform_on_path

ensure_agent_platform_on_path()

_gcp_root = os.path.dirname(os.path.dirname(_api_dir))
if os.path.isdir(os.path.join(_api_dir, "agent_platform")) and _api_dir not in sys.path:
    sys.path.insert(0, _api_dir)
elif os.path.isdir(os.path.join(_gcp_root, "agent_platform")) and _gcp_root not in sys.path:
    sys.path.insert(0, _gcp_root)

# Set before importing main so core.config.Settings picks them up.
os.environ["FIREBASE_WEBHOOK_SECRET"] = "test_secret"
os.environ["TELEGRAM_WEBHOOK_SECRET"] = "test_telegram_secret"
os.environ["DISABLE_FIREBASE_AUTH"] = "true"

from main import app


@pytest.fixture(scope="module")
def client():
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

