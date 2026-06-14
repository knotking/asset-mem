"""Tests for Phase 4 observability dashboard and turn trace export."""

from __future__ import annotations

import json
from pathlib import Path

from property_agent.evals.observability.build_eval_dashboard import build_dashboard
from property_agent.evals.observability.turn_trace import (
    TRACE_VERSION,
    export_traces_from_logs,
    turn_trace_from_metrics,
)
from property_agent.evals.routing.summarize_weblog_ab import TurnMetrics


_PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_turn_trace_from_metrics_tags() -> None:
    trace = turn_trace_from_metrics(
        TurnMetrics(
            log="web-log-session-1",
            routing_mode="single_loop",
            turn_index=2,
            query="summarize checkpoints",
            route="checkpoint",
            retrieval_only=True,
            tools_called=["analyze_checkpoints"],
            executor_first_model_ms=3200,
            stream_complete_ms=9000,
            substantive=True,
        )
    )
    assert trace.trace_version == TRACE_VERSION
    assert "substantive" in trace.tags
    assert "route:checkpoint" in trace.tags
    assert trace.executor_first_model_ms == 3200


def test_build_eval_dashboard_aggregates_ci_baselines() -> None:
    report = build_dashboard(
        routing_baseline=_PACKAGE_ROOT
        / "property_agent/evals/routing/single_loop/baselines/baseline.json",
        trajectory_baseline=_PACKAGE_ROOT
        / "property_agent/evals/trajectory/baselines/baseline.json",
        guard_baseline=_PACKAGE_ROOT
        / "property_agent/evals/conformance/baselines/guard_baseline.json",
        weblog_ab=_PACKAGE_ROOT
        / "property_agent/evals/routing/single_loop/baselines/weblog-ab-2026-06-11.json",
        routing_cases=_PACKAGE_ROOT
        / "property_agent/evals/routing/single_loop/cases.yaml",
    )
    assert report["phase"] == 4
    assert len(report["suites"]) == 3
    assert report["overall_pass_rate"] == 1.0
    assert "casual" in report["routing_pass_rate_by_tag"]
    assert report["live_latency"]["single_loop_executor_first_model_ms"]["p95"] > 0


def test_export_traces_from_logs_empty_when_missing() -> None:
    report = export_traces_from_logs([Path("/nonexistent/web-log")])
    assert report["total_traces"] == 0
    assert report["traces"] == []


def test_build_eval_dashboard_roundtrip_json() -> None:
    from property_agent.evals.observability.build_eval_dashboard import main

    out = _PACKAGE_ROOT / "property_agent/evals/observability/baselines/_test_dashboard.json"
    try:
        assert main(["--out", str(out)]) == 0
        data = json.loads(out.read_text(encoding="utf-8"))
        assert data["suites"][0]["suite"] == "routing"
    finally:
        if out.is_file():
            out.unlink()
