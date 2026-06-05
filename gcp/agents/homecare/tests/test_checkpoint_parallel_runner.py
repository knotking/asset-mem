"""Unit tests for checkpoint optional-branch parallel runner."""

import asyncio
import json
import threading
from types import SimpleNamespace

import pytest

from property_agent.checkpoint.analysis import agent as caa
from property_agent.checkpoint.analysis import parallel_runner as parallel_mod
from property_agent.checkpoint.analysis.search_query import (
    CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY,
    _search_query_from_analysis_json,
)
from property_agent.checkpoint.retrieval.agent import (
    build_search_query_from_checkpoints,
)

from property_agent.checkpoint.analysis.analysis_validate import (
    llm_response_declares_tool_use,
    llm_response_has_function_responses,
)
from property_agent.checkpoint.analysis.assembler import (
    format_checkpoints_for_analysis_blob,
    minimal_checkpoint_progress_session_text,
    sync_checkpoint_tool_args_to_state,
)
from property_agent.checkpoint.analysis.markdown_render import (
    _overlay_branch_array,
    build_checkpoint_summary_from_results_blob,
)
from property_agent.checkpoint.session_input import (
    optional_agents_for_progress_from_state,
    should_run_optional_analysis,
)


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


_JSON_INPUT_SAMPLE = {
    "checkpoint_results": (
        "Checkpoint Name: Checkpoint • May 11 • 9:10 PM\n"
        "Summary: Gray garage door with paint damage.\n"
        "Location/Asset: Garage\n"
        "Issues: Significant paint chipping near the handle."
    ),
    "user_query": "analyse my checkpoints",
    "search_query": "residential garage door paint chipping scratches repair",
    "checkpoint_optional_agents": ["coverage", "diy", "service", "cost"],
    "context_doc_uris": ["gs://bucket/doc1.pdf"],
    "property_address": "1982 Helena Way, Brentwood, CA 94513",
    "property_id": "nY3XQ92eUa02Qs14QWEn",
    "search_location": {
        "source": "property_address",
        "radius_miles": 5,
        "coordinates": {"lat": 37.9, "lng": -121.7},
        "label": "1982 Helena Way, Brentwood, CA 94513",
    },
}


def test_parse_checkpoint_analysis_payload_json():
    data = caa.parse_checkpoint_analysis_payload(json.dumps(_JSON_INPUT_SAMPLE))
    assert data is not None
    assert "Gray garage door" in data["checkpoint_results"]
    assert data["user_query"] == "analyse my checkpoints"


def test_normalize_checkpoint_analysis_tool_args_from_request_json():
    normalized = caa.normalize_checkpoint_analysis_tool_args(
        {"request": json.dumps(_JSON_INPUT_SAMPLE)}
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


def test_parallel_runner_marks_unrequested_as_skipped(monkeypatch):
    monkeypatch.setattr(
        parallel_mod,
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
        parallel_mod,
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

    monkeypatch.setattr(parallel_mod, "_run_checkpoint_diy_pipeline", _diy_ok)
    monkeypatch.setattr(
        parallel_mod,
        "_invoke_optional_agent_async",
        _stub_invoke(per_agent={"service_agent": "service-ok"}),
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


def test_parallel_runner_all_four_branches_merged(monkeypatch):
    """Regression: every requested branch key is present in final JSON."""

    async def _diy_ok(_payload):
        return "diy-ok"

    async def _cost_ok(_payload):
        return "cost-ok"

    monkeypatch.setattr(parallel_mod, "_run_checkpoint_diy_pipeline", _diy_ok)
    monkeypatch.setattr(parallel_mod, "_run_checkpoint_cost_pipeline", _cost_ok)
    monkeypatch.setattr(
        parallel_mod,
        "_invoke_optional_agent_async",
        _stub_invoke(
            per_agent={
                "coverage_agent": "coverage-ok",
                "service_agent": "service-ok",
            }
        ),
    )
    tc = _minimal_tool_context()
    out = asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="x",
            user_query="q",
            checkpoint_optional_agents=["coverage", "diy", "service", "cost"],
            tool_context=tc,
        )
    )
    parsed = json.loads(out)
    assert parsed["checkpoint_parallel_coverage_result"] == "coverage-ok"
    assert parsed["checkpoint_parallel_diy_result"] == "diy-ok"
    assert parsed["checkpoint_parallel_service_result"] == "service-ok"
    assert parsed["checkpoint_parallel_cost_result"] == "cost-ok"
    assert json.loads(tc.state["checkpoint_parallel_results"]) == parsed


def test_parallel_runner_completion_order_independent(monkeypatch):
    """Final JSON is complete regardless of which branch finishes first."""

    delays = {"coverage": 0.05, "service": 0.01}

    async def _invoke(agent, payload, tool_context):
        name = getattr(agent, "name", "")
        if name == "coverage_agent":
            await asyncio.sleep(delays["coverage"])
            return "coverage-ok"
        return "ok"

    async def _invoke_with_service_delay(agent, payload, tool_context):
        name = getattr(agent, "name", "")
        if name == "service_agent":
            await asyncio.sleep(delays["service"])
            return "service-ok"
        return await _invoke(agent, payload, tool_context)

    monkeypatch.setattr(parallel_mod, "_invoke_optional_agent_async", _invoke_with_service_delay)
    out = asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="x",
            user_query="q",
            checkpoint_optional_agents=["coverage", "service"],
            tool_context=_minimal_tool_context(),
        )
    )
    parsed = json.loads(out)
    assert parsed["checkpoint_parallel_coverage_result"] == "coverage-ok"
    assert parsed["checkpoint_parallel_service_result"] == "service-ok"


