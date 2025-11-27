"""Pytest configuration for Conv AI tests."""

import pytest

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

