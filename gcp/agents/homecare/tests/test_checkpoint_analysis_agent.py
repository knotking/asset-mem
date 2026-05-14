"""Unit tests for checkpoint_analysis_agent Python parallel runner."""

import asyncio
import json
from types import SimpleNamespace

import pytest

from property_agent.sub_agents.checkpoint_analysis_agent import agent as caa


def _minimal_tool_context():
    """Enough structure for run_checkpoint_optional_agents_parallel entry logic."""
    state: dict = {}
    session = SimpleNamespace(user_id="test-user", state=state)
    invocation_context = SimpleNamespace(session=session)
    return SimpleNamespace(_invocation_context=invocation_context, state=state)


def _stub_invoke(per_agent: dict | None = None, default: str = "ok"):
    """Build an async stand-in for _invoke_optional_agent_async."""

    async def _inner(agent, payload, tool_context):
        if per_agent is None:
            return default
        return per_agent.get(getattr(agent, "name", ""), default)

    return _inner


def test_parallel_runner_marks_unrequested_as_skipped(monkeypatch):
    monkeypatch.setattr(
        caa,
        "_invoke_optional_agent_async",
        _stub_invoke(default="coverage-ok"),
    )
    out = asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="x",
            user_query="q",
            checkpoint_optional_agents=["coverage"],
            tool_context=_minimal_tool_context(),
        )
    )
    parsed = json.loads(out)
    assert parsed["checkpoint_parallel_coverage_result"] == "coverage-ok"
    assert parsed["checkpoint_parallel_diy_result"] == "SKIPPED"
    assert parsed["checkpoint_parallel_service_result"] == "SKIPPED"
    assert parsed["checkpoint_parallel_cost_result"] == "SKIPPED"


def test_parallel_runner_runs_multiple_requested_branches(monkeypatch):
    monkeypatch.setattr(
        caa,
        "_invoke_optional_agent_async",
        _stub_invoke(per_agent={"diy_agent": "diy-ok"}, default="service-ok"),
    )
    out = asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="x",
            user_query="q",
            checkpoint_optional_agents=["diy", "service"],
            property_address="123 Main St",
            tool_context=_minimal_tool_context(),
        )
    )
    parsed = json.loads(out)
    assert parsed["checkpoint_parallel_diy_result"] == "diy-ok"
    assert parsed["checkpoint_parallel_service_result"] == "service-ok"


def test_parallel_runner_skips_all_when_tool_context_missing():
    out = asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="x",
            user_query="q",
            checkpoint_optional_agents=["coverage", "diy"],
            tool_context=None,
        )
    )
    parsed = json.loads(out)
    assert parsed["checkpoint_parallel_coverage_result"] == "SKIPPED"
    assert parsed["checkpoint_parallel_diy_result"] == "SKIPPED"


def test_optional_branch_search_user_query_strips_checkpoint_prose():
    blob = (
        "Checkpoint 'Checkpoint • May 11 • 9:10 PM' (Garage): Detected door, handle. "
        "Issues: Significant paint chipping near handle. DIY tutorial how to fix"
    )
    q = caa.optional_branch_search_user_query(blob)
    low = q.lower()
    assert "9:10" not in q
    assert "may 11" not in low
    assert "checkpoint •" not in low
    assert "diy tutorial" not in low
    assert "garage" in low or "paint" in low or "chipping" in low


def test_parallel_runner_payload_uses_search_user_query(monkeypatch: pytest.MonkeyPatch):
    captured: list[dict] = []

    async def _capture(agent, payload, tool_context):
        captured.append(dict(payload))
        return "ok"

    monkeypatch.setattr(caa, "_invoke_optional_agent_async", _capture)
    blob = (
        "Checkpoint 'Checkpoint • May 11 • 9:10 PM' (Garage): Detected door. "
        "Issues: Paint damage DIY tutorial how to fix"
    )
    asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results=blob,
            user_query="analyse my checkpoints",
            checkpoint_optional_agents=["diy"],
            tool_context=_minimal_tool_context(),
        )
    )
    assert len(captured) == 1
    assert captured[0]["checkpoint_results"] == blob
    assert captured[0]["user_query"] != blob
    assert "9:10" not in captured[0]["user_query"]
    assert "diy tutorial" not in captured[0]["user_query"].lower()


def test_parallel_runner_prefers_explicit_search_query(monkeypatch: pytest.MonkeyPatch):
    captured: list[dict] = []

    async def _capture(agent, payload, tool_context):
        captured.append(dict(payload))
        return "ok"

    monkeypatch.setattr(caa, "_invoke_optional_agent_async", _capture)
    blob = "long checkpoint prose " * 20
    explicit = "garage door paint touch up"
    asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results=blob,
            user_query="q",
            checkpoint_optional_agents=["diy"],
            search_query=explicit,
            tool_context=_minimal_tool_context(),
        )
    )
    assert len(captured) == 1
    assert captured[0]["user_query"] == explicit
