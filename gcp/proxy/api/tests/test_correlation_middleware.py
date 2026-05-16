import uuid

from common.observability.logging_context import REQUEST_ID_HEADER


def test_health_echoes_request_id(client):
    cid = f"test-{uuid.uuid4()}"
    response = client.get("/health", headers={REQUEST_ID_HEADER: cid})
    assert response.status_code == 200
    assert response.headers.get(REQUEST_ID_HEADER) == cid


def test_health_generates_request_id_when_missing(client):
    response = client.get("/health")
    assert response.status_code == 200
    echoed = response.headers.get(REQUEST_ID_HEADER)
    assert echoed
    uuid.UUID(echoed)
