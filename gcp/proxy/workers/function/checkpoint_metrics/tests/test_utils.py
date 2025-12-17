import base64
import json

from utils import parse_pubsub_message


def test_parse_pubsub_message_ok():
    payload = {"userId": "u1", "propertyId": "p1"}
    msg = {"data": base64.b64encode(json.dumps(payload).encode("utf-8"))}
    assert parse_pubsub_message(msg) == payload


def test_parse_pubsub_message_missing_or_bad():
    assert parse_pubsub_message({}) == {}
    assert parse_pubsub_message({"data": b"not-base64"}) == {}


