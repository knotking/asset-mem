"""
Aggregate CI eval baselines + optional weblog latency into one dashboard JSON.

No Vertex calls. Reads committed baseline artifacts from Phases 1–3.

Usage:
    uv run python -m property_agent.evals.observability.build_eval_dashboard
    uv run python -m property_agent.evals.observability.build_eval_dashboard \\
        --weblog-ab property_agent/evals/routing/single_loop/baselines/weblog-ab-2026-06-11.json \\
        --out property_agent/evals/observability/baselines/dashboard.json
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path
from typing import Any

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]

DEFAULT_SOURCES = {
    "routing": _PACKAGE_ROOT
    / "property_agent/evals/routing/single_loop/baselines/baseline.json",
    "trajectory": _PACKAGE_ROOT
    / "property_agent/evals/trajectory/baselines/baseline.json",
    "conformance_guard": _PACKAGE_ROOT
    / "property_agent/evals/conformance/baselines/guard_baseline.json",
}
DEFAULT_WEBLOG_AB = (
    _PACKAGE_ROOT
    / "property_agent/evals/routing/single_loop/baselines/weblog-ab-2026-06-11.json"
)
DEFAULT_OUT = Path(__file__).resolve().parent / "baselines" / "dashboard.json"


def _load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _suite_summary(doc: dict[str, Any], *, name: str) -> dict[str, Any]:
    summary = doc.get("summary") or {}
    return {
        "suite": name,
        "generated_at": doc.get("generated_at"),
        "total": summary.get("total"),
        "passed": summary.get("passed"),
        "failed": summary.get("failed"),
        "pass_rate": summary.get("pass_rate"),
        "latency_ms": summary.get("latency_ms"),
        "field_mismatch_counts": summary.get("field_mismatch_counts"),
    }


def _routing_pass_rate_by_tag(doc: dict[str, Any], cases_path: Path) -> dict[str, float]:
    """Compute pass rate per routing case tag from baseline results + cases.yaml."""
    import yaml

    if not cases_path.is_file():
        return {}
    cases_doc = yaml.safe_load(cases_path.read_text(encoding="utf-8")) or {}
    case_tags: dict[str, list[str]] = {}
    for case in cases_doc.get("cases") or []:
        case_id = str(case.get("id") or "")
        tags = [str(t) for t in (case.get("tags") or [])]
        case_tags[case_id] = tags

    results = doc.get("results") or []
    by_tag: dict[str, list[bool]] = {}
    for row in results:
        case_id = str(row.get("case_id") or "")
        passed = bool(row.get("passed"))
        tags = case_tags.get(case_id) or ["untagged"]
        for tag in tags:
            by_tag.setdefault(tag, []).append(passed)

    return {
        tag: round(sum(1 for p in vals if p) / len(vals), 4)
        for tag, vals in sorted(by_tag.items())
        if vals
    }


def _latency_from_weblog_ab(doc: dict[str, Any]) -> dict[str, Any]:
    single_loop = doc.get("single_loop") or {}
    stream = single_loop.get("substantive_stream_complete_ms") or {}

    executor_values = [
        int(t["executor_first_model_ms"])
        for t in doc.get("turns") or []
        if isinstance(t, dict)
        and t.get("routing_mode") == "single_loop"
        and t.get("executor_first_model_ms") is not None
    ]
    executor_summary = _latency_summary_from_values(executor_values)

    return {
        "source": doc.get("source_logs"),
        "single_loop_executor_first_model_ms": executor_summary,
        "single_loop_substantive_stream_complete_ms": stream,
        "paired_session_1_count": len(doc.get("paired_session_1") or []),
    }


def _latency_summary_from_values(values: list[int]) -> dict[str, int]:
    if not values:
        return {"p50": 0, "p95": 0, "mean": 0}
    ordered = sorted(values)
    p50_idx = len(ordered) // 2
    p95_idx = max(0, round(0.95 * (len(ordered) - 1)))
    return {
        "p50": ordered[p50_idx],
        "p95": ordered[p95_idx],
        "mean": round(statistics.fmean(ordered)),
    }


def build_dashboard(
    *,
    routing_baseline: Path,
    trajectory_baseline: Path,
    guard_baseline: Path,
    weblog_ab: Path | None,
    routing_cases: Path,
) -> dict[str, Any]:
    routing_doc = _load_json(routing_baseline)
    trajectory_doc = _load_json(trajectory_baseline)
    guard_doc = _load_json(guard_baseline)
    weblog_doc = _load_json(weblog_ab) if weblog_ab else {}

    suites = [
        _suite_summary(routing_doc, name="routing"),
        _suite_summary(trajectory_doc, name="trajectory"),
        _suite_summary(guard_doc, name="conformance_guard"),
    ]
    pass_rates = [s["pass_rate"] for s in suites if isinstance(s.get("pass_rate"), (int, float))]
    overall_pass_rate = round(statistics.fmean(pass_rates), 4) if pass_rates else None

    report: dict[str, Any] = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "phase": 4,
        "suites": suites,
        "overall_pass_rate": overall_pass_rate,
        "routing_pass_rate_by_tag": _routing_pass_rate_by_tag(
            routing_doc, routing_cases
        ),
    }
    if weblog_doc:
        report["live_latency"] = _latency_from_weblog_ab(weblog_doc)
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build Phase 4 eval dashboard JSON")
    parser.add_argument("--routing-baseline", type=Path, default=DEFAULT_SOURCES["routing"])
    parser.add_argument(
        "--trajectory-baseline", type=Path, default=DEFAULT_SOURCES["trajectory"]
    )
    parser.add_argument("--guard-baseline", type=Path, default=DEFAULT_SOURCES["conformance_guard"])
    parser.add_argument("--weblog-ab", type=Path, default=DEFAULT_WEBLOG_AB)
    parser.add_argument(
        "--routing-cases",
        type=Path,
        default=_PACKAGE_ROOT / "property_agent/evals/routing/single_loop/cases.yaml",
    )
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args(argv)

    weblog_path = args.weblog_ab if args.weblog_ab.is_file() else None
    report = build_dashboard(
        routing_baseline=args.routing_baseline,
        trajectory_baseline=args.trajectory_baseline,
        guard_baseline=args.guard_baseline,
        weblog_ab=weblog_path,
        routing_cases=args.routing_cases,
    )

    payload = json.dumps(report, indent=2, sort_keys=True)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload + "\n", encoding="utf-8")
        print(f"Wrote {args.out}")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
