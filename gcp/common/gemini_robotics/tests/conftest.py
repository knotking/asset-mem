"""Pytest configuration for Gemini Robotics tests."""

import os
import pytest
from typing import Generator

@pytest.fixture
def config():
    """Fixture providing GeminiRoboticsConfig for tests."""
    from ..config import GeminiRoboticsConfig
    
    return GeminiRoboticsConfig(
        project_id=os.getenv("GEMINI_PROJECT_ID", "test-project"),
        location=os.getenv("GEMINI_LOCATION", "us-central1"),
        api_key=os.getenv("GEMINI_API_KEY"),
        use_vertex_ai=bool(os.getenv("GEMINI_PROJECT_ID")),
        timeout=60.0,
        model=os.getenv("GEMINI_ROBOTICS_MODEL", "gemini-robotics-er-1.5-preview"),
    )

