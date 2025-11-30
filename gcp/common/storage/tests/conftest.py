"""Pytest configuration for Storage tests."""

import os
import pytest
from typing import Generator

@pytest.fixture
def config():
    """Fixture providing StorageConfig for tests."""
    from ..config import StorageConfig
    
    return StorageConfig(
        project_id=os.getenv("GCS_PROJECT_ID", "test-project"),
        bucket_name=os.getenv("GCS_BUCKET_NAME", "test-bucket"),
        location=os.getenv("GCS_LOCATION", "us-central1"),
        timeout=60.0,
    )

