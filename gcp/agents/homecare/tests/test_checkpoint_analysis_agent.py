"""Unit tests for checkpoint_analysis_agent Python parallel runner."""

import asyncio
import json
import re
from types import SimpleNamespace

import pytest
from google.adk.agents import Agent as LlmAgent

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


def test_parallel_agent_is_python_base_agent_not_llm():
    assert isinstance(caa.checkpoint_optional_parallel_agent, caa.CheckpointOptionalParallelAgent)
    assert not isinstance(caa.checkpoint_optional_parallel_agent, LlmAgent)
    assert not hasattr(caa.checkpoint_optional_parallel_agent, "model")


_LEGACY_PROSE_SAMPLE = """\
checkpoint_results:
Checkpoint Name: Checkpoint • May 11 • 9:10 PM
Summary: Gray garage door with paint damage.
Location/Asset: Garage
Issues: Significant paint chipping near the handle.

user_query: analyse my checkpoints
search_query: residential garage door paint chipping scratches repair
checkpoint_optional_agents: ['coverage', 'diy', 'service', 'cost']
context_doc_uris: ['gs://bucket/doc1.pdf']
property_address: 1982 Helena Way, Brentwood, CA 94513
property_id: nY3XQ92eUa02Qs14QWEn
location_coordinates: {'lat': 37.9, 'lng': -121.7}
location_radius: 5
"""


def test_parse_legacy_checkpoint_analysis_prose():
    data = caa.parse_legacy_checkpoint_analysis_prose(_LEGACY_PROSE_SAMPLE)
    assert data is not None
    assert "Gray garage door" in data["checkpoint_results"]
    assert data["user_query"] == "analyse my checkpoints"
    assert data["search_query"] == (
        "residential garage door paint chipping scratches repair"
    )
    assert data["checkpoint_optional_agents"] == [
        "coverage",
        "diy",
        "service",
        "cost",
    ]
    assert data["property_id"] == "nY3XQ92eUa02Qs14QWEn"
    assert data["location_coordinates"] == {"lat": 37.9, "lng": -121.7}
    assert data["location_radius"] == 5


def test_parse_checkpoint_analysis_input_from_legacy_prose():
    from google.genai import types

    user_content = types.Content(
        role="user",
        parts=[types.Part(text=_LEGACY_PROSE_SAMPLE)],
    )
    invocation = SimpleNamespace(
        user_content=user_content,
        session=SimpleNamespace(user_id="u1", state={}),
        invocation_id="inv-1",
        agent=caa.checkpoint_optional_parallel_agent,
        branch=None,
    )
    inp = caa._parse_checkpoint_analysis_input(invocation)
    assert inp is not None
    assert inp.checkpoint_optional_agents == [
        "coverage",
        "diy",
        "service",
        "cost",
    ]
    assert inp.search_query == "residential garage door paint chipping scratches repair"


def test_normalize_checkpoint_analysis_tool_args_from_request_blob():
    normalized = caa.normalize_checkpoint_analysis_tool_args(
        {"request": _LEGACY_PROSE_SAMPLE}
    )
    validated = caa.CheckpointAnalysisInput.model_validate(normalized)
    assert validated.user_query == "analyse my checkpoints"
    assert validated.checkpoint_optional_agents == [
        "coverage",
        "diy",
        "service",
        "cost",
    ]


_INLINE_REQUEST_SAMPLE = (
    "checkpoint_results: 'Checkpoint Name: Checkpoint • May 11 • 9:10 PM\\n"
    "Summary: Gray garage door with paint damage.\\n"
    "Location/Asset: Garage\\n"
    "Issues: Significant paint chipping near the handle.\\n"
    "Conditions: damaged, wear and tear', "
    "user_query: 'analyse my checkpoints', "
    "checkpoint_optional_agents: [ 'coverage', 'diy', 'service', 'cost' ], "
    "search_query: 'residential garage door paint chipping scratches repair' }"
)


