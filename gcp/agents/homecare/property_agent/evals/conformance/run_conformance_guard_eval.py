"""
Conformance guard eval: deterministic tool-boundary scenarios (no ADK / Vertex).

Schema validation: ``tests/test_conformance_guard_eval_cases.py``.

Usage:
    uv run python -m property_agent.evals.conformance.run_conformance_guard_eval
    uv run python -m property_agent.evals.conformance.run_conformance_guard_eval --baseline-check
"""

from __future__ import annotations

import argparse
import copy
import json
import statistics
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import yaml
from dotenv import load_dotenv

from agent_framework.routing.resolved_turn import RESOLVED_TURN_STATE_KEY

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CASES_PATH = Path(__file__).resolve().parent / "guard_cases.yaml"
DEFAULT_BASELINE_PATH = Path(__file__).resolve().parent / "baselines" / "guard_baseline.json"

KNOWN_HANDLERS = frozenset(
    {"conversational_before_tool", "prepare_analyze_checkpoints"}
)


def load_cases(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    with path.open(encoding="utf-8") as fh:
        doc = yaml.safe_load(fh)
    defaults = (doc.get("defaults") or {}).get("state") or {}
    cases = doc.get("cases") or []
    return defaults, cases


def build_state(defaults: dict[str, Any], case: dict[str, Any]) -> dict[str, Any]:
    state = copy.deepcopy(defaults)
    raw = copy.deepcopy(case.get("state") or {})
    resolved = raw.pop("resolved_turn", None)
    state.update(raw)
    if resolved is not None:
        state[RESOLVED_TURN_STATE_KEY] = resolved
    return state


@dataclass
class CaseResult:
    case_id: str
    passed: bool
    elapsed_ms: float
    mismatches: dict[str, dict[str, Any]] = field(default_factory=dict)
    outcome: dict[str, Any] | None = None
    error: str | None = None


def _run_conversational_before_tool(
    *,
    tool_name: str,
    args: dict[str, Any],
    state: dict[str, Any],
) -> dict[str, Any]:
    from unittest.mock import MagicMock

    from property_agent.routing.conversational_callbacks import (
        conversational_before_tool,
    )

    tool = SimpleNamespace(name=tool_name)
    tool_context = MagicMock()
    tool_context.state = state
    result = conversational_before_tool(tool, args, tool_context)
    return {
        "blocked": result is not None,
        "result": (result or {}).get("result"),
    }


def _run_prepare_analyze_checkpoints(
    *,
    args: dict[str, Any],
    state: dict[str, Any],
) -> dict[str, Any]:
    from property_agent.checkpoint.tool_guards import prepare_analyze_checkpoints_tool

    work_args = copy.deepcopy(args)
    user_query = str(state.get("user_query") or "")
    result = prepare_analyze_checkpoints_tool(
        state, work_args, user_query=user_query
    )
    return {
        "blocked": result is not None,
        "result": (result or {}).get("result"),
        "args": work_args,
    }


def run_guard_case(defaults: dict[str, Any], case: dict[str, Any]) -> CaseResult:
    case_id = str(case.get("id"))
    t0 = time.monotonic()
    try:
        state = build_state(defaults, case)
        handler = str(case.get("handler") or "")
        args = copy.deepcopy(case.get("args") or {})
        tool_name = str(case.get("tool") or "analyze_checkpoints")

        if handler == "conversational_before_tool":
            outcome = _run_conversational_before_tool(
                tool_name=tool_name, args=args, state=state
            )
        elif handler == "prepare_analyze_checkpoints":
            outcome = _run_prepare_analyze_checkpoints(args=args, state=state)
        else:
            return CaseResult(
                case_id=case_id,
                passed=False,
                elapsed_ms=(time.monotonic() - t0) * 1000,
                error=f"unknown handler {handler!r}",
            )
    except Exception as exc:  # noqa: BLE001
        return CaseResult(
            case_id=case_id,
            passed=False,
            elapsed_ms=(time.monotonic() - t0) * 1000,
            error=f"{type(exc).__name__}: {exc}",
        )

    elapsed_ms = (time.monotonic() - t0) * 1000
    mismatches = score_case(outcome, case.get("expect") or {})
    return CaseResult(
        case_id=case_id,
        passed=not mismatches,
        elapsed_ms=elapsed_ms,
        mismatches=mismatches,
        outcome=outcome,
    )


def score_case(outcome: dict[str, Any], expect: dict[str, Any]) -> dict[str, dict[str, Any]]:
    mismatches: dict[str, dict[str, Any]] = {}

    if "blocked" in expect:
        actual = bool(outcome.get("blocked"))
        if actual != bool(expect["blocked"]):
            mismatches["blocked"] = {"expected": expect["blocked"], "actual": actual}

    if "result_contains" in expect:
        text = str(outcome.get("result") or "").lower()
        needle = str(expect["result_contains"]).lower()
        if needle not in text:
            mismatches["result_contains"] = {
                "expected": expect["result_contains"],
                "actual": outcome.get("result"),
            }

    args = outcome.get("args") or {}
    if "args_branches" in expect:
        actual = list(args.get("branches") or [])
        expected = list(expect["args_branches"] or [])
        if actual != expected:
            mismatches["args_branches"] = {"expected": expected, "actual": actual}

    if "args_checkpoint_ids" in expect:
        actual = list(args.get("checkpoint_ids") or [])
        expected = list(expect["args_checkpoint_ids"] or [])
        if actual != expected:
            mismatches["args_checkpoint_ids"] = {
                "expected": expected,
                "actual": actual,
            }

    return mismatches


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
    current_by_id = {r.case_id: r for r in results}
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
            errors.append(f"{case_id}: mismatches changed")
    for case_id in sorted(set(current_by_id) - set(baseline_by_id)):
        errors.append(f"{case_id}: new case not in baseline")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES_PATH)
    parser.add_argument("--filter", default="")
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE_PATH)
    parser.add_argument("--baseline-check", action="store_true")
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

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
    if not cases:
        print("No cases matched.", file=sys.stderr)
        return 2

    print(f"Running {len(cases)} conformance guard case(s) ...\n")
    results = [run_guard_case(defaults, case) for case in cases]
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(f"[{status}] {result.case_id} ({result.elapsed_ms:.0f}ms)")
        if result.error:
            print(f"    error: {result.error}")
        for fname, detail in result.mismatches.items():
            print(f"    {fname}: {detail}")
        if args.verbose and result.outcome:
            print(f"    outcome: {json.dumps(result.outcome, default=str)}")

    summary = summarize(results)
    print("\n=== Summary ===")
    print(json.dumps(summary, indent=2))

    exit_code = 0 if summary["failed"] == 0 else 1
    if args.baseline_check:
        if not args.baseline.is_file():
            print(f"Baseline not found: {args.baseline}", file=sys.stderr)
            return 2
        diffs = compare_results_to_baseline(results, load_baseline(args.baseline))
        if diffs:
            print("\n=== Baseline check FAILED ===", file=sys.stderr)
            for line in diffs:
                print(f"  {line}", file=sys.stderr)
            exit_code = 1
        else:
            print(f"\n=== Baseline check PASSED ({args.baseline}) ===")

    if args.out:
        payload = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "summary": summary,
            "results": [
                {
                    "case_id": r.case_id,
                    "passed": r.passed,
                    "elapsed_ms": round(r.elapsed_ms),
                    "mismatches": r.mismatches,
                    "error": r.error,
                    "outcome": r.outcome,
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
