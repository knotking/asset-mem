"""Tests for checkpoint_request_timing structured log emission."""

from unittest.mock import MagicMock, patch

from property_agent.sub_agents import checkpoint_request_timing as crt


def test_emit_logs_single_structured_line():
    state: dict = {}
    crt.begin_checkpoint_request(state)
    crt.record_retrieval_ms(state, 6000)
    crt.record_parallel_ms(state, 24000)
    crt.record_diy_ms(state, 19000)
    crt.record_synthesis_ms(state, 5000)
    crt.begin_executor_phase(state)
    crt.record_executor_ms(state, 800)

    logger = MagicMock()
    crt.logger = logger

    with patch(
        "property_agent.checkpoint_timing_metrics.emit_checkpoint_timing_metrics"
    ) as emit_metrics:
        crt.emit_checkpoint_request_timing(state, return_chars=11832, source="test")

    assert crt.timing_already_emitted(state)
    logger.info.assert_called_once()
    emit_metrics.assert_called_once()
    metrics_payload = emit_metrics.call_args[0][0]
    assert metrics_payload["retrieval_ms"] == 6000
    assert metrics_payload["return_chars"] == 11832
    assert emit_metrics.call_args.kwargs["source"] == "test"
    message = logger.info.call_args[0][0]
    assert message == "checkpoint_request_timing: %s source=%s"
    parts = logger.info.call_args[0][1]
    assert "retrieval_ms=6000" in parts
    assert "parallel_ms=24000" in parts
    assert "diy_ms=19000" in parts
    assert "synthesis_ms=5000" in parts
    assert "doculink_ms=800" in parts
    assert "return_chars=11832" in parts
    assert "total_ms=" in parts


def test_emit_is_idempotent():
    state: dict = {}
    crt.begin_checkpoint_request(state)
    crt.record_retrieval_ms(state, 100)

    logger = MagicMock()
    crt.logger = logger

    crt.emit_checkpoint_request_timing(state, return_chars=50, source="a")
    crt.emit_checkpoint_request_timing(state, return_chars=99, source="b")

    assert logger.info.call_count == 1


def test_record_parallel_sets_synthesis_start():
    state: dict = {}
    crt.record_parallel_ms(state, 1000)
    data = state[crt.CHECKPOINT_REQUEST_TIMING_STATE_KEY]
    assert data["parallel_ms"] == 1000
    assert data["synthesis_started_at"] is not None
