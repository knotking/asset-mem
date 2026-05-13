"""
Live-network integration tests for DIY YouTube search and shopping (SerpAPI).

These are **opt-in**: default ``pytest`` runs skip them so CI and local quick
runs stay offline.

Enable::

    cd gcp/agents/homecare
    RUN_EXTERNAL_DIY_SEARCH_TESTS=1 uv run pytest tests/test_diy_external_integration.py -v

The same live checks also live in ``test_diy_agent.py`` (orchestrator wrappers
``_youtube_for_diagnosis`` / ``_products_for_diagnosis``).

Pass ``-s`` (no stdout capture) to print live YouTube rows and product rows in
your terminal even when tests pass::

    RUN_EXTERNAL_DIY_SEARCH_TESTS=1 uv run pytest tests/test_diy_external_integration.py -v -s

The product test also needs ``SERP_API_KEY`` (e.g. in ``.env``). Live YouTube
tests need ``YOUTUBE_API_KEY`` (YouTube Data API v3). Shared helpers in
``tests/diy_live_helpers.py`` call ``load_dotenv()`` on import.
"""

from __future__ import annotations

import json

import pytest

from tests.diy_live_helpers import (
    print_product_results,
    print_youtube_results,
    requires_external_diy_search,
    requires_serpapi_key,
    requires_youtube_api_key,
)

pytestmark = pytest.mark.integration_external


@requires_external_diy_search
@requires_youtube_api_key
def test_youtube_search_real_fetch() -> None:
    """Hits YouTube Data API v3 (requires ``YOUTUBE_API_KEY``)."""
    from property_agent.sub_agents.diy_agent.youtube import youtube_search

    results = youtube_search("replace faucet washer DIY tutorial", max_results=3)
    assert isinstance(results, list)
    print_youtube_results(results)
    assert len(results) >= 1, "expected at least one normalized video result"

    for item in results:
        assert isinstance(item, dict)
        assert item.get("title")
        url = item.get("url") or ""
        assert isinstance(url, str)
        assert "youtube.com" in url or "youtu.be" in url, f"unexpected video url shape: {url[:80]!r}"


@requires_external_diy_search
@requires_serpapi_key
def test_product_recommendations_real_fetch() -> None:
    """Hits SerpAPI Google Shopping via ``product_recommendations``."""
    from property_agent.sub_agents.shopping_agent.agent import product_recommendations

    raw = product_recommendations("clogged bathroom sink drain", "DIY")
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
