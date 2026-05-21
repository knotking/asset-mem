from unittest.mock import patch

import pytest

from core.rate_limit import InMemoryRateLimiter, RateLimitRule


def test_in_memory_rate_limiter_blocks_over_max():
    limiter = InMemoryRateLimiter()
    rule = RateLimitRule(max_requests=2, window_seconds=60)

    assert limiter.check("user-a", "agent", rule)[0] is True
    assert limiter.check("user-a", "agent", rule)[0] is True
    allowed, retry = limiter.check("user-a", "agent", rule)
    assert allowed is False
    assert retry is not None and retry >= 1


def test_rate_limit_endpoint_returns_429(client, monkeypatch):
    monkeypatch.setattr("core.config.settings.RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr("core.config.settings.RATE_LIMIT_AGENT_PER_WINDOW", 1)
    monkeypatch.setattr("core.config.settings.RATE_LIMIT_WINDOW_SECONDS", 60)

    with patch("core.firebase_auth.verify_id_token", return_value="rate_test_uid"), patch(
        "core.firebase_auth_middleware.firebase_auth.verify_id_token",
        return_value="rate_test_uid",
    ), patch(
        "routers.agent.create_reasoning_engine_session",
        return_value={"id": "sess-1"},
    ):
        headers = {"Authorization": "Bearer fake-token"}
        first = client.post("/agent-session", json={"user_id": "x"}, headers=headers)
        second = client.post("/agent-session", json={"user_id": "x"}, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 429
    detail = second.json().get("detail")
    if isinstance(detail, dict):
        assert detail.get("code") == "RATE_LIMIT_EXCEEDED"
