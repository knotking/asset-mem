"""
Extract routing-eval and conformance drafts from ``adk web`` stdout captures.

Parses local ``web-log*`` files for:
- ``executor_only substantive`` / ``resolve_turn chip`` routing lines
- ``[RESOLVED_TURN]`` JSON blocks (when present)
- User turn payloads in LLM ``Contents:`` sections

Usage:
    uv run python -m property_agent.evals.routing.extract_weblog_cases web-log-session-1
    uv run python -m property_agent.evals.routing.extract_weblog_cases web-log*
    uv run python -m property_agent.evals.routing.extract_weblog_cases --conformance out/spec web-log-session-3
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]

EXECUTOR_ONLY_RE = re.compile(
    r"executor_only substantive route=(?P<route>\w+) "
    r"retrieval_only=(?P<retrieval_only>True|False) "
    r"optional=(?P<optional>\[[^\]]*\]) "
    r"query='(?P<query>.*?)'"
)
CHIP_RESOLVE_RE = re.compile(
    r"resolve_turn chip type=(?P<chip_type>\w+) "
    r"branch=(?P<branch>\w+|None) "
    r"topic=(?P<topic>\w+|None) "
    r"route=(?P<route>\w+) "
    r"retrieval_only=(?P<retrieval_only>True|False) "
    r"optional=(?P<optional>\[[^\]]*\]) "
    r"query='(?P<query>.*?)'"
)
RESOLVE_TURN_LLM_RE = re.compile(
    r"resolve_turn_llm discourse_act=(?P<discourse_act>\w+) "
    r"intent=(?P<intent>\w+) route=(?P<route>\w+) "
    r"user_goal=(?P<user_goal>\w+) query_mode=\w+ "
    r"retrieval_only=(?P<retrieval_only>True|False) "
    r"optional=(?P<optional>\[[^\]]*\])"
)
RESOLVE_TURN_SUBSTANTIVE_RE = re.compile(
    r"resolve_turn substantive source=\w+ route=(?P<route>\w+) "
    r"user_goal=(?P<user_goal>\w+) query_mode=\w+ "
    r"retrieval_only=(?P<retrieval_only>True|False) "
    r"optional=(?P<optional>\[[^\]]*\]) query='(?P<query>.*?)'"
)
RESOLVE_TURN_CASUAL_RE = re.compile(
    r"resolve_turn casual intent=(?P<intent>\w+) source=\w+ query='(?P<query>.*?)'"
)
RESOLVED_TURN_BLOCK_RE = re.compile(
    r"\[RESOLVED_TURN\]\s*\n(\{.*?\})\n\[/RESOLVED_TURN\]",
    re.DOTALL,
)

# Keys copied into routing-eval ``state`` (real ids are sanitized).
STATE_KEYS = (
    "primary_agent",
    "checkpoint_ids",
    "checkpoint_optional_agents",
    "checkpoint_ids_analyzed",
    "context_doc_uris",
    "report_ids",
    "chat_intent",
    "chip_action",
    "pending_user_action",
    "last_offered_options",
    "checkpoint_last_response_kind",
)

EVAL_SCALAR_EXPECT = (
    "discourse_act",
    "intent",
    "route",
    "user_goal",
    "retrieval_only",
    "focus_branch",
    "capability_key",
    "query_mode",
)


@dataclass
class WeblogTurn:
    source: str
    turn_index: int
    query: str
    payload: dict[str, Any] = field(default_factory=dict)
    routing_log: str | None = None
    resolved: dict[str, Any] = field(default_factory=dict)
    expect: dict[str, Any] = field(default_factory=dict)

    @property
    def case_id(self) -> str:
        stem = Path(self.source).stem.replace("web-log-", "").replace("web-log", "default")
        slug = re.sub(r"[^a-z0-9]+", "_", self.query.lower()).strip("_")[:40]
        return f"weblog_{stem}_t{self.turn_index}_{slug or 'turn'}"


def _slug_session_name(path: Path) -> str:
    stem = path.stem.replace("web-log-", "").replace("web-log", "default")
    return re.sub(r"[^a-z0-9]+", "_", stem).strip("_") or "session"


def _parse_optional_branches(raw: str) -> list[str]:
    try:
        value = ast.literal_eval(raw)
    except (SyntaxError, ValueError):
        return []
    if not isinstance(value, list):
        return []
    return [str(v) for v in value if v]


def _sanitize_checkpoint_id(raw_id: str, mapping: dict[str, str]) -> str:
    if raw_id in mapping:
        return mapping[raw_id]
    idx = len(mapping) + 1
    placeholder = f"CKPT{idx:016d}"
    mapping[raw_id] = placeholder
    return placeholder


def _sanitize_payload(payload: dict[str, Any], *, ckpt_map: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in STATE_KEYS:
        if key not in payload:
            continue
        value = payload[key]
        if key == "checkpoint_ids" and isinstance(value, list):
            out[key] = [_sanitize_checkpoint_id(str(v), ckpt_map) for v in value]
        elif key == "checkpoint_ids_analyzed" and isinstance(value, list):
            out[key] = [_sanitize_checkpoint_id(str(v), ckpt_map) for v in value]
        else:
            out[key] = value
    if payload.get("primary_agent"):
        out.setdefault("primary_agent", payload["primary_agent"])
    return out


def _payload_for_conformance(payload: dict[str, Any], *, ckpt_map: dict[str, str]) -> dict[str, Any]:
    """Full client payload with sanitized ids for conformance spec user_messages."""
    out = dict(payload)
    out.pop("property_id", None)
    for key in ("checkpoint_ids", "checkpoint_ids_analyzed"):
        if key in out and isinstance(out[key], list):
            out[key] = [_sanitize_checkpoint_id(str(v), ckpt_map) for v in out[key]]
    out.pop("search_location", None)
    return out


def _extract_user_payload_from_contents_line(line: str) -> dict[str, Any] | None:
    stripped = line.strip()
    if not stripped.startswith('{"parts":'):
        return None
    try:
        outer = json.loads(stripped)
        text = outer["parts"][0]["text"]
        inner = json.loads(text) if isinstance(text, str) else text
    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
        return None
    return inner if isinstance(inner, dict) else None


def _expect_from_resolved(resolved: dict[str, Any]) -> dict[str, Any]:
    expect: dict[str, Any] = {}
    for key in EVAL_SCALAR_EXPECT:
        if key in resolved and resolved[key] is not None:
            expect[key] = resolved[key]
    branches = resolved.get("run_optional_agents")
    if isinstance(branches, list):
        expect["run_optional_agents"] = sorted(set(str(b) for b in branches))
    return expect


def _expect_from_routing_log(
    *,
    route: str,
    retrieval_only: bool,
    optional: list[str],
    resolved: dict[str, Any],
) -> dict[str, Any]:
    if resolved:
        return _expect_from_resolved(resolved)
    expect: dict[str, Any] = {
        "route": route,
        "retrieval_only": retrieval_only,
        "run_optional_agents": sorted(set(optional)),
    }
    if optional:
        expect.setdefault("user_goal", "new_analysis")
        expect.setdefault("discourse_act", "new_work")
    elif retrieval_only:
        expect.setdefault("user_goal", "answer_from_context")
        expect.setdefault("discourse_act", ["new_work", "explain_prior"])
    else:
        expect.setdefault("user_goal", "new_analysis")
        expect.setdefault("discourse_act", "new_work")
    return expect


def parse_weblog(path: Path) -> list[WeblogTurn]:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    ckpt_map: dict[str, str] = {}

    turns: list[WeblogTurn] = []
    turn_index = 0
    pending_routing: dict[str, Any] | None = None
    pending_resolved: dict[str, Any] = {}
    pending_payload: dict[str, Any] | None = None
    resolved_blocks = list(RESOLVED_TURN_BLOCK_RE.finditer(text))

    def flush_turn() -> None:
        nonlocal turn_index, pending_routing, pending_resolved, pending_payload
        if not pending_routing:
            return
        turn_index += 1
        query = str(pending_routing.get("query") or "")
        payload = pending_payload or {}
        if not query and payload.get("user_query"):
            query = str(payload["user_query"])
        expect = _expect_from_routing_log(
            route=str(pending_routing.get("route") or "checkpoint"),
            retrieval_only=bool(pending_routing.get("retrieval_only")),
            optional=list(pending_routing.get("optional") or []),
            resolved={**pending_resolved, **(pending_routing.get("resolved_partial") or {})},
        )
        turns.append(
            WeblogTurn(
                source=path.name,
                turn_index=turn_index,
                query=query,
                payload=_sanitize_payload(payload, ckpt_map=ckpt_map),
                routing_log=pending_routing.get("kind"),
                resolved=pending_resolved,
                expect=expect,
            )
        )
        pending_routing = None
        pending_resolved = {}
        pending_payload = None

    resolved_iter = iter(resolved_blocks)
    next_resolved = next(resolved_iter, None)

    for line in lines:
        if next_resolved and line.startswith("[RESOLVED_TURN]"):
            try:
                pending_resolved = json.loads(next_resolved.group(1))
            except json.JSONDecodeError:
                pending_resolved = {}
            next_resolved = next(resolved_iter, None)
            continue

        m_exec = EXECUTOR_ONLY_RE.search(line)
        if m_exec:
            flush_turn()
            pending_routing = {
                "kind": "executor_only",
                "route": m_exec.group("route"),
                "retrieval_only": m_exec.group("retrieval_only") == "True",
                "optional": _parse_optional_branches(m_exec.group("optional")),
                "query": m_exec.group("query"),
            }
            continue

        m_chip = CHIP_RESOLVE_RE.search(line)
        if m_chip:
            flush_turn()
            pending_routing = {
                "kind": "chip",
                "route": m_chip.group("route"),
                "retrieval_only": m_chip.group("retrieval_only") == "True",
                "optional": _parse_optional_branches(m_chip.group("optional")),
                "query": m_chip.group("query"),
            }
            continue

        m_llm = RESOLVE_TURN_LLM_RE.search(line)
        if m_llm:
            flush_turn()
            optional = _parse_optional_branches(m_llm.group("optional"))
            pending_routing = {
                "kind": "llm",
                "route": m_llm.group("route"),
                "retrieval_only": m_llm.group("retrieval_only") == "True",
                "optional": optional,
                "resolved_partial": {
                    "discourse_act": m_llm.group("discourse_act"),
                    "intent": m_llm.group("intent"),
                    "route": m_llm.group("route"),
                    "user_goal": m_llm.group("user_goal"),
                    "retrieval_only": m_llm.group("retrieval_only") == "True",
                    "run_optional_agents": optional,
                },
            }
            continue

        m_substantive = RESOLVE_TURN_SUBSTANTIVE_RE.search(line)
        if m_substantive:
            if pending_routing and pending_routing.get("kind") == "llm":
                pending_routing["query"] = m_substantive.group("query")
                pending_routing["route"] = m_substantive.group("route")
                pending_routing["retrieval_only"] = (
                    m_substantive.group("retrieval_only") == "True"
                )
                pending_routing["optional"] = _parse_optional_branches(
                    m_substantive.group("optional")
                )
            else:
                flush_turn()
                pending_routing = {
                    "kind": "substantive",
                    "route": m_substantive.group("route"),
                    "retrieval_only": m_substantive.group("retrieval_only") == "True",
                    "optional": _parse_optional_branches(m_substantive.group("optional")),
                    "query": m_substantive.group("query"),
                    "resolved_partial": {
                        "user_goal": m_substantive.group("user_goal"),
                    },
                }
            continue

        m_casual = RESOLVE_TURN_CASUAL_RE.search(line)
        if m_casual:
            intent = m_casual.group("intent")
            query = m_casual.group("query")
            if pending_routing and pending_routing.get("kind") == "llm":
                pending_routing["kind"] = "casual"
                pending_routing["query"] = query
            else:
                flush_turn()
                pending_routing = {
                    "kind": "casual",
                    "route": "none",
                    "retrieval_only": True,
                    "optional": [],
                    "query": query,
                    "resolved_partial": {
                        "discourse_act": intent,
                        "intent": intent,
                        "route": "none",
                        "user_goal": "answer_from_context",
                        "retrieval_only": True,
                        "run_optional_agents": [],
                    },
                }
            flush_turn()
            continue

        if pending_routing and line.strip().startswith('{"parts":'):
            payload = _extract_user_payload_from_contents_line(line)
            if payload:
                pending_payload = payload
                flush_turn()

    flush_turn()
    return turns


def turns_to_routing_cases(turns: list[WeblogTurn], *, session_tag: str) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for turn in turns:
        case: dict[str, Any] = {
            "id": turn.case_id,
            "tags": ["weblog", session_tag, f"weblog_{session_tag}"],
            "query": turn.query,
        }
        if turn.payload:
            # Drop chip_action for free-text routing eval unless explicitly testing chips.
            state = dict(turn.payload)
            if turn.routing_log == "chip":
                case["tags"].append("chip")
            else:
                state.pop("chip_action", None)
            if state:
                case["state"] = state
        case["expect"] = turn.expect
        case["_source"] = f"{turn.source} turn {turn.turn_index}"
        cases.append(case)
    return cases


def write_routing_yaml(cases: list[dict[str, Any]], out_path: Path) -> None:
    doc_cases = []
    for case in cases:
        copy = dict(case)
        source = copy.pop("_source", None)
        header = f"# from {source}\n" if source else ""
        doc_cases.append({**copy, "_comment": header.strip() if header else None})
    # Strip _comment None entries for cleaner YAML
    cleaned = []
    for case in doc_cases:
        c = {k: v for k, v in case.items() if v is not None}
        cleaned.append(c)
    payload = {
        "#": "Draft routing eval cases — review, merge into executor_only/cases.yaml",
        "cases": cleaned,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        yaml.safe_dump(payload, sort_keys=False, allow_unicode=True, default_flow_style=False),
        encoding="utf-8",
    )


def write_conformance_spec(turns: list[WeblogTurn], out_dir: Path, *, session_name: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt_map: dict[str, str] = {}
    user_messages: list[dict[str, str]] = []
    for turn in turns:
        if not turn.payload:
            payload = {"user_query": turn.query, "primary_agent": "checkpoint"}
        else:
            payload = _payload_for_conformance(turn.payload, ckpt_map=ckpt_map)
            payload.setdefault("user_query", turn.query)
        user_messages.append({"text": json.dumps(payload, indent=2) + "\n"})

    spec = {
        "description": f"Draft from adk web log ({session_name}). Re-record with make conformance-record.",
        "agent": "property_agent",
        "initial_state": {},
        "user_messages": user_messages,
    }
    (out_dir / "spec.yaml").write_text(
        yaml.safe_dump(spec, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    expected = {
        "turns": [
            {
                "content_schema_version": 2,
                "content_markdown_present": True,
                "_note": "Fill content_json_* assertions after first live run",
            }
            for _ in user_messages
        ]
    }
    (out_dir / "expected_messages.yaml").write_text(
        yaml.safe_dump(expected, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Extract routing/conformance drafts from adk web logs.")
    parser.add_argument(
        "logs",
        nargs="+",
        type=Path,
        help="web-log file paths (glob expanded by shell)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=_PACKAGE_ROOT / "property_agent" / "evals" / "routing" / "drafts" / "weblog_cases.yaml",
        help="Routing eval YAML output (default: property_agent/evals/routing/drafts/weblog_cases.yaml)",
    )
    parser.add_argument(
        "--conformance",
        type=Path,
        metavar="DIR",
        help="Write one conformance spec per log under DIR/<session_name>/",
    )
    parser.add_argument(
        "--routing-only",
        action="store_true",
        help="Skip conformance output even if --conformance is set for a single log batch",
    )
    args = parser.parse_args(argv)

    all_cases: list[dict[str, Any]] = []
    for log_path in args.logs:
        if not log_path.is_file():
            print(f"skip missing file: {log_path}", file=sys.stderr)
            continue
        turns = parse_weblog(log_path.resolve())
        if not turns:
            print(f"no turns parsed: {log_path}", file=sys.stderr)
            continue
        session_tag = _slug_session_name(log_path)
        all_cases.extend(turns_to_routing_cases(turns, session_tag=session_tag))
        print(f"{log_path.name}: {len(turns)} turn(s)")
        if args.conformance and not args.routing_only:
            case_dir = args.conformance / session_tag
            write_conformance_spec(turns, case_dir, session_name=log_path.name)
            print(f"  conformance draft -> {case_dir}/spec.yaml")

    if not all_cases:
        print("No cases extracted.", file=sys.stderr)
        return 1

    write_routing_yaml(all_cases, args.out.resolve())
    print(f"Wrote {len(all_cases)} routing case draft(s) -> {args.out}")
    print(
        "Next: review drafts, merge into executor_only/cases.yaml, "
        'run: make routing-eval ARGS="--filter weblog"'
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
