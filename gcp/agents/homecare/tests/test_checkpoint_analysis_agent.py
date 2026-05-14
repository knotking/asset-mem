"""Unit tests for checkpoint_analysis_agent Python parallel runner."""

import asyncio
import json
import re
from types import SimpleNamespace

import pytest

from property_agent.sub_agents.checkpoint_analysis_agent import agent as caa
from property_agent.sub_agents.checkpoint_agent.agent import build_search_query_from_checkpoints


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


def test_parallel_runner_writes_checkpoint_parallel_results_state(monkeypatch):
    monkeypatch.setattr(
        caa,
        "_invoke_optional_agent_async",
        _stub_invoke(default="coverage-ok"),
    )
    tc = _minimal_tool_context()
    out = asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="x",
            user_query="q",
            checkpoint_optional_agents=["coverage"],
            tool_context=tc,
        )
    )
    assert tc.state.get("checkpoint_parallel_results") == out
    data = json.loads(tc.state["checkpoint_parallel_results"])
    assert data["checkpoint_parallel_coverage_result"] == "coverage-ok"
    async def _diy_ok(_payload):
        return "diy-ok"

    monkeypatch.setattr(caa, "_run_checkpoint_diy_pipeline", _diy_ok)
    monkeypatch.setattr(
        caa,
        "_invoke_optional_agent_async",
        _stub_invoke(default="service-ok"),
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

    async def _capture_diy(payload):
        captured.append(dict(payload))
        return "ok"

    monkeypatch.setattr(caa, "_run_checkpoint_diy_pipeline", _capture_diy)
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
    assert captured[0]["checkpoint_retrieval_search_query"] == ""
    assert captured[0]["user_query"] != blob
    assert "9:10" not in captured[0]["user_query"]
    assert "diy tutorial" not in captured[0]["user_query"].lower()


def test_build_checkpoint_cost_query_includes_diagnosis_and_address():
    payload = {
        "user_query": "garage door paint",
        "checkpoint_results": "Issues: chipping on panel.",
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
        "checkpoint_retrieval_search_query": "",
    }
    raw = caa._build_checkpoint_cost_query(payload)
    data = json.loads(raw)
    assert data["property_address"] == "1982 Helena Way, Brentwood, CA 94513"
    assert "garage door paint" in data["diagnosis"]
    assert "Checkpoint context" in data["diagnosis"]
    assert "chipping" in data["diagnosis"].lower()


def test_build_checkpoint_cost_query_omits_empty_address():
    payload = {
        "user_query": "q",
        "checkpoint_results": "Issues: leak",
        "property_address": "  ",
        "checkpoint_retrieval_search_query": "",
    }
    data = json.loads(caa._build_checkpoint_cost_query(payload))
    assert "property_address" not in data
    assert "leak" in data["diagnosis"].lower()


def test_parallel_runner_cost_branch_calls_direct_pipeline(monkeypatch: pytest.MonkeyPatch):
    captured: list[str] = []

    def _sync_capture(query: str) -> str:
        captured.append(query)
        return '{"costEstimates": {"repair_type": "stub", "DIY": {}, "Service": {}, "comparison": {}}}'

    # checkpoint_analysis_agent imports _cost_estimation_sync by name; patch that binding.
    monkeypatch.setattr(caa, "_cost_estimation_sync", _sync_capture)
    out = asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="Issues: paint chip",
            user_query="estimate repair",
            checkpoint_optional_agents=["cost"],
            property_address="1 Main St, City, ST 12345",
            tool_context=_minimal_tool_context(),
        )
    )
    assert len(captured) == 1
    inner = json.loads(captured[0])
    assert inner.get("property_address") == "1 Main St, City, ST 12345"
    parsed = json.loads(out)
    assert "costEstimates" in json.loads(parsed["checkpoint_parallel_cost_result"])


def test_parallel_runner_prefers_explicit_search_query(monkeypatch: pytest.MonkeyPatch):
    captured: list[dict] = []

    async def _capture_diy(payload):
        captured.append(dict(payload))
        return "ok"

    monkeypatch.setattr(caa, "_run_checkpoint_diy_pipeline", _capture_diy)
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
    assert captured[0]["checkpoint_retrieval_search_query"] == explicit


def test_resolve_branch_search_user_query_prefers_explicit():
    q = caa.resolve_branch_search_user_query("  Kitchen   sink leak  ", "fallback blob " * 20)
    assert q == "Kitchen sink leak"


def test_resolve_branch_search_user_query_falls_back_when_empty():
    blob = (
        "Checkpoint 'Checkpoint • May 11 • 9:10 PM' (Garage): Detected door, handle. "
        "Issues: Significant paint chipping near handle. DIY tutorial how to fix"
    )
    q = caa.resolve_branch_search_user_query(None, blob)
    low = q.lower()
    assert "9:10" not in q
    assert "may 11" not in low
    assert "checkpoint •" not in low
    assert "diy tutorial" not in low


def test_resolve_branch_search_user_query_passes_through_without_coercion():
    messy = (
        "Garage door paint chipping Checkpoint 'Checkpoint • May 11 • 9:10 PM' (Garage): "
        "Significant paint chipping DIY tutorial how to fix"
    )
    blob = "ignored"
    q = caa.resolve_branch_search_user_query(messy, blob)
    assert "•" in q
    assert "checkpoint" in q.lower()


def test_build_search_query_from_checkpoints_joins_location_and_issues():
    q = build_search_query_from_checkpoints(
        [
            {
                "location": "Garage",
                "issues": [
                    {"description": "Paint chipping near handle"},
                    {"description": "Rust on hinges"},
                ],
            },
            {"location": "Kitchen", "issues": [{"description": "Loose faucet"}]},
        ]
    )
    assert "Garage" in q
    assert "Kitchen" in q
    assert "Paint chipping" in q or "chipping" in q
    assert "faucet" in q.lower()