def test_parse_inline_checkpoint_analysis_request():
    data = caa.parse_inline_checkpoint_analysis_request(_INLINE_REQUEST_SAMPLE)
    assert data is not None
    assert "Gray garage door" in data["checkpoint_results"]
    assert data["user_query"] == "analyse my checkpoints"
    assert data["checkpoint_optional_agents"] == [
        "coverage",
        "diy",
        "service",
        "cost",
    ]
    assert data["search_query"] == (
        "residential garage door paint chipping scratches repair"
    )


def test_normalize_checkpoint_analysis_tool_args_from_inline_request_blob():
    normalized = caa.normalize_checkpoint_analysis_tool_args(
        {"request": _INLINE_REQUEST_SAMPLE}
    )
    validated = caa.CheckpointAnalysisInput.model_validate(normalized)
    assert validated.user_query == "analyse my checkpoints"
    assert validated.checkpoint_optional_agents == [
        "coverage",
        "diy",
        "service",
        "cost",
    ]
    assert "Gray garage door" in validated.checkpoint_results


def test_normalize_checkpoint_analysis_tool_args_preserves_structured():
    structured = {
        "checkpoint_results": "Issues: leak",
        "user_query": "get diy",
        "checkpoint_optional_agents": ["diy"],
        "search_query": "garage leak",
    }
    assert caa.normalize_checkpoint_analysis_tool_args(structured) == structured


def test_parse_checkpoint_analysis_input_from_json():
    payload = {
        "checkpoint_results": "Issues: leak",
        "user_query": "get diy",
        "search_query": "garage door paint repair",
        "checkpoint_optional_agents": ["diy"],
        "property_address": "1 Main St",
    }
    session = SimpleNamespace(
        user_id="u1",
        state={},
        app_name="property_agent",
        id="sess-1",
    )
    from google.genai import types

    user_content = types.Content(
        role="user",
        parts=[types.Part(text=json.dumps(payload))],
    )
    invocation = SimpleNamespace(
        user_content=user_content,
        session=session,
        invocation_id="inv-1",
        agent=caa.checkpoint_optional_parallel_agent,
        branch=None,
    )
    inp = caa._parse_checkpoint_analysis_input(invocation)
    assert inp is not None
    assert inp.user_query == "get diy"
    assert inp.search_query == "garage door paint repair"
    assert inp.checkpoint_optional_agents == ["diy"]


@pytest.mark.asyncio
async def test_execute_checkpoint_optional_parallel_invokes_runner(monkeypatch):
    calls: list[dict] = []

    async def _capture(**kwargs):
        calls.append(kwargs)
        return "{}"

    monkeypatch.setattr(
        caa, "run_checkpoint_optional_agents_parallel", _capture
    )
    payload = {
        "checkpoint_results": "Issues: paint chip",
        "user_query": "get diy",
        "search_query": "garage door paint",
        "checkpoint_optional_agents": ["diy"],
    }
    session = SimpleNamespace(
        user_id="u1",
        state={},
        app_name="property_agent",
        id="sess-1",
    )
    from google.genai import types

    user_content = types.Content(
        role="user",
        parts=[types.Part(text=json.dumps(payload))],
    )
    agent = caa.checkpoint_optional_parallel_agent
    invocation = SimpleNamespace(
        user_content=user_content,
        session=session,
        invocation_id="inv-1",
        agent=agent,
        branch=None,
        app_name="property_agent",
        user_id="u1",
    )
    tool_ctx = await caa.execute_checkpoint_optional_parallel(invocation)
    assert len(calls) == 1
    assert calls[0]["checkpoint_optional_agents"] == ["diy"]
    assert calls[0]["search_query"] == "garage door paint"
    assert tool_ctx.state.get("checkpoint_retrieval_search_query") == "garage door paint"


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


def test_build_checkpoint_cost_query_uses_retrieval_seed_not_checkpoint_blob():
    payload = {
        "user_query": "garage door paint",
        "checkpoint_results": (
            "Issues: chipping.; Detected items: electrical outlet, door handle."
        ),
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
        "checkpoint_retrieval_search_query": (
            "residential garage door paint chipping scratches repair"
        ),
    }
    data = json.loads(caa._build_checkpoint_cost_query(payload))
    assert data["property_address"] == "1982 Helena Way, Brentwood, CA 94513"
    assert data["diagnosis"] == "residential garage door paint chipping scratches repair"
    assert "Checkpoint context" not in data["diagnosis"]
    assert "electrical outlet" not in data["diagnosis"]


