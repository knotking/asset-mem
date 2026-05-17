"""Helpers for propagating correlation ids through Pub/Sub."""

from __future__ import annotations

import json
from typing import Any

from .logging_context import (
    extract_correlation_id_from_json_dict,
    get_correlation_id,
    pubsub_payload_with_correlation,
    request_context_scope,
)

__all__ = [
    "extract_correlation_id_from_json_dict",
    "get_correlation_id",
    "pubsub_payload_with_correlation",
    "publish_json_with_correlation",
    "worker_request_scope",
]


def worker_request_scope(payload: dict[str, Any]):
    """Context manager: bind user id + correlation id from a Pub/Sub JSON payload."""
    uid = extract_auth_uid_from_payload(payload)
    cid = extract_correlation_id_from_json_dict(payload)
    return request_context_scope(uid, cid)


def extract_auth_uid_from_payload(payload: dict[str, Any]) -> str | None:
    from .logging_context import extract_auth_uid_from_json_dict

    return extract_auth_uid_from_json_dict(payload)


def publish_json_with_correlation(
    publisher: Any,
    topic_path: str,
    payload: dict[str, Any],
) -> str:
    """Publish JSON bytes, forwarding the active correlation id when present."""
    data = json.dumps(pubsub_payload_with_correlation(payload)).encode("utf-8")
    return publisher.publish(topic_path, data).result()
