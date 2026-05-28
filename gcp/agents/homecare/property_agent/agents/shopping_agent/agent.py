import os
import json
import time
from typing import Any, List, Optional

from google.adk.agents import Agent
from dotenv import load_dotenv
from .prompts import shopping_agent_instructions
from property_agent.shared.inputs import DocsInput
from ...model_config import GLOBAL_GEMINI_MODEL
from property_agent.geo.address_parse import parse_search_location_arg
from property_agent.geo.serpapi_locations import resolve_serpapi_location_name
import logging

logger = logging.getLogger(__name__)
load_dotenv()

# Branch-intent flows emit up to 5 material phrases; allow ~2 products each.
DEFAULT_MATERIAL_MAX_PRODUCTS = 10


def _serp_shopping_product_link(result: dict) -> str:
    """SerpAPI Google Shopping uses ``product_link``; older payloads may use ``link``."""
    return str(result.get("product_link") or result.get("link") or "").strip()


def _serp_shopping_price_display(result: dict) -> Optional[str]:
    """Formatted price string from SerpAPI (e.g. ``$12.99``), or None when absent."""
    raw = result.get("price")
    if raw is not None and str(raw).strip():
        text = str(raw).strip()
        if text.lower() != "price not available":
            return text
    extracted = result.get("extracted_price")
    if isinstance(extracted, (int, float)):
        return f"${extracted:.2f}"
    return None


def _process_shopping_row(result: dict) -> Optional[dict]:
    try:
        title = result.get("title", "Unknown Product")
        link = _serp_shopping_product_link(result)
        source = result.get("source", "Unknown Store")
        reviews = result.get("reviews", "")
        image_url = result.get("thumbnail", "")
        price_display = _serp_shopping_price_display(result)

        product_data = {
            "item_name": title if title != "Unknown Product" else None,
            "image_url": image_url if image_url else None,
            "vendor": source if source != "Unknown Store" else None,
            "reviews": reviews if reviews else None,
            "store_url": link if link else None,
        }
        if price_display:
            product_data["item_price"] = price_display
            product_data["price"] = price_display
        if not product_data.get("item_name"):
            return None
        return product_data
    except (KeyError, TypeError) as e:
        logger.warning(
            "Error processing product (skipped one item): %s: %s",
            type(e).__name__,
            e,
        )
        return None


def _fetch_shopping_results(
    search_query: str,
    *,
    search_location: Optional[dict] = None,
    property_address: Optional[str] = None,
    num: int = 6,
) -> tuple[list[dict], bool]:
    """Run one SerpAPI Google Shopping query; returns (raw rows, had_error)."""
    import serpapi

    serpapi_api_key = os.environ.get("SERP_API_KEY")
    if not serpapi_api_key:
        return [], True

    params: dict[str, Any] = {
        "engine": "google_shopping",
        "q": search_query,
        "api_key": serpapi_api_key,
        "num": num,
        "gl": "us",
        "hl": "en",
    }
    sl = parse_search_location_arg(search_location)
    location_name = resolve_serpapi_location_name(sl, property_address=property_address)
    if location_name:
        params["location"] = location_name

    product_search = serpapi.GoogleSearch(params)
    search_results = product_search.get_dict()
    serp_err = isinstance(search_results, dict) and bool(search_results.get("error"))
    err_text = (
        str(search_results.get("error") or "") if isinstance(search_results, dict) else ""
    )
    if (
        serp_err
        and "location" in params
        and "unsupported" in err_text.lower()
        and "location" in err_text.lower()
    ):
        params.pop("location", None)
        product_search = serpapi.GoogleSearch(params)
        search_results = product_search.get_dict()
        serp_err = isinstance(search_results, dict) and bool(search_results.get("error"))

    products = search_results.get("shopping_results") if isinstance(search_results, dict) else None
    if not isinstance(products, list):
        products = []
    return products, serp_err


def _merge_material_products_round_robin(
    pools: List[List[dict]],
    *,
    max_products: int,
) -> List[dict]:
    """
    Interleave one product per material query per pass, then fill remaining slots.

    Ensures diverse categories (primer, paint, sandpaper, etc.) instead of greedy
    fill from the first SerpAPI query.
    """
    if max_products <= 0 or not pools:
        return []

    merged: List[dict] = []
    seen_names: set[str] = set()
    indices = [0] * len(pools)

    while len(merged) < max_products:
        added_this_round = False
        for i, pool in enumerate(pools):
            while indices[i] < len(pool):
                product = pool[indices[i]]
                indices[i] += 1
                name_key = str(product.get("item_name") or "").casefold()
                if not name_key or name_key in seen_names:
                    continue
                seen_names.add(name_key)
                merged.append(product)
                added_this_round = True
                break
            if len(merged) >= max_products:
                break
        if not added_this_round:
            break
    return merged


