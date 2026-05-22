"""Tests for mobile web auth handoff return path validation."""

import pytest
from fastapi import HTTPException

from services.auth_handoff_service import validate_return_path


def test_validate_return_path_accepts_billing_settings():
    assert validate_return_path("/home/settings?tab=billing") == "/home/settings?tab=billing"


def test_validate_return_path_accepts_billing_portal_deep_link():
    assert (
        validate_return_path("/home/settings?tab=billing&portal=1")
        == "/home/settings?tab=billing&portal=1"
    )


def test_validate_return_path_rejects_external():
    with pytest.raises(HTTPException) as exc:
        validate_return_path("https://evil.example/phish")
    assert exc.value.status_code == 400


def test_validate_return_path_rejects_non_home():
    with pytest.raises(HTTPException) as exc:
        validate_return_path("/login")
    assert exc.value.status_code == 400
