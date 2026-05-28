"""Shared opt-in gates and stdout helpers for live YouTube / SerpAPI DIY tests."""

from __future__ import annotations

import json
import os
import textwrap
from typing import Any

import pytest
from dotenv import load_dotenv

load_dotenv()

requires_external_diy_search = pytest.mark.skipif(
    os.environ.get("RUN_EXTERNAL_DIY_SEARCH_TESTS", "").strip() != "1",
    reason="Set RUN_EXTERNAL_DIY_SEARCH_TESTS=1 to run live YouTube / SerpAPI tests.",
)

requires_serpapi_key = pytest.mark.skipif(
    not os.environ.get("SERP_API_KEY", "").strip(),
    reason="SERP_API_KEY is required for live SerpAPI shopping integration test.",
)

requires_youtube_api_key = pytest.mark.skipif(
    not os.environ.get("YOUTUBE_API_KEY", "").strip(),
    reason="YOUTUBE_API_KEY is required for live YouTube Data API fallback test.",
)

requires_youtube_search_key = pytest.mark.skipif(
    not (
        os.environ.get("SERP_API_KEY", "").strip()
        or os.environ.get("YOUTUBE_API_KEY", "").strip()
    ),
    reason="SERP_API_KEY or YOUTUBE_API_KEY is required for live YouTube search.",
)


def display_str(value: Any) -> str:
    """SerpAPI fields may be str, int (e.g. review count), or None."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    return str(value).strip()


def print_youtube_results(results: list[dict[str, Any]]) -> None:
    print("\n--- YouTube search (normalized) ---")
    print(f"count={len(results)}")
    for i, item in enumerate(results, start=1):
        title = (item.get("title") or "").strip()
        url = (item.get("url") or "").strip()
        duration = (item.get("duration") or "").strip()
        desc = (item.get("description") or "").strip()
        desc_wrapped = (
            textwrap.shorten(desc, width=120, placeholder="…") if desc else ""
        )
        print(f"\n[{i}] {title}")
        print(f"    url: {url}")
        if duration:
            print(f"    duration: {duration}")
        if desc_wrapped:
            print(f"    description: {desc_wrapped}")
    print("--- end YouTube ---\n")


def print_product_results(products: list[dict[str, Any]]) -> None:
    print("\n--- Product search (SerpAPI / DIY block) ---")
    print(f"count={len(products)}")
    for i, p in enumerate(products, start=1):
        name = display_str(p.get("item_name")) or "(no item_name)"
        vendor = display_str(p.get("vendor"))
        reviews = display_str(p.get("reviews"))
        store = display_str(p.get("store_url"))
        image = display_str(p.get("image_url"))
        print(f"\n[{i}] {name}")
        if vendor:
            print(f"    vendor: {vendor}")
        if reviews:
            print(f"    reviews: {reviews}")
        if store:
            print(f"    store_url: {store}")
        if image:
            print(
                f"    image_url: {image[:80]}…"
                if len(image) > 80
                else f"    image_url: {image}"
            )
    print("--- end products ---\n")


def print_run_diy_pipeline_tool_output(
    parsed: dict[str, Any], *, label: str = ""
) -> None:
    """Pretty-print JSON returned by ``run_diy_pipeline`` (use ``pytest -s`` to see when tests pass)."""
    suffix = f" ({label})" if label else ""
    print(f"\n--- run_diy_pipeline tool output{suffix} ---")
    print(json.dumps(parsed, indent=2, ensure_ascii=False))
    print("--- end run_diy_pipeline ---\n")
