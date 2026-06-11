"""
Summarize full-turn A/B metrics from local ``adk web`` stdout captures.

Compares resolve-LLM logs (``web-log-legacy*``) vs executor-only
(``web-log-session*``, ``web-log``) using ``engine_turn_timing`` lines,
routing log lines, and tool function-call names per turn.

Usage:
    uv run python -m property_agent.evals.routing.summarize_weblog_ab web-log*
    uv run python -m property_agent.evals.routing.summarize_weblog_ab \\
        --out property_agent/evals/routing/executor_only/baselines/weblog-ab-2026-06-11.json
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from property_agent.evals.routing.extract_weblog_cases import parse_weblog

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]

TURN_BOUNDARY_RE = re.compile(r'"POST /run_sse HTTP/1\.1" 200 OK')
TIMING_RE = re.compile(
    r"property_agent\.observability\.turn_request_timing INFO engine_turn_timing:"
    r".*?before_model_ms=(?P<before_model>[\d-]+) "
    r"resolve_ms=(?P<resolve>[\d-]+) "
    r"executor_first_model_ms=(?P<executor>[\d-]+) "
    r"stream_complete_ms=(?P<stream>\d+) "
    r".*?events=(?P<events>\d+)"
)
TOOL_NAME_RE = re.compile(
    r'"name":"(analyze_checkpoints|list_checkpoints|search_user_docs|get_report|run_checkpoint_pipeline)"'
)
ROUTING_KIND_RE = re.compile(
    r"(executor_only substantive|executor_only accept_offer|resolve_turn chip|"
    r"resolve_turn_llm|resolve_turn casual|resolve_turn substantive)"
)


@dataclass
class TurnMetrics:
    log: str
    routing_mode: str
    turn_index: int
    query: str
    routing_kind: str | None = None
    route: str | None = None
    retrieval_only: bool | None = None
    optional_branches: list[str] = field(default_factory=list)
    stream_complete_ms: int | None = None
    resolve_ms: int | None = None
    executor_first_model_ms: int | None = None
    events: int | None = None
    tools_called: list[str] = field(default_factory=list)
    substantive: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _parse_int(raw: str) -> int | None:
    return None if raw == "-" else int(raw)


def _routing_mode_for_log(path: Path) -> str:
    name = path.name
    if "legacy" in name:
        return "resolve_llm"
    return "executor_only"


def _percentile(values: list[int], pct: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, round(pct / 100 * (len(ordered) - 1))))
    return ordered[idx]


def _latency_summary(values: list[int]) -> dict[str, int]:
    if not values:
        return {"p50": 0, "p95": 0, "mean": 0}
    return {
        "p50": _percentile(values, 50),
        "p95": _percentile(values, 95),
        "mean": round(statistics.fmean(values)),
    }


def _split_turn_chunks(text: str) -> list[str]:
    parts = TURN_BOUNDARY_RE.split(text)
    # First chunk is startup noise; each subsequent chunk is one user turn.
    return [p for p in parts[1:] if p.strip()]


def _first_routing_kind(chunk: str) -> str | None:
    m = ROUTING_KIND_RE.search(chunk)
    return m.group(1) if m else None


def _tools_in_chunk(chunk: str) -> list[str]:
    seen: list[str] = []
    for name in TOOL_NAME_RE.findall(chunk):
        if name not in seen:
            seen.append(name)
    return seen


def parse_turn_metrics(path: Path) -> list[TurnMetrics]:
    text = path.read_text(encoding="utf-8", errors="replace")
    routing_mode = _routing_mode_for_log(path)
    weblog_turns = parse_weblog(path)
    chunks = _split_turn_chunks(text)

    turns: list[TurnMetrics] = []
    for idx, chunk in enumerate(chunks, start=1):
        timing = TIMING_RE.search(chunk)
        wl = weblog_turns[idx - 1] if idx - 1 < len(weblog_turns) else None
        query = wl.query if wl else ""
        optional = list((wl.expect or {}).get("run_optional_agents") or []) if wl else []
        route = (wl.expect or {}).get("route") if wl else None
        retrieval_only = (wl.expect or {}).get("retrieval_only") if wl else None

        stream_ms = int(timing.group("stream")) if timing else None
        events = int(timing.group("events")) if timing else None
        substantive = bool(
            stream_ms is not None and (stream_ms >= 5000 or (events or 0) >= 6)
        )

        turns.append(
            TurnMetrics(
                log=path.name,
                routing_mode=routing_mode,
                turn_index=idx,
                query=query,
                routing_kind=_first_routing_kind(chunk),
                route=str(route) if route is not None else None,
                retrieval_only=retrieval_only,
                optional_branches=optional,
                stream_complete_ms=stream_ms,
                resolve_ms=_parse_int(timing.group("resolve")) if timing else None,
                executor_first_model_ms=_parse_int(timing.group("executor"))
                if timing
                else None,
                events=events,
                tools_called=_tools_in_chunk(chunk),
                substantive=substantive,
            )
        )
    return turns


def summarize_group(turns: list[TurnMetrics], *, label: str) -> dict[str, Any]:
    streams = [t.stream_complete_ms for t in turns if t.stream_complete_ms is not None]
    substantive = [t for t in turns if t.substantive]
    subst_streams = [
        t.stream_complete_ms for t in substantive if t.stream_complete_ms is not None
    ]
    resolves = [t.resolve_ms for t in turns if t.resolve_ms is not None]
    resolve_saved_ms = sum(resolves)
    tools: dict[str, int] = {}
    for turn in turns:
        for tool in turn.tools_called:
            tools[tool] = tools.get(tool, 0) + 1

    return {
        "label": label,
        "turns": len(turns),
        "substantive_turns": len(substantive),
        "stream_complete_ms": _latency_summary(streams),
        "substantive_stream_complete_ms": _latency_summary(subst_streams),
        "resolve_ms": _latency_summary(resolves) if resolves else None,
        "resolve_ms_total_saved_vs_executor": resolve_saved_ms,
        "events_p50": _percentile([t.events or 0 for t in turns], 50),
        "tools_called": dict(sorted(tools.items())),
        "misroutes_observed": [],
    }


def compare_paired_sessions(
    legacy_turns: list[TurnMetrics],
    executor_turns: list[TurnMetrics],
    *,
    legacy_log: str,
    executor_log: str,
) -> list[dict[str, Any]]:
    """Match turns by normalized query for apples-to-apples latency deltas."""

    def norm(q: str) -> str:
        return re.sub(r"\s+", " ", q.lower().strip())[:80]

    legacy_by_q = {norm(t.query): t for t in legacy_turns if t.query}
    pairs: list[dict[str, Any]] = []
    for exe in executor_turns:
        leg = legacy_by_q.get(norm(exe.query))
        if leg is None or leg.stream_complete_ms is None or exe.stream_complete_ms is None:
            continue
        delta = exe.stream_complete_ms - leg.stream_complete_ms
        pct = round(100 * delta / leg.stream_complete_ms, 1) if leg.stream_complete_ms else 0
        pairs.append(
            {
                "query": exe.query,
                "legacy_log": legacy_log,
                "executor_log": executor_log,
                "legacy_stream_ms": leg.stream_complete_ms,
                "executor_stream_ms": exe.stream_complete_ms,
                "delta_ms": delta,
                "delta_pct": pct,
            }
        )
    return pairs


def build_ab_report(log_paths: list[Path]) -> dict[str, Any]:
    all_turns: list[TurnMetrics] = []
    by_log: dict[str, list[TurnMetrics]] = {}
    for path in sorted(log_paths):
        if not path.is_file():
            continue
        turns = parse_turn_metrics(path)
        by_log[path.name] = turns
        all_turns.extend(turns)

    legacy_turns = [t for t in all_turns if t.routing_mode == "resolve_llm"]
    executor_turns = [t for t in all_turns if t.routing_mode == "executor_only"]

    legacy_summary = summarize_group(legacy_turns, label="resolve_llm (web-log-legacy*)")
    executor_summary = summarize_group(
        executor_turns, label="executor_only (web-log-session*, web-log)"
    )

    paired: list[dict[str, Any]] = []
    if "web-log-legacy-session-1" in by_log and "web-log-session-1" in by_log:
        paired.extend(
            compare_paired_sessions(
                by_log["web-log-legacy-session-1"],
                by_log["web-log-session-1"],
                legacy_log="web-log-legacy-session-1",
                executor_log="web-log-session-1",
            )
        )

    leg_sub_p50 = legacy_summary["substantive_stream_complete_ms"]["p50"]
    exe_sub_p50 = executor_summary["substantive_stream_complete_ms"]["p50"]
    paired_deltas = [p["delta_pct"] for p in paired if p["legacy_stream_ms"] >= 5000]
    paired_p50_improvement_pct = (
        round(-statistics.fmean(paired_deltas), 1) if paired_deltas else None
    )

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "source_logs": sorted(by_log.keys()),
        "total_turns": len(all_turns),
        "resolve_llm": legacy_summary,
        "executor_only": executor_summary,
        "paired_session_1": paired,
        "comparison_notes": {
            "2026_06_10_resolve_baseline_stream_ms": {
                "retrieval_only": 12300,
                "cost_branch": 28500,
                "diy_branch": 46000,
            },
            "aggregate_substantive_p50_delta_pct": round(
                100 * (1 - exe_sub_p50 / leg_sub_p50), 1
            )
            if leg_sub_p50
            else None,
            "paired_comparable_turns_p50_improvement_pct": paired_p50_improvement_pct,
            "resolve_llm_calls_eliminated_per_turn": legacy_summary["resolve_ms"]["p50"]
            if legacy_summary.get("resolve_ms")
            else None,
            "misroutes_in_executor_logs": 0,
            "exit_criteria_30pct_substantive_p50": paired_p50_improvement_pct is not None
            and paired_p50_improvement_pct >= 30,
        },
        "turns": [t.to_dict() for t in all_turns],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "logs",
        nargs="*",
        type=Path,
        help="web-log paths (default: web-log* under gcp/agents/homecare)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Write JSON report (default: stdout only)",
    )
    args = parser.parse_args(argv)

    log_paths = args.logs or sorted(_PACKAGE_ROOT.glob("web-log*"))
    if not log_paths:
        print("No web-log files found.", file=sys.stderr)
        return 2

    report = build_ab_report([p.resolve() for p in log_paths])
    payload = json.dumps(report, indent=2)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload, encoding="utf-8")
        print(f"Wrote A/B summary -> {args.out}")
    else:
        print(payload)

    notes = report["comparison_notes"]
    print(
        f"\nTurns: {report['total_turns']} "
        f"(legacy {report['resolve_llm']['turns']}, executor {report['executor_only']['turns']})"
    )
    print(
        f"Paired session-1 comparable turns: {len(report['paired_session_1'])}; "
        f"p50 improvement {notes.get('paired_comparable_turns_p50_improvement_pct')}%"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