def product_recommendations_from_materials(
    material_queries: List[str],
    category: str = "DIY",
    search_location: Optional[dict] = None,
    property_address: Optional[str] = None,
    *,
    max_products: int = DEFAULT_MATERIAL_MAX_PRODUCTS,
) -> str:
    """
    Search Google Shopping once per material phrase; merge with round-robin dedupe.

    Used by checkpoint DIY flows when branch search intents provide explicit materials.
    Default cap is ``DEFAULT_MATERIAL_MAX_PRODUCTS`` (~2 picks per material phrase).
    """
    t0 = time.monotonic()

    def _elapsed_ms() -> int:
        return int((time.monotonic() - t0) * 1000)

    serpapi_api_key = os.environ.get("SERP_API_KEY")
    if not serpapi_api_key:
        return json.dumps(
            {
                "recommendedProducts": {
                    "message": "Product recommendations service not available (missing API key)."
                }
            }
        )

    queries = [q.strip() for q in material_queries if (q or "").strip()][:5]
    if not queries:
        return json.dumps(
            {
                "recommendedProducts": {
                    "error": "No material queries provided for product search."
                }
            }
        )

    merged: list[dict] = []
    any_error = False

    try:
        per_query_fetch = max(2, min(6, (max_products // max(len(queries), 1)) + 2))
        pools: List[List[dict]] = []
        for q in queries:
            logger.debug("product_recommendations_from_materials: q=%r", q)
            raw_rows, serp_err = _fetch_shopping_results(
                q,
                search_location=search_location,
                property_address=property_address,
                num=per_query_fetch,
            )
            if serp_err:
                any_error = True
            processed_rows: List[dict] = []
            for row in raw_rows:
                if not isinstance(row, dict):
                    continue
                processed = _process_shopping_row(row)
                if processed:
                    processed_rows.append(processed)
            pools.append(processed_rows)

        merged = _merge_material_products_round_robin(pools, max_products=max_products)

        outcome = (
            "serp_api_error"
            if any_error and not merged
            else ("zero_products" if not merged else "ok")
        )
        response_data = {
            "recommendedProducts": {
                category: {
                    "products": merged,
                    "description": f"Essential products you'll need for {category.lower()} repair",
                }
            }
        }
        logger.info(
            "product_recommendations_from_materials: done duration_ms=%d category=%s "
            "outcome=%s products=%d material_queries=%d",
            _elapsed_ms(),
            category,
            outcome,
            len(merged),
            len(queries),
        )
        return json.dumps(response_data)
    except Exception as e:
        logger.exception("Error searching material product recommendations: %s", e)
        return json.dumps(
            {
                "recommendedProducts": {
                    "error": f"Error retrieving product recommendations: {str(e)}"
                }
            }
        )


def product_recommendations(
    query: str,
    category: str = "DIY",
    search_location: Optional[dict] = None,
    property_address: Optional[str] = None,
    material_queries: Optional[List[str]] = None,
) -> str:
    """Provides product recommendations for repairs. Can be used for DIY or professional service products."""
    materials = [m.strip() for m in (material_queries or []) if (m or "").strip()]
    if materials:
        return product_recommendations_from_materials(
            materials,
            category=category,
            search_location=search_location,
            property_address=property_address,
        )

    t0 = time.monotonic()

    def _elapsed_ms() -> int:
        return int((time.monotonic() - t0) * 1000)

    serpapi_api_key = os.environ.get("SERP_API_KEY")

    if not serpapi_api_key:
        logger.info(
            "product_recommendations: skip duration_ms=%d category=%s reason=no_api_key query_len=%d",
            _elapsed_ms(),
            category,
            len(query or ""),
        )
        return json.dumps(
            {
                "recommendedProducts": {
                    "message": "Product recommendations service not available (missing API key)."
                }
            }
        )

    try:
        if category == "DIY":
            search_query = f"{query} DIY repair products tools"
        else:
            search_query = f"{query} {category} repair products tools"

        logger.debug("product_recommendations: SerpAPI search_query=%r", search_query)

        products, serp_err = _fetch_shopping_results(
            search_query,
            search_location=search_location,
            property_address=property_address,
        )

        if serp_err:
            logger.info(
                "product_recommendations: SerpAPI error duration_ms=%d category=%s",
                _elapsed_ms(),
                category,
            )
            logger.debug(
                "product_recommendations: SerpAPI error search_query=%r",
                search_query,
            )

        processed_items: list[dict] = []
        for result in products[:5]:
            if isinstance(result, dict):
                row = _process_shopping_row(result)
                if row:
                    processed_items.append(row)

        logger.debug(
            "product_recommendations: SerpAPI processed_items=%s",
            json.dumps(processed_items, ensure_ascii=False),
        )

        if not processed_items:
            logger.debug(
                "product_recommendations: zero_products search_query=%r",
                search_query,
            )

        outcome = (
            "serp_api_error"
            if serp_err
            else ("zero_products" if not processed_items else "ok")
        )
        response_data = {
            "recommendedProducts": {
                category: {
                    "products": processed_items,
                    "description": f"Essential products you'll need for {category.lower()} repair",
                }
            }
        }
        logger.info(
            "product_recommendations: done duration_ms=%d category=%s outcome=%s "
            "products=%d raw_shopping_count=%d query_len=%d",
            _elapsed_ms(),
            category,
            outcome,
            len(processed_items),
            len(products),
            len(query or ""),
        )
        return json.dumps(response_data)
    except Exception as e:
        logger.exception("Error searching for product recommendations: %s", e)
        logger.info(
            "product_recommendations: exception duration_ms=%d category=%s",
            _elapsed_ms(),
            category,
        )
        return json.dumps(
            {
                "recommendedProducts": {
                    "error": f"Error retrieving product recommendations: {str(e)}"
                }
            }
        )


shopping_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="shopping_agent",
    description="Provides product recommendations for DIY repairs, professional services, and general repair needs.",
    instruction=shopping_agent_instructions(),
    tools=[product_recommendations],
    input_schema=DocsInput,
)

# ADK AgentEvaluator expects ``root_agent`` on ``*.agent`` modules.
root_agent = shopping_agent

__all__ = [
    "DEFAULT_MATERIAL_MAX_PRODUCTS",
    "shopping_agent",
    "product_recommendations",
    "product_recommendations_from_materials",
    "_merge_material_products_round_robin",
    "root_agent",
]