def test_parallel_runner_prefetch_overlaps_coverage(monkeypatch: pytest.MonkeyPatch) -> None:
    """Prefetch runs concurrently with coverage (not a 12s gate before all branches)."""
    prefetch_started = threading.Event()
    release_prefetch = threading.Event()

    def _slow_prefetch(_payload: dict) -> str:
        prefetch_started.set()
        release_prefetch.wait(timeout=5)
        return "shared-web-summary"

    monkeypatch.setattr(
        parallel_mod, "prefetch_checkpoint_web_context", _slow_prefetch
    )
    coverage_during_prefetch: list[bool] = []

    async def _invoke(agent, payload, tool_context):
        if getattr(agent, "name", "") == "coverage_agent":
            coverage_during_prefetch.append(prefetch_started.is_set())
            release_prefetch.set()
            return json.dumps(
                {
                    "coverageResult": {
                        "warrantyInfo": "w",
                        "insuranceInfo": "i",
                    }
                }
            )
        return "ok"

    async def _diy_ok(payload):
        assert payload.get("checkpoint_grounding_web_summary") == "shared-web-summary"
        return "diy-ok"

    async def _cost_ok(payload):
        assert payload.get("checkpoint_grounding_web_summary") == "shared-web-summary"
        return "cost-ok"

    monkeypatch.setattr(parallel_mod, "_invoke_optional_agent_async", _invoke)
    monkeypatch.setattr(parallel_mod, "_run_checkpoint_diy_pipeline", _diy_ok)
    monkeypatch.setattr(parallel_mod, "_run_checkpoint_cost_pipeline", _cost_ok)
    asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="x",
            user_query="q",
            checkpoint_optional_agents=["coverage", "diy", "cost"],
            tool_context=_minimal_tool_context(),
        )
    )
    assert coverage_during_prefetch == [True]


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


def test_parallel_runner_payload_uses_search_user_query(
    monkeypatch: pytest.MonkeyPatch,
):
    captured: list[dict] = []

    async def _capture_diy(payload):
        captured.append(dict(payload))
        return "ok"

    monkeypatch.setattr(parallel_mod, "_run_checkpoint_diy_pipeline", _capture_diy)
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


