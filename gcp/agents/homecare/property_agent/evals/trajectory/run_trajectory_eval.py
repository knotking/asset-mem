"""
Trajectory eval: routing + deterministic executor tool-choice planner.

No Vertex LLM. Reuses single-loop routing from ``run_routing_eval`` and scores
tool trajectories via ``predict_trajectory``.

Schema validation: ``tests/test_trajectory_eval_cases.py``.

Usage:
    uv run python -m property_agent.evals.trajectory.run_trajectory_eval
    uv run python -m property_agent.evals.trajectory.run_trajectory_eval --baseline-check
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

from property_agent.evals.routing.run_routing_eval import (
    build_state,
    resolve_turn_single_loop,
)
from property_agent.evals.trajectory.predict_trajectory import (
    infer_content_json_flags,
    predict_trajectory,
)

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CASES_PATH = Path(__file__).resolve().parent / "cases.yaml"
DEFAULT_BASELINE_PATH = Path(__file__).resolve().parent / "baselines" / "baseline.json"

KNOWN_EXPECT_FIELDS = (
    "tools_called",
    "branches",
    "retrieval_only",
    "content_json_present",
    "content_json_absent",
)


def load_cases(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    with path.open(encoding="utf-8") as fh:
        doc = yaml.safe_load(fh)
    defaults = (doc.get("defaults") or {}).get("state") or {}
    cases = doc.get("cases") or []
    return defaults, cases


@dataclass
class CaseResult:
    case_id: str
    passed: bool
    elapsed_ms: float
    mismatches: dict[str, dict[str, Any]] = field(default_factory=dict)
    prediction: dict[str, Any] | None = None
    error: str | None = None


def score_case(prediction: Any, expect: dict[str, Any]) -> dict[str, dict[str, Any]]:
    mismatches: dict[str, dict[str, Any]] = {}
    pred_tools = list(prediction.tools_called)
    pred_branches = list(prediction.branches)

    if "tools_called" in expect:
        expected_tools = list(expect["tools_called"] or [])
        if pred_tools != expected_tools:
            mismatches["tools_called"] = {
                "expected": expected_tools,
                "actual": pred_tools,
            }

    if "branches" in expect:
        expected_branches = sorted(set(expect["branches"] or []))
        actual_branches = sorted(set(pred_branches))
        if actual_branches != expected_branches:
            mismatches["branches"] = {
                "expected": expected_branches,
                "actual": actual_branches,
            }

    if "retrieval_only" in expect:
        if bool(prediction.retrieval_only) != bool(expect["retrieval_only"]):
            mismatches["retrieval_only"] = {
                "expected": expect["retrieval_only"],
                "actual": prediction.retrieval_only,
            }

    flags = infer_content_json_flags(prediction)
    for key in ("content_json_present", "content_json_absent"):
        if key not in expect:
            continue
        if bool(flags[key]) != bool(expect[key]):
            mismatches[key] = {"expected": expect[key], "actual": flags[key]}

    return mismatches


def run_case(defaults: dict[str, Any], case: dict[str, Any]) -> CaseResult:
    case_id = str(case.get("id"))
    state = build_state(defaults, case)
    query = str(case.get("query") or "")
    t0 = time.monotonic()
    try:
        resolved = resolve_turn_single_loop(user_query=query, state=state)
        if resolved is None:
            return CaseResult(
                case_id=case_id,
                passed=False,
                elapsed_ms=(time.monotonic() - t0) * 1000,
                error="routing returned None",
            )
        prediction = predict_trajectory(resolved, state, user_query=query)
    except Exception as exc:  # noqa: BLE001
        return CaseResult(
            case_id=case_id,
            passed=False,
            elapsed_ms=(time.monotonic() - t0) * 1000,
            error=f"{type(exc).__name__}: {exc}",
        )

    elapsed_ms = (time.monotonic() - t0) * 1000
    mismatches = score_case(prediction, case.get("expect") or {})
    return CaseResult(
        case_id=case_id,
        passed=not mismatches,
        elapsed_ms=elapsed_ms,
        mismatches=mismatches,
        prediction=prediction.to_dict(),
    )


def summarize(results: list[CaseResult]) -> dict[str, Any]:
    latencies = [r.elapsed_ms for r in results if r.error is None]
    field_mismatch_counts: dict[str, int] = {}
    for result in results:
        for fname in result.mismatches:
            field_mismatch_counts[fname] = field_mismatch_counts.get(fname, 0) + 1
    passed = sum(1 for r in results if r.passed)
    return {
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "errors": sum(1 for r in results if r.error),
        "pass_rate": round(passed / len(results), 4) if results else 0.0,
        "latency_ms": {
            "p50": round(_percentile(latencies, 50)),
            "p95": round(_percentile(latencies, 95)),
            "mean": round(statistics.fmean(latencies)) if latencies else 0,
        },
        "field_mismatch_counts": dict(
            sorted(field_mismatch_counts.items(), key=lambda kv: -kv[1])
        ),
    }


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, round(pct / 100 * (len(ordered) - 1))))
    return ordered[idx]


def load_baseline(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path}: baseline root must be a JSON object")
    results = data.get("results")
    if not isinstance(results, list) or not results:
        raise ValueError(f"{path}: baseline.results must be a non-empty list")
    return data


def compare_results_to_baseline(
    results: list[CaseResult],
    baseline: dict[str, Any],
    *,
    repeat: int = 1,
) -> list[str]:
    if repeat != 1:
        return ["baseline check requires --repeat 1"]

    baseline_by_id = {
        str(row.get("case_id")): row
        for row in (baseline.get("results") or [])
        if row.get("case_id")
    }
    current_by_id: dict[str, CaseResult] = {}
    for result in results:
        if result.case_id in current_by_id:
            return [f"{result.case_id}: duplicate result in current run"]
        current_by_id[result.case_id] = result

    errors: list[str] = []
    for case_id, expected in baseline_by_id.items():
        actual = current_by_id.get(case_id)
        if actual is None:
            errors.append(f"{case_id}: missing in current run")
            continue
        if expected.get("passed") != actual.passed:
            errors.append(
                f"{case_id}: passed={actual.passed} baseline={expected.get('passed')}"
            )
        if expected.get("error") != actual.error:
            errors.append(
                f"{case_id}: error={actual.error!r} baseline={expected.get('error')!r}"
            )
        if expected.get("mismatches") != actual.mismatches:
            errors.append(
                f"{case_id}: mismatches changed "
                f"(actual={actual.mismatches}, baseline={expected.get('mismatches')})"
            )

    for case_id in sorted(set(current_by_id) - set(baseline_by_id)):
        errors.append(f"{case_id}: new case not in baseline")

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES_PATH)
    parser.add_argument("--filter", default="", help="Substring match on id or tag.")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE_PATH)
    parser.add_argument("--baseline-check", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

    if args.baseline_check and args.repeat != 1:
        print("baseline-check requires --repeat 1", file=sys.stderr)
        return 2

    load_dotenv(_PACKAGE_ROOT / ".env")

    defaults, cases = load_cases(args.cases)
    if args.filter:
        needle = args.filter.lower()
        cases = [
            c
            for c in cases
            if needle in str(c.get("id", "")).lower()
            or any(needle in str(t).lower() for t in (c.get("tags") or []))
        ]
    if args.limit > 0:
        cases = cases[: args.limit]
    if not cases:
        print("No cases matched.", file=sys.stderr)
        return 2

    print(f"Running {len(cases)} trajectory case(s) x{args.repeat} ...\n")
    results: list[CaseResult] = []
    for case in cases:
        for attempt in range(args.repeat):
            result = run_case(defaults, case)
            results.append(result)
            status = "PASS" if result.passed else "FAIL"
            suffix = f" (attempt {attempt + 1})" if args.repeat > 1 else ""
            print(f"[{status}] {result.case_id}{suffix} ({result.elapsed_ms:.0f}ms)")
            if result.error:
                print(f"    error: {result.error}")
            for fname, detail in result.mismatches.items():
                print(f"    {fname}: {detail}")
            if args.verbose and result.prediction:
                print(f"    prediction: {json.dumps(result.prediction)}")

    summary = summarize(results)
    print("\n=== Summary ===")
    print(json.dumps(summary, indent=2))

    exit_code = 0 if summary["failed"] == 0 else 1

    if args.baseline_check:
        baseline_path = args.baseline
        if not baseline_path.is_file():
            print(f"Baseline file not found: {baseline_path}", file=sys.stderr)
            return 2
        diffs = compare_results_to_baseline(results, load_baseline(baseline_path))
        if diffs:
            print("\n=== Baseline check FAILED ===", file=sys.stderr)
            for line in diffs:
                print(f"  {line}", file=sys.stderr)
            print(
                "\nUpdate with: make trajectory-eval "
                'ARGS="--out property_agent/evals/trajectory/baselines/baseline.json"',
                file=sys.stderr,
            )
            exit_code = 1
        else:
            print(f"\n=== Baseline check PASSED ({baseline_path}) ===")

    if args.out:
        payload = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "cases_file": str(
                args.cases.resolve().relative_to(_PACKAGE_ROOT)
                if args.cases.is_relative_to(_PACKAGE_ROOT)
                else args.cases
            ),
            "filter": args.filter or None,
            "repeat": args.repeat,
            "summary": summary,
            "results": [
                {
                    "case_id": r.case_id,
                    "passed": r.passed,
                    "elapsed_ms": round(r.elapsed_ms),
                    "mismatches": r.mismatches,
                    "error": r.error,
                    "prediction": r.prediction,
                }
                for r in results
            ],
        }
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        print(f"\nWrote baseline to {args.out}")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
