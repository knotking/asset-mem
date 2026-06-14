"""
Run Phase 4 prose LLM-judge eval (``content_markdown_prose``).

Dry-run (default): validates dataset + expected labels without Vertex.
Live judge: pass ``--live`` or set ``RUN_PROSE_JUDGE_EVAL=1``.

Usage:
    uv run python -m property_agent.evals.judge.run_prose_judge_eval
    uv run python -m property_agent.evals.judge.run_prose_judge_eval --live
    uv run python -m property_agent.evals.judge.run_prose_judge_eval --filter greeting
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

from property_agent.evals.judge.judge_prose import (
    ProseJudgeResult,
    judge_prose_markdown,
    live_generate_text,
    load_prose_rubric_text,
)

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CASES_PATH = Path(__file__).resolve().parent / "prose_cases.yaml"
DEFAULT_BASELINE_PATH = Path(__file__).resolve().parent / "baselines" / "prose_baseline.json"


@dataclass
class CaseResult:
    case_id: str
    passed: bool
    elapsed_ms: float
    expected_passed: bool | None = None
    judge: dict[str, Any] | None = None
    error: str | None = None
    mismatches: dict[str, Any] = field(default_factory=dict)


def load_cases(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    defaults = doc.get("defaults") or {}
    cases = doc.get("cases") or []
    return defaults, cases


def _case_matches_filter(case: dict[str, Any], needle: str | None) -> bool:
    if not needle:
        return True
    hay = " ".join(
        [
            str(case.get("id") or ""),
            " ".join(str(t) for t in (case.get("tags") or [])),
            str(case.get("user_query") or ""),
        ]
    ).lower()
    return needle.lower() in hay


def run_case_dry(
    case: dict[str, Any],
    *,
    defaults: dict[str, Any],
) -> CaseResult:
    case_id = str(case.get("id"))
    expect = {**(defaults.get("expect") or {}), **(case.get("expect") or {})}
    expected_passed = expect.get("passed")
    if expected_passed is None:
        return CaseResult(
            case_id=case_id,
            passed=False,
            elapsed_ms=0.0,
            error="dry-run case must declare expect.passed",
        )
    return CaseResult(
        case_id=case_id,
        passed=True,
        elapsed_ms=0.0,
        expected_passed=bool(expected_passed),
        judge={"passed": bool(expected_passed), "score": 1.0 if expected_passed else 0.0, "reasons": ["dry-run label"]},
    )


def run_case_live(
    case: dict[str, Any],
    *,
    defaults: dict[str, Any],
    rubric_text: str,
    generate_text,
) -> CaseResult:
    case_id = str(case.get("id"))
    expect = {**(defaults.get("expect") or {}), **(case.get("expect") or {})}
    t0 = time.monotonic()
    try:
        result: ProseJudgeResult = judge_prose_markdown(
            user_query=str(case.get("user_query") or ""),
            content_markdown=str(case.get("content_markdown") or ""),
            rubric_text=rubric_text,
            context=str(case.get("context") or "") or None,
            generate_text=generate_text,
        )
    except Exception as exc:  # noqa: BLE001
        return CaseResult(
            case_id=case_id,
            passed=False,
            elapsed_ms=(time.monotonic() - t0) * 1000,
            error=f"{type(exc).__name__}: {exc}",
        )

    elapsed_ms = (time.monotonic() - t0) * 1000
    min_score = float(expect.get("min_score", 0.7))
    mismatches: dict[str, Any] = {}
    expected_passed = expect.get("passed")

    if expected_passed is not None and bool(result.passed) != bool(expected_passed):
        mismatches["passed"] = {
            "expected": expected_passed,
            "actual": result.passed,
        }
    elif expected_passed is True and result.score < min_score:
        mismatches["score"] = {
            "expected_min": min_score,
            "actual": result.score,
        }

    passed = not mismatches

    return CaseResult(
        case_id=case_id,
        passed=passed,
        elapsed_ms=elapsed_ms,
        expected_passed=expected_passed,
        judge=result.to_dict(),
        mismatches=mismatches,
    )


def _summary(results: list[CaseResult]) -> dict[str, Any]:
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed
    latencies = [r.elapsed_ms for r in results]
    latencies_sorted = sorted(latencies)
    p50 = latencies_sorted[len(latencies_sorted) // 2] if latencies_sorted else 0
    p95 = latencies_sorted[max(0, round(0.95 * (len(latencies_sorted) - 1)))] if latencies_sorted else 0
    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": round(passed / total, 4) if total else 0.0,
        "latency_ms": {
            "p50": round(p50),
            "p95": round(p95),
            "mean": round(sum(latencies) / len(latencies)) if latencies else 0,
        },
    }


def run_eval(
    *,
    cases_path: Path,
    filter_text: str | None,
    live: bool,
    generate_text=None,
) -> tuple[list[CaseResult], dict[str, Any]]:
    defaults, cases = load_cases(cases_path)
    rubric_text = load_prose_rubric_text() if live else ""
    results: list[CaseResult] = []
    for case in cases:
        if not _case_matches_filter(case, filter_text):
            continue
        if live:
            results.append(
                run_case_live(
                    case,
                    defaults=defaults,
                    rubric_text=rubric_text,
                    generate_text=generate_text or live_generate_text,
                )
            )
        else:
            results.append(run_case_dry(case, defaults=defaults))
    return results, _summary(results)


def _baseline_check(current: dict[str, Any], baseline_path: Path) -> str | None:
    if not baseline_path.is_file():
        return f"baseline missing: {baseline_path}"
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    base_summary = baseline.get("summary") or {}
    if current.get("pass_rate", 0) < base_summary.get("pass_rate", 0):
        return (
            f"pass_rate regressed: {current.get('pass_rate')} < "
            f"{base_summary.get('pass_rate')}"
        )
    return None


def main(argv: list[str] | None = None) -> int:
    load_dotenv(_PACKAGE_ROOT / ".env")
    parser = argparse.ArgumentParser(description="Phase 4 prose LLM-judge eval")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES_PATH)
    parser.add_argument("--filter", dest="filter_text", default=None)
    parser.add_argument("--live", action="store_true", help="Call Vertex judge model")
    parser.add_argument("--baseline-check", action="store_true")
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE_PATH)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args(argv)

    live = args.live or os.environ.get("RUN_PROSE_JUDGE_EVAL", "").strip() in {"1", "true", "yes"}
    results, summary = run_eval(
        cases_path=args.cases,
        filter_text=args.filter_text,
        live=live,
    )
    if not results:
        print("No cases matched filter.", file=sys.stderr)
        return 1

    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "mode": "live" if live else "dry-run",
        "cases_file": str(args.cases),
        "filter": args.filter_text,
        "summary": summary,
        "results": [
            {
                "case_id": r.case_id,
                "passed": r.passed,
                "elapsed_ms": round(r.elapsed_ms, 2),
                "expected_passed": r.expected_passed,
                "judge": r.judge,
                "mismatches": r.mismatches,
                "error": r.error,
            }
            for r in results
        ],
    }

    if args.baseline_check:
        err = _baseline_check(summary, args.baseline)
        if err:
            print(err, file=sys.stderr)
            return 1

    payload = json.dumps(report, indent=2, sort_keys=True)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload + "\n", encoding="utf-8")
        print(f"Wrote {args.out}")
    else:
        print(payload)

    print(
        f"\nProse judge: {summary['passed']}/{summary['total']} passed "
        f"({summary['pass_rate']*100:.1f}%) mode={report['mode']}"
    )
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
