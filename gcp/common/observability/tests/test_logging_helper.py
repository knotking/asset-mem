import json
from unittest.mock import patch

from common.observability import logging_helper as lh
from common.observability.logging_context import firebase_uid_scope
from common.observability.logging_helper import log_event


def test_log_event_adds_firebase_uid_to_body_json():
    captured: list[str] = []

    def capture_info(msg: str, *args, **kwargs) -> None:
        captured.append(msg)

    with firebase_uid_scope("firebase-ctx-uid"):
        with patch.object(lh.logger, "info", side_effect=capture_info):
            log_event("test.event", {"foo": 1})

    assert len(captured) == 1
    payload = json.loads(captured[0])
    assert payload["body"]["event_type"] == "test.event"
    assert payload["body"]["foo"] == 1
    assert payload["body"]["firebase_uid"] == "firebase-ctx-uid"


def test_log_event_body_firebase_uid_wins_over_context():
    captured: list[str] = []

    def capture_info(msg: str, *args, **kwargs) -> None:
        captured.append(msg)

    with firebase_uid_scope("from-context"):
        with patch.object(lh.logger, "info", side_effect=capture_info):
            log_event("test.event", {"firebase_uid": "explicit-uid"})

    payload = json.loads(captured[0])
    assert payload["body"]["firebase_uid"] == "explicit-uid"


def test_log_event_no_firebase_uid_when_context_unset():
    captured: list[str] = []

    def capture_info(msg: str, *args, **kwargs) -> None:
        captured.append(msg)

    with patch.object(lh.logger, "info", side_effect=capture_info):
        log_event("test.event", {"bar": 2})

    payload = json.loads(captured[0])
    assert "firebase_uid" not in payload["body"]
