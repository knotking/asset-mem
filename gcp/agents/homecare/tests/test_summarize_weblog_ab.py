"""Tests for weblog full-turn A/B summarizer (includes legacy resolve-LLM log fixtures)."""

from __future__ import annotations

import json
from pathlib import Path

from property_agent.evals.routing.summarize_weblog_ab import (
    build_ab_report,
    parse_turn_metrics,
)

_SAMPLE = """\
INFO:     127.0.0.1:64063 - "POST /run_sse HTTP/1.1" 200 OK
2026-06-11 09:44:33,186 property_agent.routing.single_loop_routing INFO single_loop substantive route=checkpoint retrieval_only=True optional=[] query='Summarize the issues for the selected checkpoints'
{"parts":[{"function_call":{"name":"analyze_checkpoints","args":{"branches":[]}}}],"role":"model"}
2026-06-11 09:44:43,065 property_agent.observability.turn_request_timing INFO engine_turn_timing: ensure_runner_ms=- set_up_ms=- wire_runner_ms=- adk_stream_start_ms=0 adk_first_event_ms=193 runner_exec_start_ms=0 runner_first_event_ms=193 before_model_ms=0 resolve_ms=- executor_first_model_ms=3630 stream_complete_ms=10003 reason=adk_web_complete entrypoint=adk_web session_id=abc events=9
INFO:     127.0.0.1:64086 - "POST /run_sse HTTP/1.1" 200 OK
2026-06-11 09:44:48,256 property_agent.routing.chip_action INFO resolve_turn chip type=run_branch branch=diy topic=None route=checkpoint retrieval_only=False optional=['diy'] query='Run DIY analysis for the selected checkpoint'
{"parts":[{"function_call":{"name":"analyze_checkpoints","args":{"branches":["diy"]}}}],"role":"model"}
2026-06-11 09:44:55,535 property_agent.observability.turn_request_timing INFO engine_turn_timing: before_model_ms=0 resolve_ms=- executor_first_model_ms=2200 stream_complete_ms=2424 reason=adk_web_complete entrypoint=adk_web session_id=abc events=4
"""

_LEGACY_SAMPLE = """\
INFO:     127.0.0.1:64063 - "POST /run_sse HTTP/1.1" 200 OK
2026-06-11 10:28:03,889 property_agent.routing.resolve_turn_llm INFO resolve_turn_llm discourse_act=new_work intent=substantive route=checkpoint user_goal=new_analysis query_mode=interpret_session retrieval_only=True optional=[] elapsed_ms=3227
2026-06-11 10:28:03,891 property_agent.routing.homecare_resolve_hooks INFO resolve_turn substantive source=llm route=checkpoint user_goal=new_analysis query_mode=interpret_session retrieval_only=True optional=[] query='Summarize the issues for the selected checkpoints'
{"parts":[{"function_call":{"name":"run_checkpoint_pipeline","args":{}}}],"role":"model"}
2026-06-11 10:28:12,104 property_agent.observability.turn_request_timing INFO engine_turn_timing: before_model_ms=3229 resolve_ms=3226 executor_first_model_ms=5580 stream_complete_ms=11490 reason=adk_web_complete entrypoint=adk_web session_id=abc events=9
"""


def test_parse_turn_metrics_single_loop(tmp_path: Path) -> None:
    path = tmp_path / "web-log-session-1"
    path.write_text(_SAMPLE, encoding="utf-8")
    turns = parse_turn_metrics(path)
    assert len(turns) == 2
    assert turns[0].routing_mode == "single_loop"
    assert turns[0].stream_complete_ms == 10003
    assert turns[0].resolve_ms is None
    assert turns[0].tools_called == ["analyze_checkpoints"]
    assert turns[0].substantive is True
    assert turns[1].routing_kind == "resolve_turn chip"
    assert turns[1].tools_called == ["analyze_checkpoints"]


def test_parse_turn_metrics_legacy(tmp_path: Path) -> None:
    path = tmp_path / "web-log-legacy-session-1"
    path.write_text(_LEGACY_SAMPLE, encoding="utf-8")
    turns = parse_turn_metrics(path)
    assert len(turns) == 1
    assert turns[0].routing_mode == "resolve_llm"
    assert turns[0].resolve_ms == 3226
    assert turns[0].stream_complete_ms == 11490


def test_build_ab_report_paired(tmp_path: Path) -> None:
    (tmp_path / "web-log-session-1").write_text(_SAMPLE, encoding="utf-8")
    (tmp_path / "web-log-legacy-session-1").write_text(_LEGACY_SAMPLE, encoding="utf-8")
    report = build_ab_report(
        [tmp_path / "web-log-session-1", tmp_path / "web-log-legacy-session-1"]
    )
    assert report["total_turns"] == 3
    assert report["single_loop"]["turns"] == 2
    assert report["resolve_llm"]["turns"] == 1
    assert len(report["paired_session_1"]) == 1
    pair = report["paired_session_1"][0]
    assert pair["legacy_stream_ms"] == 11490
    assert pair["executor_stream_ms"] == 10003
    json.dumps(report)  # serializable
