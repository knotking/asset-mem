"""Tests for diy_agent and DIY orchestrator."""

from __future__ import annotations

import asyncio
import inspect
import json

import pytest
from google.adk.tools.agent_tool import AgentTool

from property_agent.sub_agents.cost_agent.agent import cost_estimation_diy_from_library
from property_agent.sub_agents.diy_agent.agent import diy_agent, run_diy_pipeline
from property_agent.sub_agents.diy_agent import orchestrator as diy_orch


@pytest.fixture(autouse=True)
def clear_diy_cache() -> None:
    with diy_orch._CACHE_LOCK:
        diy_orch._DIY_CACHE.clear()
    yield
    with diy_orch._CACHE_LOCK:
        diy_orch._DIY_CACHE.clear()


def test_diy_agent_single_tool_no_nested_agent_tools() -> None:
    tools = list(diy_agent.tools)
    assert len(tools) == 1
    assert not any(isinstance(t, AgentTool) for t in tools)
    assert tools[0] is run_diy_pipeline
    assert inspect.iscoroutinefunction(run_diy_pipeline)


def test_infer_hire_professional_heuristics() -> None:
    assert diy_orch._infer_hire_professional("touch up paint on drywall") is False
    assert diy_orch._infer_hire_professional("gas line leak near stove") is True
    assert diy_orch._infer_hire_professional("replace main electrical service panel") is True


def test_cost_estimation_diy_from_library_returns_diy_slice() -> None:
    out = cost_estimation_diy_from_library("clogged sink drain DIY cost estimate")
    data = json.loads(out)
    assert "diyCostEstimates" in data
    assert "DIY" in data["diyCostEstimates"]


def test_run_diy_pipeline_fully_mocked(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DIY_ORCHESTRATOR_CACHE_TTL_SECONDS", "0")
    monkeypatch.setattr(diy_orch, "_diy_web_search_grounded", lambda d, a: "1. Turn off water.\n2. Replace washer.")
    monkeypatch.setattr(diy_orch, "_youtube_for_diagnosis", lambda d: [])
    monkeypatch.setattr(diy_orch, "_products_for_diagnosis", lambda d: '{"recommendedProducts":{}}')
    monkeypatch.setattr(
        diy_orch,
        "cost_estimation_diy_from_library",
        lambda q: '{"diyCostEstimates":{"repair_type":"t","DIY":{"cost_range":"$1-2"}}}',
    )
    monkeypatch.setattr(
        diy_orch,
        "_synthesize_diy_json",
        lambda diagnosis, web_summary, youtube_videos, products_json, cost_json: json.dumps(
            {
                "hire_professional_recommended": False,
                "diyResults": {
                    "diySteps": {"summary": "ok", "steps": [{"stepNumber": 1, "description": "x"}]},
                    "youtubeSearch": {"videos": []},
                    "recommendedProducts": {"products": []},
                    "diyCostEstimates": {"repair_type": "t", "DIY": {"cost_range": "$1-2"}},
                },
            }
        ),
    )
    out = asyncio.run(run_diy_pipeline(user_query="clogged drain", property_address=None))
    body = json.loads(out)
    assert "diyResults" in body
    assert body["diyResults"]["diySteps"]["summary"] == "ok"


def test_run_diy_pipeline_cache_hits_on_second_call(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DIY_ORCHESTRATOR_CACHE_TTL_SECONDS", "600")
    calls = {"n": 0}

    def counted_web(d: str, a: str) -> str:
        calls["n"] += 1
        return "cached web"

    monkeypatch.setattr(diy_orch, "_diy_web_search_grounded", counted_web)
    monkeypatch.setattr(diy_orch, "_youtube_for_diagnosis", lambda d: [])
    monkeypatch.setattr(diy_orch, "_products_for_diagnosis", lambda d: '{"recommendedProducts":{}}')
    monkeypatch.setattr(
        diy_orch,
        "cost_estimation_diy_from_library",
        lambda q: '{"diyCostEstimates":{}}',
    )
    fixed = json.dumps(
        {
            "hire_professional_recommended": False,
            "diyResults": {
                "diySteps": {"summary": "s", "steps": []},
                "youtubeSearch": {"videos": []},
                "recommendedProducts": {"products": []},
                "diyCostEstimates": {},
            },
        }
    )
    monkeypatch.setattr(
        diy_orch,
        "_synthesize_diy_json",
        lambda diagnosis, web_summary, youtube_videos, products_json, cost_json: fixed,
    )

    q = "identical cache key query"
    assert asyncio.run(run_diy_pipeline(q)) == fixed
    assert asyncio.run(run_diy_pipeline(q)) == fixed
    assert calls["n"] == 1
