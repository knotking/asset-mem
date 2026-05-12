"""Unit tests for checkpoint_analysis_agent Python parallel runner."""

import asyncio
import json
from types import SimpleNamespace

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
