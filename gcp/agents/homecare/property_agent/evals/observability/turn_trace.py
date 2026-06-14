"""Normalize adk web turn metrics into versioned trace records."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from property_agent.evals.routing.summarize_weblog_ab import TurnMetrics, parse_turn_metrics

TRACE_VERSION = 1


@dataclass
class TurnTrace:
    trace_version: int
    log: str
    routing_mode: str
    turn_index: int
    user_query: str
    routing_kind: str | None = None
    route: str | None = None
    retrieval_only: bool | None = None
    optional_branches: list[str] = field(default_factory=list)
    tools_called: list[str] = field(default_factory=list)
    stream_complete_ms: int | None = None
    resolve_ms: int | None = None
    executor_first_model_ms: int | None = None
    events: int | None = None
    substantive: bool = False
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _tags_for_turn(turn: TurnMetrics) -> list[str]:
    tags: list[str] = [turn.routing_mode]
    if turn.substantive:
        tags.append("substantive")
    if turn.route:
        tags.append(f"route:{turn.route}")
    if turn.routing_kind:
        tags.append(turn.routing_kind.replace(" ", "_"))
    if turn.tools_called:
        tags.append("tools")
    else:
        tags.append("no_tools")
    return tags


def turn_trace_from_metrics(turn: TurnMetrics) -> TurnTrace:
    return TurnTrace(
        trace_version=TRACE_VERSION,
        log=turn.log,
        routing_mode=turn.routing_mode,
        turn_index=turn.turn_index,
        user_query=turn.query,
        routing_kind=turn.routing_kind,
        route=turn.route,
        retrieval_only=turn.retrieval_only,
        optional_branches=list(turn.optional_branches),
        tools_called=list(turn.tools_called),
        stream_complete_ms=turn.stream_complete_ms,
        resolve_ms=turn.resolve_ms,
        executor_first_model_ms=turn.executor_first_model_ms,
        events=turn.events,
        substantive=turn.substantive,
        tags=_tags_for_turn(turn),
    )


def export_traces_from_logs(log_paths: list[Path]) -> dict[str, Any]:
    traces: list[dict[str, Any]] = []
    for path in sorted(log_paths):
        if not path.is_file():
            continue
        for turn in parse_turn_metrics(path):
            traces.append(turn_trace_from_metrics(turn).to_dict())
    return {
        "trace_version": TRACE_VERSION,
        "source_logs": sorted({t["log"] for t in traces}),
        "total_traces": len(traces),
        "traces": traces,
    }