def test_build_checkpoint_cost_query_falls_back_to_branch_user_query():
    payload = {
        "user_query": "garage door paint chips",
        "checkpoint_results": "Issues: chipping on panel with electrical outlet visible.",
        "checkpoint_retrieval_search_query": "",
    }
    data = json.loads(caa._build_checkpoint_cost_query(payload))
    assert data["diagnosis"] == "garage door paint chips"
    assert "Checkpoint context" not in data["diagnosis"]


def test_build_checkpoint_cost_query_omits_empty_address():
    payload = {
        "user_query": "q",
        "checkpoint_results": "Issues: leak",
        "property_address": "  ",
        "checkpoint_retrieval_search_query": "",
    }
    data = json.loads(caa._build_checkpoint_cost_query(payload))
    assert "property_address" not in data
    assert data["diagnosis"] == "q"


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


def test_resolve_effective_search_query_from_state():
    tc = _minimal_tool_context()
    tc.state["checkpoint_retrieval_search_query"] = "garage door paint repair"
    assert (
        caa.resolve_effective_search_query(None, tc)
        == "garage door paint repair"
    )
    assert (
        caa.resolve_effective_search_query("  explicit wins  ", tc)
        == "explicit wins"
    )


def test_search_query_from_analysis_json():
    payload = json.dumps(
        {
            "checkpoint_results": "x",
            "user_query": "q",
            "search_query": "residential garage door paint",
            "checkpoint_optional_agents": ["diy"],
        }
    )
    assert (
        caa._search_query_from_analysis_json(payload)
        == "residential garage door paint"
    )


def test_parallel_runner_uses_state_when_search_query_arg_missing(
    monkeypatch: pytest.MonkeyPatch,
):
    captured: list[dict] = []

    async def _capture_diy(payload):
        captured.append(dict(payload))
        return "ok"

    monkeypatch.setattr(caa, "_run_checkpoint_diy_pipeline", _capture_diy)
    tc = _minimal_tool_context()
    tc.state["checkpoint_retrieval_search_query"] = (
        "residential garage door paint chipping scratches repair"
    )
    asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="long blob " * 30,
            user_query="analyse my checkpoints",
            checkpoint_optional_agents=["diy"],
            search_query=None,
            tool_context=tc,
        )
    )
    assert len(captured) == 1
    assert (
        captured[0]["checkpoint_retrieval_search_query"]
        == "residential garage door paint chipping scratches repair"
    )
    assert captured[0]["user_query"] == (
        "residential garage door paint chipping scratches repair"
    )


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


def test_dual_format_guard_accepts_simple_query_shape():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    body = """# Your Recent Garage Checkpoints

```json
{
  "analysis": {
    "title": "Garage Checkpoint Overview",
    "checkpointSummary": {
      "checkpointsAnalyzed": 2,
      "queryType": "location-specific",
      "locations": ["Garage"],
      "dateRange": "May 11, 2026"
    },
    "checkpointDetails": [
      {"name": "Checkpoint • May 11 • 9:10 PM", "location": "Garage", "issues": ["paint chipping"]}
    ],
    "insights": {"patterns": "Both show paint damage.", "recommendations": "Repaint."}
  }
}
```
"""
    assert dfg.dual_format_has_valid_analysis_json(body)


def test_dual_format_guard_markdown_only_without_stub_json():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    md = "# My Analysis\n\nSome prose only."
    out = dfg.ensure_dual_format_body(md, parallel_results_json=None)
    assert "```json" not in out
    assert "My Analysis" in out
    assert not dfg.dual_format_has_valid_analysis_json(out)


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


