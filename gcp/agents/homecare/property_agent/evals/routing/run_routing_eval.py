"""
Single-loop routing eval: replay single_loop/cases.yaml and score routing.

Deterministic paths only — chip, pending-offer, casual regex, or
``minimal_substantive_resolved_turn``. No Vertex LLM.

Schema validation: ``tests/test_routing_eval_cases.py``.

Usage:
    uv run python -m property_agent.evals.routing.run_routing_eval
    uv run python -m property_agent.evals.routing.run_routing_eval --filter weblog_session_1
    uv run python -m property_agent.evals.routing.run_routing_eval --out single_loop/baselines/$(date +%F).json
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

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]  # gcp/agents/homecare
DEFAULT_CASES_PATH = Path(__file__).resolve().parent / "single_loop" / "cases.yaml"

# Fields asserted directly on ResolvedTurn.
SCALAR_EXPECT_FIELDS = (
    "discourse_act",
    "intent",
    "route",
    "user_goal",
    "retrieval_only",
    "focus_branch",
    "capability_key",
    "query_mode",
)
KNOWN_EXPECT_FIELDS = SCALAR_EXPECT_FIELDS + (
    "run_optional_agents",
    "run_optional_agents_any_of",
)


def load_cases(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    with path.open() as fh:
        doc = yaml.safe_load(fh)
    defaults = (doc.get("defaults") or {}).get("state") or {}
    cases = doc.get("cases") or []
    return defaults, cases


def build_state(defaults: dict[str, Any], case: dict[str, Any]) -> dict[str, Any]:
    state = copy.deepcopy(defaults)
    state.update(copy.deepcopy(case.get("state") or {}))
    return state


def build_events(dialogue: list[dict[str, Any]] | None) -> list[Any]:
    """Fake ADK session events compatible with routing.recent_dialogue."""
    events: list[Any] = []
    for i, turn in enumerate(dialogue or []):
        role = str(turn.get("role") or "user")
        author = "user" if role == "user" else "property_agent"
        events.append(
            SimpleNamespace(
                author=author,
                invocation_id=f"prior-{i}",
                content=SimpleNamespace(
                    parts=[SimpleNamespace(text=str(turn.get("text") or ""))]
                ),
            )
        )
    return events


def _matches(expected: Any, actual: Any) -> bool:
    if isinstance(expected, list):
        return actual in expected
    return actual == expected


@dataclass
class CaseResult:
    case_id: str
    passed: bool
    elapsed_ms: float
    mismatches: dict[str, dict[str, Any]] = field(default_factory=dict)
    resolved: dict[str, Any] | None = None
    error: str | None = None


def score_case(resolved: Any, expect: dict[str, Any]) -> dict[str, dict[str, Any]]:
    mismatches: dict[str, dict[str, Any]] = {}
    for fname in SCALAR_EXPECT_FIELDS:
        if fname not in expect:
            continue
        actual = getattr(resolved, fname, None)
        if not _matches(expect[fname], actual):
            mismatches[fname] = {"expected": expect[fname], "actual": actual}
    actual_branches = sorted(set(getattr(resolved, "run_optional_agents", None) or []))
    if "run_optional_agents" in expect:
        expected_set = sorted(set(expect["run_optional_agents"] or []))
        if actual_branches != expected_set:
            mismatches["run_optional_agents"] = {
                "expected": expected_set,
                "actual": actual_branches,
            }
    elif "run_optional_agents_any_of" in expect:
        accepted = [
            sorted(set(option or [])) for option in expect["run_optional_agents_any_of"]
        ]
        if actual_branches not in accepted:
            mismatches["run_optional_agents"] = {
                "expected_any_of": accepted,
                "actual": actual_branches,
            }
    return mismatches


def resolve_turn_single_loop(
    *,
    user_query: str,
    state: dict[str, Any],
) -> Any:
    """Mirror ``prepare_single_loop_before_model`` routing without ADK / LLM."""
    from property_agent.routing.chip_action import resolve_turn_from_chip
    from property_agent.routing.single_loop_routing import (
        bare_casual_intent,
        minimal_substantive_resolved_turn,
        resolve_turn_from_pending_offer,
    )
    from property_agent.routing.resolve_turn import apply_resolved_turn_to_state
    from property_agent.routing.schema import ResolvedTurn

    work = copy.deepcopy(state)
    work["user_query"] = user_query

    chip = resolve_turn_from_chip(work, user_query=user_query)
    if chip is not None:
        apply_resolved_turn_to_state(work, chip)
        return chip

    accept = resolve_turn_from_pending_offer(work, user_query=user_query)
    if accept is not None:
        apply_resolved_turn_to_state(work, accept)
        return accept

    casual = bare_casual_intent(user_query)
    if casual is not None:
        resolved = ResolvedTurn(
            intent=casual,
            route="none",
            expanded_user_query=user_query,
            retrieval_only=True,
            resolve_source="single_loop",
        )
        apply_resolved_turn_to_state(work, resolved)
        return resolved

    resolved = minimal_substantive_resolved_turn(work, user_query=user_query)
    apply_resolved_turn_to_state(work, resolved)
    return resolved


def run_case(defaults: dict[str, Any], case: dict[str, Any]) -> CaseResult:
    case_id = str(case.get("id"))
    state = build_state(defaults, case)
    t0 = time.monotonic()
    try:
        resolved = resolve_turn_single_loop(
            user_query=str(case.get("query") or ""),
            state=state,
        )
    except Exception as exc:  # noqa: BLE001 - report per-case, keep running
        return CaseResult(
            case_id=case_id,
            passed=False,
            elapsed_ms=(time.monotonic() - t0) * 1000,
            error=f"{type(exc).__name__}: {exc}",
        )
    elapsed_ms = (time.monotonic() - t0) * 1000
    if resolved is None:
        return CaseResult(
            case_id=case_id,
            passed=False,
            elapsed_ms=elapsed_ms,
            error="resolver returned None (LLM failure or unparseable payload)",
        )
    mismatches = score_case(resolved, case.get("expect") or {})
    return CaseResult(
        case_id=case_id,
        passed=not mismatches,
        elapsed_ms=elapsed_ms,
        mismatches=mismatches,
        resolved=resolved.to_dict(),
    )


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, round(pct / 100 * (len(ordered) - 1))))
    return ordered[idx]


def summarize(results: list[CaseResult]) -> dict[str, Any]:
    latencies = [r.elapsed_ms for r in results if r.error is None]
    field_mismatch_counts: dict[str, int] = {}
    for r in results:
        for fname in r.mismatches:
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES_PATH)
    parser.add_argument(
        "--filter",
        default="",
        help="Substring match on case id or tag (e.g. 'weblog', 'branch_cost').",
    )
    parser.add_argument("--limit", type=int, default=0, help="Run at most N cases.")
    parser.add_argument(
        "--repeat", type=int, default=1, help="Repeat each case N times (flakiness)."
    )
    parser.add_argument(
        "--out", type=Path, default=None, help="Write JSON results (baseline file)."
    )
    parser.add_argument("--verbose", action="store_true", help="Print resolved dicts.")
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
    if args.limit > 0:
        cases = cases[: args.limit]
    if not cases:
        print("No cases matched.", file=sys.stderr)
        return 2

    print(f"Running {len(cases)} single-loop routing case(s) x{args.repeat} ...\n")
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
            if args.verbose and result.resolved:
                print(f"    resolved: {json.dumps(result.resolved, default=str)}")

    summary = summarize(results)
    print("\n=== Summary ===")
    print(json.dumps(summary, indent=2))

    if args.out:
        # Relative to the homecare package so baselines are machine-portable.
        try:
            cases_file = str(args.cases.resolve().relative_to(_PACKAGE_ROOT))
        except ValueError:
            cases_file = str(args.cases)
        payload = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "cases_file": cases_file,
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
                    "resolved": r.resolved,
                }
                for r in results
            ],
        }
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(payload, indent=2, default=str))
        print(f"\nWrote baseline to {args.out}")

    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
