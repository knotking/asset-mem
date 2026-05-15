"""Tests for diy_agent and DIY orchestrator.

Fast tests mock network and LLM paths. Optional **live** YouTube and SerpAPI
product checks use the same gate as ``test_diy_external_integration.py``:

- Set ``RUN_EXTERNAL_DIY_SEARCH_TESTS=1``
- YouTube live tests: ``YOUTUBE_API_KEY`` (YouTube Data API v3)
- Product test also needs ``SERP_API_KEY`` (``.env`` is loaded via ``tests.diy_live_helpers``)

Example::

    RUN_EXTERNAL_DIY_SEARCH_TESTS=1 uv run pytest tests/test_diy_agent.py -v -s -k "live_orchestrator"

Use ``pytest -s`` on the mocked pipeline tests too to see pretty-printed ``run_diy_pipeline`` JSON after the (mocked) parallel fetch + synthesis.
"""

from __future__ import annotations

import asyncio
import inspect
import json

import pytest
from google.adk.tools.agent_tool import AgentTool

from property_agent.sub_agents.cost_agent.agent import cost_estimation_diy_from_library
from property_agent.sub_agents.diy_agent.agent import diy_agent, run_diy_pipeline
from property_agent.sub_agents.diy_agent import orchestrator as diy_orch
from tests.diy_live_helpers import (
    print_product_results,
    print_run_diy_pipeline_tool_output,
    print_youtube_results,
    requires_external_diy_search,
    requires_serpapi_key,
    requires_youtube_api_key,
)


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


def test_compact_diy_search_seed_strips_checkpoint_boilerplate() -> None:
    blob = """analyse my checkpoints

Checkpoint context:
Checkpoint Name: Checkpoint • May 11 • 9:10 PM
Summary: A close-up view of a gray garage door showing significant paint damage and scratches, particularly around the handle area.
Location/Asset: Garage
Detected items: door, door handle, deadbolt, wall outlet
Issues: Significant paint chipping and scratching on the door surface near the handle.
"""
    seed = diy_orch._compact_diy_search_seed(blob)
    low = seed.lower()
    assert "garage" in low
    assert "paint" in low
    assert "analyse my" not in low
    assert "checkpoint name" not in low
    assert "detected items" not in low
    assert ".." not in seed
    assert len(seed) <= diy_orch._diy_search_seed_max_chars() + 20


def test_compact_diy_search_seed_plain_issue_unchanged() -> None:
    assert diy_orch._compact_diy_search_seed("replace faucet washer") == "replace faucet washer"


def test_compact_diy_search_seed_inline_comma_checkpoint_format() -> None:
    """Client may send one-line checkpoint context (comma-separated labels)."""
    blob = (
        "analyse my checkpoints\n\nCheckpoint context:\n"
        "Checkpoint Name: Checkpoint • May 11 • 9:10 PM, Location: Garage, "
        "Summary: A close-up view of a gray garage door showing significant paint damage "
        "and scratches, particularly around the handle area., "
        "Issues: Significant paint chipping and scratching on the door surface near the handle."
    )
    seed = diy_orch._compact_diy_search_seed(blob)
    low = seed.lower()
    assert "checkpoint name" not in low
    assert "may 11" not in low
    assert "garage" in low
    assert "paint" in low
    assert "chipping" in low or "scratching" in low
    assert "near the handle" in low or "handle" in low
    assert ".." not in seed


def test_shopping_search_seed_prefers_location_and_issues() -> None:
    shop = diy_orch._shopping_search_seed(
        "Garage",
        "Long summary text about many things.",
        "Paint chips on door",
    )
    assert shop.startswith("Garage")
    assert "Paint chips" in shop or "chips" in shop
    assert "Long summary" not in shop
    assert len(shop) <= diy_orch._shopping_query_max_chars()


