"""Pytest configuration for Gemini File Search tests."""

import pytest
import os

# Configure pytest-asyncio mode
pytest_plugins = ["pytest_asyncio"]


def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (requires real credentials)"
    )


@pytest.fixture
def mock_config():
    """Create a mock configuration for testing."""
    from ..config import GeminiFileSearchConfig
    
    return GeminiFileSearchConfig(
        project_id=os.getenv("GEMINI_PROJECT_ID", "test-project"),
        location=os.getenv("GEMINI_LOCATION", "us-central1"),
        api_key=os.getenv("GEMINI_API_KEY"),
        use_vertex_ai=bool(os.getenv("GEMINI_PROJECT_ID")),
        timeout=60.0,
    )

