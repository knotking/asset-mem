from unittest.mock import patch


def test_health_ok_when_reasoning_engine_ready(client):
    with patch("main.reasoning_engine_resource", object()):
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json().get("status") == "ok"


def test_health_503_when_reasoning_engine_missing(client):
    with patch("main.reasoning_engine_resource", None):
        response = client.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body.get("status") == "unavailable"
    assert body.get("reason") == "reasoning_engine_not_initialized"