def test_merge_parallel_fills_empty_youtube_and_products_from_diy_branch():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    synthesis_body = """# Garage Door Analysis

```json
{
  "analysis": {
    "title": "Garage Door Analysis",
    "checkpointSummary": {
      "checkpointsAnalyzed": 2,
      "issuesDetected": ["paint chipping"],
      "overallCondition": "Damaged",
      "locations": ["Garage"]
    },
    "diyResults": {
      "diySteps": {"summary": "Repaint steps", "steps": [{"stepNumber": 1, "description": "Sand"}]},
      "youtubeSearch": {"videos": []},
      "recommendedProducts": {"products": []}
    }
  }
}
```
"""
    parallel = json.dumps(
        {
            "checkpoint_parallel_diy_result": json.dumps(
                {
                    "hire_professional_recommended": False,
                    "diyResults": {
                        "diySteps": {
                            "summary": "Branch summary",
                            "steps": [{"stepNumber": 1, "description": "Clean surface"}],
                        },
                        "youtubeSearch": {
                            "videos": [
                                {
                                    "title": "Fix chipped paint",
                                    "url": "https://www.youtube.com/watch?v=abc",
                                    "description": "How to fix",
                                }
                            ]
                        },
                        "recommendedProducts": {
                            "products": [
                                {
                                    "item_name": "Exterior paint",
                                    "store_url": "https://example.com/paint",
                                }
                            ]
                        },
                    },
                }
            ),
            "checkpoint_parallel_coverage_result": "SKIPPED",
            "checkpoint_parallel_service_result": "SKIPPED",
            "checkpoint_parallel_cost_result": "SKIPPED",
        }
    )
    out = dfg.merge_parallel_results_into_dual_format(
        synthesis_body, parallel_results_json=parallel
    )
    m = re.search(r"```json\s*\n?([\s\S]*?)```", out, re.IGNORECASE)
    assert m
    blob = json.loads(m.group(1).strip())
    diy = blob["analysis"]["diyResults"]
    assert len(diy["youtubeSearch"]["videos"]) == 1
    assert diy["youtubeSearch"]["videos"][0]["url"] == "https://www.youtube.com/watch?v=abc"
    assert len(diy["recommendedProducts"]["products"]) == 1
    assert diy["diySteps"]["steps"][0]["description"] == "Sand"


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
    assert "```json" in out
    m = re.search(r"```json\s*\n?([\s\S]*?)```", out, re.IGNORECASE)
    assert m
    blob = json.loads(m.group(1).strip())
    assert isinstance(blob.get("analysis"), dict)
    assert "diyResults" in blob["analysis"]


def test_dual_format_guard_strips_invalid_json_fence_keeps_markdown():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    body = """# X

```json
not json at all
```

more md
"""
    out = dfg.ensure_dual_format_body(body, parallel_results_json=None)
    assert "```json" not in out
    assert not dfg.dual_format_has_valid_analysis_json(out)
    assert "not json at all" not in out
    assert "# X" in out
    assert "more md" in out


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
    assert "```json" in text
    m = re.search(r"```json\s*\n?([\s\S]*?)```", text, re.IGNORECASE)
    assert m
    blob = json.loads(m.group(1).strip())
    assert blob["analysis"]["coverageResult"]["warrantyInfo"] == "w"
    assert blob["analysis"]["coverageResult"]["insuranceInfo"] == "i"


def test_placeholder_checkpoint_summary_rejected_by_passthrough_quality():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    stub = """# Garage

```json
{"analysis": {"title": "Garage", "checkpointSummary": {"checkpointsAnalyzed": 0, "issuesDetected": [], "overallCondition": "See markdown above for details.", "locations": []}}}
```
"""
    good = """# Garage Door Analysis

Two checkpoints reviewed.

```json
{"analysis": {"title": "Garage Door Analysis", "checkpointSummary": {"checkpointsAnalyzed": 2, "issuesDetected": ["paint chipping"], "overallCondition": "Damaged", "locations": ["Garage"]}}}
```
"""
    assert not dfg.dual_format_is_passthrough_quality(stub)
    assert dfg.dual_format_is_passthrough_quality(good)


def test_stash_and_resolve_passthrough_dual_format():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    good = """# Garage Door Analysis

```json
{"analysis": {"title": "Garage Door Analysis", "checkpointSummary": {"checkpointsAnalyzed": 2, "issuesDetected": ["paint chipping"], "overallCondition": "Damaged", "locations": ["Garage"]}}}
```
"""
    state: dict = {}
    dfg.stash_checkpoint_dual_format_in_state(state, good)
    assert dfg.resolve_passthrough_dual_format_from_state(state) == good
    dfg.stash_checkpoint_dual_format_in_state(state, "not valid")
    assert dfg.resolve_passthrough_dual_format_from_state(state) == good