def test_youtube_videos_client_shape_requires_url() -> None:
    assert diy_orch._youtube_videos_client_shape(
        [{"title": "x", "url": "", "description": "d"}]
    ) == []
    out = diy_orch._youtube_videos_client_shape(
        [{"title": "T", "url": "https://www.youtube.com/watch?v=abc", "description": "D"}]
    )
    assert len(out) == 1
    assert out[0]["url"].endswith("watch?v=abc")


def test_apply_prefetched_diy_artifacts_overrides_model_hallucination() -> None:
    dr: dict = {
        "diySteps": {"summary": "ok", "steps": []},
        "youtubeSearch": {"videos": []},
        "recommendedProducts": {
            "products": [
                {"item_name": "fake", "vendor": "X", "store_url": None},
            ]
        },
    }
    pj = json.dumps(
        {
            "recommendedProducts": {
                "DIY": {
                    "products": [
                        {
                            "item_name": "Real sealant",
                            "image_url": None,
                            "vendor": "Store",
                            "reviews": None,
                            "store_url": "https://example.com/p",
                        }
                    ]
                }
            }
        }
    )
    yt = [{"title": "Vid", "url": "https://www.youtube.com/watch?v=z", "description": "desc"}]
    diy_orch._apply_prefetched_diy_artifacts(dr, yt, pj)
    assert len(dr["youtubeSearch"]["videos"]) == 1
    assert dr["youtubeSearch"]["videos"][0]["url"] == "https://www.youtube.com/watch?v=z"
    assert len(dr["recommendedProducts"]["products"]) == 1
    assert dr["recommendedProducts"]["products"][0]["item_name"] == "Real sealant"


def test_apply_prefetched_diy_artifacts_clears_hallucination_when_fetch_empty() -> None:
    """Empty YouTube / Serp lists must replace model placeholders (not leave invented rows)."""
    dr: dict = {
        "diySteps": {"summary": "ok", "steps": []},
        "youtubeSearch": {
            "videos": [
                {
                    "title": "fake",
                    "url": "https://www.youtube.com/results?search_query=fake",
                    "description": "x",
                }
            ]
        },
        "recommendedProducts": {
            "products": [
                {
                    "item_name": "Exterior filler",
                    "vendor": "Hardware store",
                    "url": "N/A",
                    "price": "Varies",
                }
            ]
        },
    }
    diy_orch._apply_prefetched_diy_artifacts(dr, [], '{"recommendedProducts":{}}')
    assert dr["youtubeSearch"]["videos"] == []
    assert dr["recommendedProducts"]["products"] == []


def test_youtube_search_uses_data_api_when_key_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("YOUTUBE_API_KEY", "test-youtube-key")

    def fake_get(url: str, params: dict | None = None, timeout: float | None = None):
        assert "youtube/v3/search" in url
        assert params is not None and params.get("key") == "test-youtube-key"

        class Resp:
            ok = True
            status_code = 200
            text = ""

            def json(self) -> dict:
                return {
                    "items": [
                        {
                            "id": {
                                "kind": "youtube#video",
                                "videoId": "dQw4w9WgXcQ",
                            },
                            "snippet": {
                                "title": "Example DIY",
                                "description": "How to fix a thing",
                                "channelTitle": "DIY Channel",
                            },
                        }
                    ]
                }

        return Resp()

    monkeypatch.setattr(
        "property_agent.sub_agents.diy_agent.youtube.requests.get",
        fake_get,
    )
    from property_agent.sub_agents.diy_agent.youtube import youtube_search

    out = youtube_search("patch drywall hole", max_results=3)
    assert len(out) == 1
    assert out[0]["title"] == "Example DIY"
    assert out[0]["url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert out[0]["description"] == "How to fix a thing"
    assert out[0]["duration"] == ""


def test_youtube_search_returns_empty_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)
    from property_agent.sub_agents.diy_agent.youtube import youtube_search

    assert youtube_search("patch drywall hole", max_results=3) == []


def test_cost_estimation_diy_from_library_returns_diy_slice() -> None:
    out = cost_estimation_diy_from_library("clogged sink drain DIY cost estimate")
    data = json.loads(out)
    assert "diyCostEstimates" in data
    assert "DIY" in data["diyCostEstimates"]