def test_build_checkpoint_cost_query_uses_property_address_when_gps_has_no_label():
    payload = {
        "user_query": "garage door paint",
        "checkpoint_results": "Issues: chipping.",
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
        "search_location": {
            "source": "device_gps",
            "radius_miles": 5,
            "coordinates": {"lat": 37.9, "lng": -121.7},
        },
        "checkpoint_retrieval_search_query": "garage door paint repair",
    }
    data = json.loads(caa._build_checkpoint_cost_query(payload))
    assert data["market_location"] == "1982 Helena Way, Brentwood, CA 94513"
    assert data["property_address"] == "1982 Helena Way, Brentwood, CA 94513"


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
    assert data["market_location"] == "1982 Helena Way, Brentwood, CA 94513"
    assert (
        data["diagnosis"] == "residential garage door paint chipping scratches repair"
    )
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
    assert "market_location" not in data
    assert "property_address" not in data
    assert data["diagnosis"] == "q"


def test_parallel_runner_cost_branch_calls_direct_pipeline(
    monkeypatch: pytest.MonkeyPatch,
):
    captured: list[str] = []

    def _sync_capture(query: str) -> str:
        captured.append(query)
        return '{"costEstimates": {"repair_type": "stub", "DIY": {}, "Service": {}, "comparison": {}}}'

    # parallel_runner imports _cost_estimation_sync by name; patch that binding.
    monkeypatch.setattr(parallel_mod, "_cost_estimation_sync", _sync_capture)
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
    assert inner.get("market_location") == "1 Main St, City, ST 12345"
    assert inner.get("property_address") == "1 Main St, City, ST 12345"
    parsed = json.loads(out)
    assert "costEstimates" in json.loads(parsed["checkpoint_parallel_cost_result"])


def test_resolve_effective_search_query_from_state():
    tc = _minimal_tool_context()
    tc.state["checkpoint_retrieval_search_query"] = "garage door paint repair"
    assert caa.resolve_effective_search_query(None, tc) == "garage door paint repair"
    assert (
        caa.resolve_effective_search_query("  explicit wins  ", tc) == "explicit wins"
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
        _search_query_from_analysis_json(payload) == "residential garage door paint"
    )


def test_parallel_runner_uses_state_when_search_query_arg_missing(
    monkeypatch: pytest.MonkeyPatch,
):
    captured: list[dict] = []

    async def _capture_diy(payload):
        captured.append(dict(payload))
        return "ok"

    monkeypatch.setattr(parallel_mod, "_run_checkpoint_diy_pipeline", _capture_diy)
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


def test_parallel_runner_service_uses_stem_under_branch_explicit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from property_agent.routing.resolve_turn import RESOLVED_TURN_STATE_KEY, ResolvedTurn

    captured: list[dict] = []

    async def _capture_service(agent, payload, tool_context):
        if getattr(agent, "name", "") == "service_agent":
            captured.append(dict(payload))
        return "ok"

    monkeypatch.setattr(parallel_mod, "_invoke_optional_agent_async", _capture_service)
    stem = "residential garage door paint chipping scratches repair"
    tc = _minimal_tool_context()
    tc.state[CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY] = stem
    tc.state[RESOLVED_TURN_STATE_KEY] = ResolvedTurn(
        intent="substantive",
        route="checkpoint",
        expanded_user_query="analyse my checkpoints for coverage, diy, service, and cost",
        retrieval_only=False,
        run_optional_agents=["service"],
        user_goal="new_analysis",
        query_mode="branch_explicit",
    ).to_dict()
    asyncio.run(
        caa.run_checkpoint_optional_agents_parallel(
            checkpoint_results="Checkpoint Garage Issues: paint chipping " * 5,
            user_query="analyse my checkpoints for coverage, diy, service, and cost",
            checkpoint_optional_agents=["service"],
            search_query=None,
            tool_context=tc,
        )
    )
    assert len(captured) == 1
    assert captured[0]["user_query"] == stem
    assert captured[0]["checkpoint_retrieval_search_query"] == stem


def test_parallel_runner_prefers_explicit_search_query(monkeypatch: pytest.MonkeyPatch):
    captured: list[dict] = []

    async def _capture_diy(payload):
        captured.append(dict(payload))
        return "ok"

    monkeypatch.setattr(parallel_mod, "_run_checkpoint_diy_pipeline", _capture_diy)
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
    q = caa.resolve_branch_search_user_query(
        "  Kitchen   sink leak  ", "fallback blob " * 20
    )
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


