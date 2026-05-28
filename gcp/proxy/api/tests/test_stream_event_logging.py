"""Tests for compact Reasoning Engine stream event log summaries."""

from services.vertex_service import (
    _stream_event_kind,
    stream_event_log_summary,
)


def test_stream_event_kind_function_call():
    event = {
        "author": "property_agent",
        "content": {"parts": [{"function_call": {"name": "run_checkpoint_pipeline"}}]},
    }
    assert _stream_event_kind(event) == "function_call:run_checkpoint_pipeline"


def test_stream_event_kind_checkpoint_progress():
    event = {
        "author": "checkpoint_analysis_progress",
        "content": {"parts": [{"text": "_Progress 1/4 — running: diy._"}]},
        "actions": {
            "state_delta": {
                "checkpoint_branch_completed": "coverage",
                "checkpoint_analysis": {
                    "analysis": {
                        "analysisStatus": {"coverage": "completed", "diy": "running"},
                    }
                },
            }
        },
    }
    summary = stream_event_log_summary(event)
    assert summary["kind"] == "checkpoint_progress"
    assert summary["branch_completed"] == "coverage"
    assert summary["analysis_status"] == {
        "coverage": "completed",
        "diy": "running",
    }