def test_build_checkpoint_summary_from_results_blob():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    blob = """Checkpoint Name: Garage May 11
Location/Asset: Garage
Issues: paint chipping on door
Conditions: fair

Checkpoint Name: Garage May 8
Location/Asset: Garage
Issues: minor wear
Conditions: good
"""
    summary = dfg.build_checkpoint_summary_from_results_blob(blob)
    assert summary["checkpointsAnalyzed"] == 2
    assert "Garage" in summary["locations"]
    assert summary["issuesDetected"]


def test_doculink_after_model_callback_skips_streaming_partials():
    from unittest.mock import MagicMock

    from google.adk.models.llm_response import LlmResponse
    from google.genai import types

    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    stashed = """# T

## Checkpoint Summary
- **Checkpoints Analyzed**: 1

```json
{"analysis": {"title": "T", "checkpointSummary": {"checkpointsAnalyzed": 1, "issuesDetected": ["x"], "overallCondition": "ok", "locations": ["Garage"]}}}
```
"""
    ctx = MagicMock()
    ctx.state = {dfg.CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY: stashed}
    partial = LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text="# T")]),
        partial=True,
    )
    assert dfg.doculink_after_model_callback(ctx, partial) is None

    final = LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text="incomplete")]),
        partial=False,
    )
    fixed = dfg.doculink_after_model_callback(ctx, final)
    assert fixed is not None
    assert "## Checkpoint Summary" in fixed.content.parts[0].text


def test_enrich_dual_format_markdown_adds_sections_from_json():
    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    thin = """# Garage Door Analysis

Short intro only.

```json
{
  "analysis": {
    "title": "Garage Door Analysis",
    "checkpointSummary": {
      "checkpointsAnalyzed": 2,
      "issuesDetected": ["paint chipping"],
      "overallCondition": "Damaged",
      "locations": ["Garage"]
    },
    "diyResults": {
      "diySteps": {
        "summary": "Sand and repaint.",
        "steps": [{"stepNumber": 1, "description": "Sand surface"}]
      }
    },
    "coverageResult": {
      "warrantyInfo": "Cosmetic wear excluded.",
      "insuranceInfo": "Maintenance item."
    }
  }
}
```
"""
    out = dfg.enrich_dual_format_markdown(thin)
    assert "## Checkpoint Summary" in out
    assert "## DIY Recommendations" in out
    assert "## Coverage" in out
    assert "Short intro only" in out
    assert "Sand surface" in out


def test_checkpoint_after_model_callback_restores_stashed_analysis():
    from unittest.mock import MagicMock

    from google.adk.models.llm_response import LlmResponse
    from google.genai import types

    from property_agent.sub_agents import checkpoint_dual_format_guard as dfg

    stashed = """# Garage Door Analysis

Full markdown from synthesis.

```json
{"analysis": {"title": "Garage Door Analysis", "checkpointSummary": {"checkpointsAnalyzed": 2, "issuesDetected": ["paint chipping"], "overallCondition": "Damaged", "locations": ["Garage"]}}}
```
"""
    stub_json = """```json
{"analysis": {"title": "Garage", "checkpointSummary": {"checkpointsAnalyzed": 0, "issuesDetected": [], "overallCondition": "See markdown above for details.", "locations": []}}}
```"""
    ctx = MagicMock()
    ctx.state = {dfg.CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY: stashed}
    resp = LlmResponse(
        content=types.Content(role="model", parts=[types.Part(text=stub_json)])
    )
    fixed = dfg.checkpoint_agent_after_model_callback(ctx, resp)
    assert fixed is not None
    text = fixed.content.parts[0].text
    assert dfg.dual_format_is_passthrough_quality(text)
    assert "Full markdown from synthesis" in text
    m = re.search(r"```json\s*\n?([\s\S]*?)```", text, re.IGNORECASE)
    assert m
    blob = json.loads(m.group(1).strip())
    assert blob["analysis"]["checkpointSummary"]["checkpointsAnalyzed"] == 2
