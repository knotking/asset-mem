"""Unit tests for checkpoint_analysis_agent Python parallel runner."""

import json

from property_agent.sub_agents.checkpoint_analysis_agent import agent as caa


def test_parallel_runner_marks_unrequested_as_skipped(monkeypatch):
    monkeypatch.setattr(caa, "_invoke_optional_agent", lambda agent, payload: "coverage-ok")
    out = caa.run_checkpoint_optional_agents_parallel(
        checkpoint_results="x",
        user_query="q",
        checkpoint_optional_agents=["coverage"],
    )
    parsed = json.loads(out)
    assert parsed["checkpoint_parallel_coverage_result"] == "coverage-ok"
    assert parsed["checkpoint_parallel_diy_result"] == "SKIPPED"
    assert parsed["checkpoint_parallel_service_result"] == "SKIPPED"
    assert parsed["checkpoint_parallel_cost_result"] == "SKIPPED"


def test_parallel_runner_runs_multiple_requested_branches(monkeypatch):
    monkeypatch.setattr(
        caa,
        "_invoke_optional_agent",
        lambda agent, payload: "diy-ok" if getattr(agent, "name", "") == "diy_agent" else "service-ok",
    )
    out = caa.run_checkpoint_optional_agents_parallel(
        checkpoint_results="x",
        user_query="q",
        checkpoint_optional_agents=["diy", "service"],
        property_address="123 Main St",
    )
    parsed = json.loads(out)
    assert parsed["checkpoint_parallel_diy_result"] == "diy-ok"
    assert parsed["checkpoint_parallel_service_result"] == "service-ok"

