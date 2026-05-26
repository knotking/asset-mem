"""Tests for OTel checkpoint timing metrics bridge."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from property_agent import checkpoint_timing_metrics as ctm


def test_emit_records_each_phase_and_chars() -> None:
    phase_hist = MagicMock()
    chars_hist = MagicMock()

    def fake_get_histogram(name: str, *, unit: str, description: str):
        if name == ctm.METRIC_PHASE_DURATION_MS:
            return phase_hist
        if name == ctm.METRIC_RESPONSE_CHARS:
            return chars_hist
        return None

    payload = {
        "retrieval_ms": 100,
        "parallel_ms": 2000,
        "diy_ms": 1500,
        "synthesis_ms": 800,
        "doculink_ms": 50,
        "total_ms": 4500,
        "return_chars": 12000,
    }

    with (
        patch.object(ctm, "_METRICS_ENABLED", True),
        patch.object(ctm, "_get_histogram", side_effect=fake_get_histogram),
        patch.object(
            ctm,
            "_base_attributes",
            return_value={"source": "test", "component": "property_agent"},
        ),
    ):
        ctm.emit_checkpoint_timing_metrics(
            payload, source="doculink_after_model", state={}
        )

    assert phase_hist.record.call_count == 6
    recorded_phases = {
        call.kwargs["attributes"]["phase"] for call in phase_hist.record.call_args_list
    }
    assert recorded_phases == {
        "retrieval",
        "parallel",
        "diy",
        "synthesis",
        "doculink",
        "total",
    }
    phase_hist.record.assert_any_call(
        100.0,
        attributes={
            "source": "test",
            "component": "property_agent",
            "phase": "retrieval",
        },
    )
    chars_hist.record.assert_called_once_with(
        12000.0, attributes={"source": "test", "component": "property_agent"}
    )


def test_emit_skips_when_disabled() -> None:
    with (
        patch.object(ctm, "_METRICS_ENABLED", False),
        patch.object(ctm, "_get_histogram") as get_hist,
    ):
        ctm.emit_checkpoint_timing_metrics({"total_ms": 1}, source="x")
    get_hist.assert_not_called()


def test_emit_skips_none_phase_values() -> None:
    phase_hist = MagicMock()

    with (
        patch.object(ctm, "_METRICS_ENABLED", True),
        patch.object(
            ctm,
            "_get_histogram",
            side_effect=lambda name, **_: phase_hist
            if name == ctm.METRIC_PHASE_DURATION_MS
            else None,
        ),
        patch.object(
            ctm,
            "_base_attributes",
            return_value={"source": "t", "component": "property_agent"},
        ),
    ):
        ctm.emit_checkpoint_timing_metrics(
            {"retrieval_ms": None, "total_ms": 500},
            source="t",
        )

    assert phase_hist.record.call_count == 1
    assert phase_hist.record.call_args.kwargs["attributes"]["phase"] == "total"