def test_run_diy_pipeline_fully_mocked(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DIY_ORCHESTRATOR_CACHE_TTL_SECONDS", "0")
    mock_youtube = [
        {
            "title": "Mock DIY drain video",
            "url": "https://www.youtube.com/watch?v=mock123",
            "description": "Fixture for tests",
            "duration": "1:00",
        }
    ]
    mock_products = json.dumps(
        {
            "recommendedProducts": {
                "DIY": {
                    "products": [
                        {
                            "item_name": "Mock drain snake",
                            "image_url": None,
                            "vendor": "Mock Mart",
                            "reviews": "100",
                            "store_url": "https://example.com/p/1",
                        }
                    ],
                    "description": "mock",
                }
            }
        }
    )

    def mock_synthesize(
        diagnosis: str,
        web_summary: str,
        youtube_videos: list,
        products_json: str,
        cost_json: str,
    ) -> str:
        products_flat: list = []
        try:
            blob = json.loads(products_json)
            rp = blob.get("recommendedProducts") if isinstance(blob, dict) else None
            if isinstance(rp, dict):
                diy = rp.get("DIY")
                if isinstance(diy, dict):
                    pl = diy.get("products")
                    if isinstance(pl, list):
                        products_flat = pl[:8]
        except json.JSONDecodeError:
            pass
        yt = youtube_videos[:10] if isinstance(youtube_videos, list) else []
        cost_inner: dict = {"repair_type": "t", "DIY": {"cost_range": "$1-2"}}
        try:
            ce = json.loads(cost_json)
            if isinstance(ce, dict) and isinstance(ce.get("diyCostEstimates"), dict):
                cost_inner = ce["diyCostEstimates"]
        except json.JSONDecodeError:
            pass
        return json.dumps(
            {
                "hire_professional_recommended": False,
                "diyResults": {
                    "diySteps": {"summary": "ok", "steps": [{"stepNumber": 1, "description": "x"}]},
                    "youtubeSearch": {"videos": yt},
                    "recommendedProducts": {"products": products_flat},
                    "diyCostEstimates": cost_inner,
                },
            },
            ensure_ascii=False,
        )

    monkeypatch.setattr(diy_orch, "_diy_web_search_grounded", lambda d, a: "1. Turn off water.\n2. Replace washer.")
    monkeypatch.setattr(diy_orch, "_youtube_for_diagnosis", lambda d: mock_youtube)
    monkeypatch.setattr(diy_orch, "_products_for_diagnosis", lambda d: mock_products)
    monkeypatch.setattr(
        diy_orch,
        "cost_estimation_diy_from_library",
        lambda q: '{"diyCostEstimates":{"repair_type":"t","DIY":{"cost_range":"$1-2"}}}',
    )
    monkeypatch.setattr(diy_orch, "_synthesize_diy_json", mock_synthesize)
    out = asyncio.run(run_diy_pipeline(user_query="clogged drain", property_address=None))
    body = json.loads(out)
    dr = body.get("diyResults")
    assert isinstance(dr, dict)
    print_youtube_results(dr.get("youtubeSearch", {}).get("videos") or [])
    print_product_results(dr.get("recommendedProducts", {}).get("products") or [])
    print_run_diy_pipeline_tool_output(body)
    assert "diyResults" in body
    assert body["diyResults"]["diySteps"]["summary"] == "ok"
    assert len(body["diyResults"]["youtubeSearch"]["videos"]) == 1
    assert len(body["diyResults"]["recommendedProducts"]["products"]) == 1


def test_run_diy_pipeline_checkpoint_retrieval_query_only_for_youtube_and_products(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Checkpoint branch uses retrieval ``search_query`` for YouTube/shopping (not compacted diagnosis)."""
    monkeypatch.setenv("DIY_ORCHESTRATOR_CACHE_TTL_SECONDS", "0")
    seen: dict[str, tuple] = {}

    def cap_yt(q: str, max_results: int = 5) -> list:
        seen["yt"] = (q, max_results)
        return []

    def cap_pr(q: str, category: str = "DIY") -> str:
        seen["pr"] = (q, category)
        return '{"recommendedProducts":{"DIY":{"products":[]}}}'

    monkeypatch.setattr(diy_orch, "_diy_web_search_grounded", lambda d, a: "")
    monkeypatch.setattr(diy_orch, "youtube_search", cap_yt)
    monkeypatch.setattr(diy_orch, "product_recommendations", cap_pr)

    def boom_yt(_d: str) -> list:
        raise AssertionError("legacy _youtube_for_diagnosis must not run when retrieval seed is set")

    def boom_pr(_d: str) -> str:
        raise AssertionError("legacy _products_for_diagnosis must not run when retrieval seed is set")

    monkeypatch.setattr(diy_orch, "_youtube_for_diagnosis", boom_yt)
    monkeypatch.setattr(diy_orch, "_products_for_diagnosis", boom_pr)
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
                    "diySteps": {"summary": "x", "steps": []},
                    "youtubeSearch": {"videos": youtube_videos or []},
                    "recommendedProducts": {"products": []},
                    "diyCostEstimates": {},
                },
            },
            ensure_ascii=False,
        ),
    )
    retrieval = "Garage paint chips only"
    long_diag = retrieval + "\n\nCheckpoint context:\n" + ("NOISE " * 500)
    asyncio.run(
        run_diy_pipeline(
            long_diag,
            checkpoint_retrieval_search_query=retrieval,
        )
    )
    assert seen["yt"] == (f"{retrieval} DIY tutorial how to fix", 5)
    assert seen["pr"] == (retrieval, "DIY")


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
    out1 = asyncio.run(run_diy_pipeline(q))
    body1 = json.loads(out1)
    print_run_diy_pipeline_tool_output(body1, label="first call")
    assert out1 == fixed
    out2 = asyncio.run(run_diy_pipeline(q))
    body2 = json.loads(out2)
    print_run_diy_pipeline_tool_output(body2, label="second call (cached)")
    assert out2 == fixed
    assert calls["n"] == 1


@pytest.mark.integration_external
@requires_external_diy_search
@requires_youtube_api_key
def test_youtube_for_diagnosis_live_orchestrator() -> None:
    """Real YouTube Data API path when ``YOUTUBE_API_KEY`` is set (orchestrator wrapper)."""
    results = diy_orch._youtube_for_diagnosis("replace faucet washer")
    assert isinstance(results, list)
    print_youtube_results(results)
    assert len(results) >= 1, "expected at least one normalized video result"
    for item in results:
        assert isinstance(item, dict)
        assert item.get("title")
        url = item.get("url") or ""
        assert isinstance(url, str)
        assert "youtube.com" in url or "youtu.be" in url, f"unexpected video url shape: {url[:80]!r}"


@pytest.mark.integration_external
@requires_external_diy_search
@requires_serpapi_key
def test_products_for_diagnosis_live_orchestrator() -> None:
    """Real SerpAPI path used by ``run_diy_pipeline`` (orchestrator query wrapper)."""
    raw = diy_orch._products_for_diagnosis("clogged bathroom sink drain")
    assert isinstance(raw, str) and raw.strip()
    data = json.loads(raw)
    rp = data.get("recommendedProducts")
    assert isinstance(rp, dict), f"unexpected payload: {raw[:200]!r}"
    assert "message" not in rp, f"service unavailable: {rp.get('message')}"
    assert "error" not in rp, f"upstream error: {rp.get('error')}"
    diy = rp.get("DIY")
    assert isinstance(diy, dict), f"missing DIY block: {list(rp.keys())}"
    products = diy.get("products")
    assert isinstance(products, list), "DIY.products must be a list"
    print_product_results(products)
    assert len(products) >= 1, "expected at least one shopping result from SerpAPI"
    first = products[0]
    assert isinstance(first, dict)
    assert first.get("item_name") or first.get("store_url")
