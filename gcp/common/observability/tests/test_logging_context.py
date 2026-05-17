import logging

from common.observability.logging_context import (
    auth_uid_scope,
    bind_auth_uid,
    correlation_id_scope,
    extract_auth_uid_from_json_dict,
    extract_correlation_id_from_json_dict,
    get_correlation_id,
    install_auth_uid_logging,
    parse_json_auth_uid_from_body,
    pubsub_payload_with_correlation,
    request_context_scope,
    resolve_correlation_id,
    unbind_auth_uid,
)


def test_extract_auth_uid_from_json_dict():
    assert extract_auth_uid_from_json_dict({"user_id": "a"}) == "a"
    assert extract_auth_uid_from_json_dict({"userId": "b"}) == "b"
    assert extract_auth_uid_from_json_dict({"context": {"userId": "c"}}) == "c"
    assert extract_auth_uid_from_json_dict({}) is None


def test_parse_json_auth_uid_from_body():
    assert parse_json_auth_uid_from_body(b'{"user_id":"x"}') == "x"
    assert parse_json_auth_uid_from_body(b"not json") is None


def test_auth_uid_scope_log_record():
    install_auth_uid_logging(level=logging.INFO)
    root = logging.getLogger()
    records: list[logging.LogRecord] = []

    class Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    h = Capture()
    h.setLevel(logging.INFO)
    root.addHandler(h)
    try:
        with auth_uid_scope("user-1"):
            logging.getLogger("obs.test").info("inside")
    finally:
        root.removeHandler(h)

    assert records
    assert getattr(records[0], "auth_uid", None) == "user-1"


def test_bind_nested_unbind_order():
    install_auth_uid_logging(level=logging.INFO)
    bind_auth_uid("outer")
    bind_auth_uid("inner")
    unbind_auth_uid()
    from common.observability import logging_context as lc

    assert lc.get_auth_uid() == "outer"
    unbind_auth_uid()
    assert lc.get_auth_uid() is None


def test_resolve_correlation_id():
    assert resolve_correlation_id("client-req-abc") == "client-req-abc"
    assert resolve_correlation_id("  trimmed-id  ") == "trimmed-id"
    generated = resolve_correlation_id(None)
    assert len(generated) == 36
    assert resolve_correlation_id("bad id with spaces") != "bad id with spaces"


def test_extract_correlation_id_from_json_dict():
    assert extract_correlation_id_from_json_dict({"correlation_id": "req-1"}) == "req-1"
    assert extract_correlation_id_from_json_dict({"correlationId": "req-2"}) == "req-2"
    assert (
        extract_correlation_id_from_json_dict({"metadata": {"request_id": "req-3"}})
        == "req-3"
    )
    assert extract_correlation_id_from_json_dict({"correlation_id": "bad id"}) is None


def test_pubsub_payload_with_correlation():
    with correlation_id_scope("parent-req"):
        out = pubsub_payload_with_correlation({"userId": "u1"})
    assert out["correlation_id"] == "parent-req"
    assert out["userId"] == "u1"


def test_request_context_scope():
    with request_context_scope("user-9", "req-9"):
        from common.observability import logging_context as lc

        assert lc.get_auth_uid() == "user-9"
        assert lc.get_correlation_id() == "req-9"
    assert get_correlation_id() is None


def test_correlation_id_scope_log_record():
    install_auth_uid_logging(level=logging.INFO)
    root = logging.getLogger()
    records: list[logging.LogRecord] = []

    class Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    h = Capture()
    h.setLevel(logging.INFO)
    root.addHandler(h)
    try:
        with correlation_id_scope("req-42"):
            logging.getLogger("obs.test").info("inside")
    finally:
        root.removeHandler(h)

    assert records
    assert getattr(records[0], "correlation_id", None) == "req-42"