def test_render_analysis_markdown_includes_product_prices():
    from property_agent.checkpoint.analysis.markdown_render import (
        render_analysis_markdown,
    )

    md = render_analysis_markdown(
        {
            "title": "Checkpoint analysis",
            "diyResults": {
                "recommendedProducts": {
                    "products": [
                        {
                            "item_name": "Scratch Doctor",
                            "vendor": "Ace Hardware",
                            "item_price": "$14.99",
                        },
                        {
                            "item_name": "Paint kit",
                            "vendor": "Dr. ColorChip",
                        },
                    ]
                }
            },
        }
    )
    assert "**Recommended products:**" in md
    assert "- Scratch Doctor (Ace Hardware) — $14.99" in md
    assert "- Paint kit (Dr. ColorChip)" in md
    assert "- Paint kit (Dr. ColorChip) —" not in md


def test_render_analysis_markdown_service_provider_review_label():
    from property_agent.checkpoint.analysis.markdown_render import (
        render_analysis_markdown,
    )

    md = render_analysis_markdown(
        {
            "title": "Checkpoint analysis",
            "serviceResults": {
                "localPros": {
                    "serpAPIResults": [
                        {
                            "name": "Up Right Garage Door Repair",
                            "rating": 4.9,
                            "reviews": 91,
                            "phone": "(925) 293-8232",
                        },
                        {
                            "name": "Terrell Painting, Inc.",
                            "rating": 5.0,
                            "reviews": "21 reviews",
                            "phone": "(925) 500-7000",
                        },
                    ]
                }
            },
        }
    )
    assert "## Service Providers" in md
    assert "(rating 4.9, 91 reviews)" in md
    assert "(rating 5.0, 21 reviews)" in md


def test_render_analysis_markdown_service_provider_distance_label():
    from property_agent.checkpoint.analysis.markdown_render import (
        render_analysis_markdown,
    )

    md = render_analysis_markdown(
        {
            "title": "Checkpoint analysis",
            "serviceResults": {
                "localPros": {
                    "serpAPIResults": [
                        {
                            "name": "Up Right Garage Door Repair",
                            "rating": 4.9,
                            "reviews": 91,
                            "distance_miles": 0.6,
                            "phone": "(925) 293-8232",
                        },
                    ]
                }
            },
        }
    )
    assert "(rating 4.9, 0.6 mi, 91 reviews)" in md


def test_render_analysis_markdown_product_store_url_is_link():
    from property_agent.checkpoint.analysis.markdown_render import (
        render_analysis_markdown,
    )

    md = render_analysis_markdown(
        {
            "title": "Checkpoint analysis",
            "diyResults": {
                "recommendedProducts": {
                    "products": [
                        {
                            "item_name": "Scratch Doctor",
                            "vendor": "Ace Hardware",
                            "item_price": "$14.99",
                            "store_url": "https://www.google.com/search?ibp=oshop&q=test",
                        },
                        {
                            "item_name": "Paint kit",
                            "vendor": "Dr. ColorChip",
                            "store_url": "N/A",
                        },
                    ]
                }
            },
        }
    )
    assert (
        "- [Scratch Doctor (Ace Hardware) — $14.99]"
        "(https://www.google.com/search?ibp=oshop&q=test)"
    ) in md
    assert "- Paint kit (Dr. ColorChip)" in md
    assert "](https://www.google.com" not in md.split("Paint kit")[1].split("\n")[0]






def test_overlay_branch_array_prefers_branch_when_non_empty():
    assert len(_overlay_branch_array([{"a": 1}], [{"a": 1}, {"b": 2}])) == 2
    assert _overlay_branch_array([], [{"a": 1}]) == [{"a": 1}]
    assert _overlay_branch_array([{"a": 1}], []) == [{"a": 1}]






def test_llm_response_declares_tool_use_detects_function_call():
    from google.adk.models.llm_response import LlmResponse
    from google.genai import types

    part = types.Part(
        function_call=types.FunctionCall(name="ask_checkpoints_retrieval", args={})
    )
    resp = LlmResponse(content=types.Content(role="model", parts=[part]))
    assert llm_response_declares_tool_use(resp) is True
    assert llm_response_has_function_responses(resp) is False


