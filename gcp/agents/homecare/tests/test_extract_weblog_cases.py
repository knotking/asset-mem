"""Tests for weblog → routing eval draft extraction (no live LLM)."""

from __future__ import annotations

import json
from pathlib import Path

from property_agent.evals.routing.extract_weblog_cases import (
    WeblogTurn,
    parse_weblog,
    turns_to_routing_cases,
    _extract_user_payload_from_contents_line,
)

_USER_PAYLOAD = {
    "user_query": "Summarize the issues for the selected checkpoints",
    "primary_agent": "checkpoint",
    "checkpoint_ids": ["XfskPwCufyxbzCJF7XTm"],
    "checkpoint_optional_agents": [],
}
_CONTENTS_LINE = json.dumps(
    {"parts": [{"text": json.dumps(_USER_PAYLOAD)}], "role": "user"},
    separators=(",", ":"),
)

_SAMPLE = f"""\
INFO:     127.0.0.1:64063 - "POST /run_sse HTTP/1.1" 200 OK
2026-06-11 09:44:33,186 property_agent.routing.executor_only_routing INFO executor_only substantive route=checkpoint retrieval_only=True optional=[] query='Summarize the issues for the selected checkpoints'
Contents:
{_CONTENTS_LINE}
-----------------------------------------------------------
INFO:     127.0.0.1:64086 - "POST /run_sse HTTP/1.1" 200 OK
2026-06-11 09:44:48,256 property_agent.routing.chip_action INFO resolve_turn chip type=run_branch branch=diy topic=None route=checkpoint retrieval_only=False optional=['diy'] query='Run DIY analysis for the selected checkpoint'
[RESOLVED_TURN]
{{
  "route": "checkpoint",
  "retrieval_only": false,
  "run_optional_agents": ["diy"],
  "user_goal": "new_analysis",
  "discourse_act": "new_work",
  "focus_branch": "diy"
}}
[/RESOLVED_TURN]
Contents:
{{"parts":[{{"text":"{{\\"user_query\\": \\"Run DIY analysis for the selected checkpoint\\", \\"chip_action\\": {{\\"type\\": \\"run_branch\\", \\"branch\\": \\"diy\\"}}}}"}}],"role":"user"}}
"""


def test_extract_user_payload_from_contents_line() -> None:
    payload = _extract_user_payload_from_contents_line(_CONTENTS_LINE)
    assert payload == _USER_PAYLOAD


def test_parse_weblog_executor_and_chip(tmp_path: Path) -> None:
    path = tmp_path / "web-log-sample"
    path.write_text(_SAMPLE, encoding="utf-8")
    turns = parse_weblog(path)
    assert len(turns) == 2

    t1 = turns[0]
    assert t1.query == "Summarize the issues for the selected checkpoints"
    assert t1.expect["retrieval_only"] is True
    assert t1.expect["run_optional_agents"] == []
    assert t1.payload["checkpoint_ids"] == ["CKPT0000000000000001"]

    t2 = turns[1]
    assert t2.expect["discourse_act"] == "new_work"
    assert t2.expect["run_optional_agents"] == ["diy"]


def test_parse_weblog_legacy_resolve_llm(tmp_path: Path) -> None:
    sample = """\
2026-06-11 10:33:55,659 property_agent.routing.resolve_turn_llm INFO resolve_turn_llm discourse_act=greeting intent=greeting route=none user_goal=answer_from_context query_mode=interpret_session retrieval_only=True optional=[] elapsed_ms=2696
2026-06-11 10:33:55,661 property_agent.routing.homecare_resolve_hooks INFO resolve_turn casual intent=greeting source=llm query='hi'
"""
    path = tmp_path / "web-log-legacy"
    path.write_text(sample, encoding="utf-8")
    turns = parse_weblog(path)
    assert len(turns) == 1
    assert turns[0].query == "hi"
    assert turns[0].expect["discourse_act"] == "greeting"
    assert turns[0].expect["route"] == "none"


def test_turns_to_routing_cases_tags() -> None:
    turn = WeblogTurn(
        source="web-log-session-1",
        turn_index=1,
        query="hello",
        expect={"route": "checkpoint", "retrieval_only": True, "run_optional_agents": []},
    )
    cases = turns_to_routing_cases([turn], session_tag="session_1")
    assert cases[0]["tags"] == ["weblog", "session_1", "weblog_session_1"]