def test_dual_format_guard_detects_valid_json_fence():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    body = """# Title

```json
{"analysis": {"title": "Title", "checkpointSummary": {"checkpointsAnalyzed": 1, "issuesDetected": ["x"], "overallCondition": "ok", "locations": ["Kitchen"]}}}
```
"""
    assert dfg.dual_format_has_valid_analysis_json(body)


def test_dual_format_guard_appends_when_markdown_only():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    md = "# My Analysis\n\nSome prose only."
    out = dfg.ensure_dual_format_body(md, parallel_results_json=None)
    assert "```json" in out
    assert "My Analysis" in out
    assert dfg.dual_format_has_valid_analysis_json(out)


def test_dual_format_guard_merges_fenced_coverage_coverage_result_shape():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    fenced = (
        "```json\n"
        + json.dumps(
            {
                "coverageResult": {
                    "warrantyInfo": "w",
                    "insuranceInfo": "i",
                }
            }
        )
        + "\n```"
    )
    parallel = json.dumps(
        {
            "checkpoint_parallel_coverage_result": fenced,
            "checkpoint_parallel_diy_result": "SKIPPED",
            "checkpoint_parallel_service_result": "SKIPPED",
            "checkpoint_parallel_cost_result": "SKIPPED",
        }
    )
    out = dfg.ensure_dual_format_body("# Garage Door\n\nProse only.", parallel_results_json=parallel)
    m = re.search(r"```json\s*\n?([\s\S]*?)```", out, re.IGNORECASE)
    assert m
    blob = json.loads(m.group(1).strip())
    cr = blob["analysis"]["coverageResult"]
    assert cr["warrantyInfo"] == "w"
    assert cr["insuranceInfo"] == "i"


def test_dual_format_guard_merges_parallel_diy_json():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    parallel = json.dumps(
        {
            "checkpoint_parallel_diy_result": json.dumps(
                {
                    "hire_professional_recommended": False,
                    "diyResults": {
                        "diySteps": {"summary": "s", "steps": []},
                        "youtubeSearch": {"videos": []},
                        "recommendedProducts": {"products": []},
                    },
                }
            ),
            "checkpoint_parallel_coverage_result": "SKIPPED",
            "checkpoint_parallel_service_result": "SKIPPED",
            "checkpoint_parallel_cost_result": "SKIPPED",
        }
    )
    out = dfg.ensure_dual_format_body("# T\n\nx", parallel_results_json=parallel)
    assert dfg.dual_format_has_valid_analysis_json(out)
    m = re.search(r"```json\s*\n?([\s\S]*?)```", out, re.IGNORECASE)
    assert m
    blob = json.loads(m.group(1).strip())
    assert isinstance(blob.get("analysis"), dict)
    assert "diyResults" in blob["analysis"]


def test_dual_format_guard_replaces_invalid_json_fence():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    body = """# X

```json
not json at all
```

more md
"""
    out = dfg.ensure_dual_format_body(body, parallel_results_json=None)
    assert out.count("```json") == 1
    assert dfg.dual_format_has_valid_analysis_json(out)
    assert "not json at all" not in out


def test_llm_response_declares_tool_use_detects_function_call():
    from google.adk.models.llm_response import LlmResponse
    from google.genai import types

    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    part = types.Part(
        function_call=types.FunctionCall(name="ask_checkpoints_retrieval", args={})
    )
    resp = LlmResponse(content=types.Content(role="model", parts=[part]))
    assert dfg.llm_response_declares_tool_use(resp) is True


def test_checkpoint_after_model_callback_skips_when_tool_calls():
    from unittest.mock import MagicMock

    from google.adk.models.llm_response import LlmResponse
    from google.genai import types

    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    part = types.Part(
        function_call=types.FunctionCall(name="ask_checkpoints_retrieval", args={})
    )
    resp = LlmResponse(content=types.Content(role="model", parts=[part]))
    ctx = MagicMock()
    assert dfg.checkpoint_agent_after_model_callback(ctx, resp) is None


def test_checkpoint_after_model_callback_merges_parallel_state():
    from unittest.mock import MagicMock

    from google.adk.models.llm_response import LlmResponse
    from google.genai import types

    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    parallel = json.dumps(
        {
            "checkpoint_parallel_coverage_result": json.dumps(
                {"coverageResult": {"warrantyInfo": "w", "insuranceInfo": "i"}}
            ),
            "checkpoint_parallel_diy_result": "SKIPPED",
            "checkpoint_parallel_service_result": "SKIPPED",
            "checkpoint_parallel_cost_result": "SKIPPED",
        }
    )
    ctx = MagicMock()
    ctx.state = {"checkpoint_parallel_results": parallel}
    resp = LlmResponse(
        content=types.Content(
            role="model",
            parts=[types.Part(text="# Garage\n\nProse only, no valid fence.")],
        )
    )
    fixed = dfg.checkpoint_agent_after_model_callback(ctx, resp)
    assert fixed is not None
    text = fixed.content.parts[0].text
    assert dfg.dual_format_has_valid_analysis_json(text)
    m = re.search(r"```json\s*\n?([\s\S]*?)```", text, re.IGNORECASE)
    assert m
    blob = json.loads(m.group(1).strip())
    assert blob["analysis"]["coverageResult"]["warrantyInfo"] == "w"
    assert blob["analysis"]["coverageResult"]["insuranceInfo"] == "i"