def test_llm_response_has_function_responses():
    from google.adk.models.llm_response import LlmResponse
    from google.genai import types

    part = types.Part(
        function_response=types.FunctionResponse(
            name="ask_checkpoints_retrieval",
            response={"ok": True},
        )
    )
    resp = LlmResponse(content=types.Content(role="user", parts=[part]))
    assert llm_response_declares_tool_use(resp) is False
    assert llm_response_has_function_responses(resp) is True




def test_build_checkpoint_summary_from_results_blob():
    blob = """Checkpoint Name: Garage May 11
Location/Asset: Garage
Issues: paint chipping on door
Conditions: fair

Checkpoint Name: Garage May 8
Location/Asset: Garage
Issues: minor wear
Conditions: good
"""
    summary = build_checkpoint_summary_from_results_blob(blob)
    assert summary["checkpointsAnalyzed"] == 2
    assert "Garage" in summary["locations"]
    assert summary["issuesDetected"]


def test_sync_checkpoint_tool_args_to_state():
    state: dict = {}
    sync_checkpoint_tool_args_to_state(
        state,
        {
            "user_query": "analyse",
            "checkpoint_optional_agents": ["coverage", "diy"],
            "property_id": "prop1",
        },
    )
    assert state["checkpoint_optional_agents"] == ["coverage", "diy"]
    assert state["property_id"] == "prop1"


def test_optional_agents_from_resolved_turn():
    from property_agent.routing.resolve_turn import RESOLVED_TURN_STATE_KEY
    state = {
        RESOLVED_TURN_STATE_KEY: {
            "intent": "substantive",
            "route": "checkpoint",
            "expanded_user_query": (
                "What might repairs cost for the garage door at 1982 Helena Way?"
            ),
            "retrieval_only": False,
            "run_optional_agents": ["cost"],
            "resolve_source": "llm",
        },
        "checkpoint_results": "Checkpoint Name: Garage\nIssues: chip",
        "user_query": "ok. how about cost?",
    }
    assert optional_agents_for_progress_from_state(state) == ["cost"]
    assert should_run_optional_analysis(
        state, "What might repairs cost for the garage door?"
    )


def test_format_checkpoints_for_analysis_blob():
    formatted = [
        {
            "checkpointName": "Garage May 11",
            "location": "Garage",
            "text": "Summary: door wear\nIssues: paint chipping",
        },
        {
            "checkpointName": "Garage May 8",
            "location": "Garage",
            "text": "Issues: minor wear",
        },
    ]
    blob = format_checkpoints_for_analysis_blob(formatted)
    assert "Garage May 11" in blob
    assert "Garage May 8" in blob
    assert "paint chipping" in blob
    assert blob.count("Checkpoint Name:") == 2


def test_minimal_checkpoint_progress_session_text():
    slim = minimal_checkpoint_progress_session_text(
        completed_branches=["coverage"],
        pending_branches=["diy"],
        requested_branches=["coverage", "diy"],
    )
    assert "Progress 1/2" in slim
    assert "coverage" in slim
    assert "running: diy" in slim
    assert "```json" not in slim




@pytest.mark.asyncio
async def test_parallel_runner_emits_progressive_callbacks(monkeypatch):
    order: list[str] = []

    async def _stub_branch(name, payload, tool_context):
        return f"{name}-ok"

    async def on_complete(branch, results, analysis, tool_context, **kwargs):
        order.append(branch or "phase0")
        assert isinstance(analysis, dict)
        assert analysis.get("title")
        session_event_text = kwargs.get("session_event_text") or ""
        assert "```json" not in session_event_text

    monkeypatch.setattr(parallel_mod, "_run_single_optional_agent_async", _stub_branch)
    blob = """Checkpoint Name: Garage
Location/Asset: Garage
Issues: paint chipping
"""
    await caa.run_checkpoint_optional_agents_parallel(
        checkpoint_results=blob,
        user_query="analyse",
        checkpoint_optional_agents=["coverage", "diy"],
        tool_context=_minimal_tool_context(),
        on_branch_complete=on_complete,
    )
    assert order[0] == "phase0"
    assert set(order[1:]) == {"coverage", "diy"}
    assert len(order) == 3
