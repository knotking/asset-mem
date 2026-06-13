"""Parallel prefetch helpers: web grounding, YouTube, shopping, cost."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

from google.genai import types

from agent_platform.core.ports import GenerateRequest
from property_agent.shared.google_search_grounding import (
    google_search_grounding_tool,
    grounded_prose_with_retry,
)
from property_agent.shared.inputs import SearchLocation
from property_agent.model_config import (
    direct_gemini_thinking_config,
    direct_generate_model_client,
)
from property_agent.geo.search_location_utils import market_label
from property_agent.agents.diy_agent.youtube import youtube_search
from property_agent.checkpoint.branch_search_intents import (
    BranchSearchIntents,
    compact_youtube_search_query,
)
from property_agent.agents.shopping_agent.agent import (
    DEFAULT_MATERIAL_MAX_PRODUCTS,
    product_recommendations,
    product_recommendations_from_materials,
)
from .checkpoint_parse import (
    _compact_diy_search_seed,
    _parse_checkpoint_fields,
    _shopping_search_seed,
    parse_checkpoint_structured_context,
)

logger = logging.getLogger(__name__)

def _web_search_model() -> str:
    return direct_generate_model_client().default_model


def _web_grounding_max_output_tokens() -> int:
    raw = os.getenv("DIY_WEB_GROUNDING_MAX_OUTPUT_TOKENS", "2048").strip()
    try:
        n = int(raw)
    except ValueError:
        return 2048
    return max(256, min(n, 4096))


def _web_summary_max_chars() -> int:
    raw = os.getenv("DIY_WEB_SUMMARY_MAX_CHARS", "3500").strip()
    try:
        n = int(raw)
    except ValueError:
        return 3500
    return max(500, min(n, 8000))


def _web_thinking_config() -> types.ThinkingConfig:
    """Grounded web search; default ``low`` (see ``DIY_WEB_THINKING``)."""
    return direct_gemini_thinking_config("DIY_WEB_THINKING", default="low")


def _truncate_web_summary(text: str) -> str:
    cap = _web_summary_max_chars()
    s = (text or "").strip()
    if len(s) <= cap:
        return s
    cut = s[: cap + 1]
    if " " in cut:
        return cut.rsplit(" ", 1)[0].strip()
    return s[:cap].strip()


def _market_location_string(
    search_location: Optional[SearchLocation],
    property_address: Optional[str],
) -> str:
    label = market_label(search_location, property_address=property_address)
    if label:
        return label
    return (property_address or "").strip() or "not provided"


def fetch_repair_web_context(web_query: str, market_location: str) -> str:
    """Public entry: grounded web summary for a repair issue + market label."""
    return _diy_web_search_grounded(web_query, market_location)


def _diy_web_search_grounded(diagnosis: str, market_location: str) -> str:
    """One Gemini call with Google Search grounding for DIY steps context."""
    model_client = direct_generate_model_client()
    addr = market_location.strip() if market_location else "not provided"
    checkpoint_ctx = parse_checkpoint_structured_context(diagnosis)
    ctx_block = ""
    if checkpoint_ctx:
        ctx_block = f"Structured checkpoint:\n{json.dumps(checkpoint_ctx, ensure_ascii=False)}\n\n"
    prompt = (
        f"{ctx_block}"
        f"Issue / search focus:\n{diagnosis[:4000]}\n\n"
        f"Search/market location: {addr}\n\n"
        "Using web search when helpful, list practical DIY repair steps (numbered, at most 8), "
        "required tools, materials, and safety warnings. Be concise (under 500 words). "
        "Do not fabricate URLs."
    )
    def _generate() -> Any:
        return model_client.generate(
            GenerateRequest(
                model=_web_search_model(),
                contents=prompt,
                temperature=0.35,
                max_output_tokens=_web_grounding_max_output_tokens(),
                extra_config={
                    "top_p": 0.9,
                    "response_modalities": ["TEXT"],
                    "tools": [google_search_grounding_tool()],
                    "thinking_config": _web_thinking_config(),
                },
            )
        ).raw

    text = grounded_prose_with_retry(
        _generate,
        logger=logger,
        label="DIY web grounding",
    )
    return _truncate_web_summary(text)


def _youtube_for_diagnosis(
    diagnosis: str,
    search_location: Optional[SearchLocation] = None,
    branch_intents: Optional[BranchSearchIntents] = None,
) -> list[Dict[str, Any]]:
    youtube_query = branch_intents.youtube_query if branch_intents else None
    stem = branch_intents.issue_stem if branch_intents else None
    normalized_youtube_query = (youtube_query or "").strip()
    if normalized_youtube_query:
        return youtube_search(
            normalized_youtube_query,
            max_results=5,
            search_location=search_location,
            relevance_stem=stem,
            rank_search_query=normalized_youtube_query,
        )
    seed = _compact_diy_search_seed(diagnosis)
    q = compact_youtube_search_query(seed)
    return youtube_search(
        q,
        max_results=5,
        search_location=search_location,
        relevance_stem=stem or seed,
        rank_search_query=q,
    )


def _youtube_for_checkpoint_retrieval_seed(
    seed: str,
    search_location: Optional[SearchLocation] = None,
    branch_intents: Optional[BranchSearchIntents] = None,
) -> list[Dict[str, Any]]:
    """YouTube: branch intent query when set, else retrieval seed + DIY tail."""
    youtube_query = branch_intents.youtube_query if branch_intents else None
    stem = branch_intents.issue_stem if branch_intents else None
    normalized_youtube_query = (youtube_query or "").strip()
    if normalized_youtube_query:
        return youtube_search(
            normalized_youtube_query,
            max_results=5,
            search_location=search_location,
            relevance_stem=stem or seed,
            rank_search_query=normalized_youtube_query,
        )
    base = (seed or "").strip()
    if not base:
        return youtube_search("", max_results=5, search_location=search_location)
    q = compact_youtube_search_query(base)
    return youtube_search(
        q,
        max_results=5,
        search_location=search_location,
        relevance_stem=stem or base,
        rank_search_query=q,
    )


def _products_for_diagnosis(
    diagnosis: str,
    search_location: Optional[SearchLocation] = None,
    property_address: Optional[str] = None,
    branch_intents: Optional[BranchSearchIntents] = None,
) -> str:
    sl_dict = search_location.model_dump() if search_location else None
    materials = list(branch_intents.shopping_materials) if branch_intents else []
    if materials:
        return product_recommendations_from_materials(
            materials,
            "DIY",
            search_location=sl_dict,
            property_address=property_address,
            max_products=min(DEFAULT_MATERIAL_MAX_PRODUCTS, len(materials) * 2),
        )
    loc, sum_, iss, _one = _parse_checkpoint_fields(diagnosis)
    seed = _shopping_search_seed(loc, sum_, iss)
    if not seed.strip():
        seed = _compact_diy_search_seed(diagnosis)
    return product_recommendations(
        seed, "DIY", search_location=sl_dict, property_address=property_address
    )


def _products_for_checkpoint_retrieval_seed(
    seed: str,
    search_location: Optional[SearchLocation] = None,
    property_address: Optional[str] = None,
    branch_intents: Optional[BranchSearchIntents] = None,
) -> str:
    """SerpAPI shopping: material phrases when set, else checkpoint retrieval seed."""
    sl_dict = search_location.model_dump() if search_location else None
    materials = list(branch_intents.shopping_materials) if branch_intents else []
    if materials:
        return product_recommendations_from_materials(
            materials,
            "DIY",
            search_location=sl_dict,
            property_address=property_address,
            max_products=min(DEFAULT_MATERIAL_MAX_PRODUCTS, len(materials) * 2),
        )
    return product_recommendations(
        (seed or "").strip(),
        "DIY",
        search_location=sl_dict,
        property_address=property_address,
    )


def _product_recommendations_log_summary(products_json: str) -> str:
    """Compact summary for INFO logs (counts only; no item text)."""
    if not (products_json or "").strip():
        return "products=0 empty_json"
    try:
        blob = json.loads(products_json)
    except json.JSONDecodeError:
        return "products=0 json_decode_error"
    if not isinstance(blob, dict):
        return "products=0 not_object"
    rp = blob.get("recommendedProducts")
    if not isinstance(rp, dict):
        return "products=0 no_recommendedProducts"
    if rp.get("message"):
        return "products=0 unavailable"
    if rp.get("error"):
        return "products=0 upstream_error"
    diy = rp.get("DIY")
    if not isinstance(diy, dict):
        return "products=0 no_diy_block"
    raw_list = diy.get("products")
    if not isinstance(raw_list, list):
        return "products=0 bad_products_list"
    return f"products={len(raw_list)}"


def _youtube_videos_client_shape(
    raw: list[Dict[str, Any]],
    *,
    limit: int = 10,
) -> list[Dict[str, Any]]:
    """Normalize prefetched YouTube rows to the client JSON shape (title, url, description)."""
    out: list[Dict[str, Any]] = []
    for v in raw[:limit]:
        if not isinstance(v, dict):
            continue
        url = str(v.get("url") or "").strip()
        if not url:
            continue
        out.append(
            {
                "title": str(v.get("title") or "").strip(),
                "url": url,
                "description": str(v.get("description") or "").strip(),
            }
        )
    return out


def _serp_shopping_products_list(
    products_json: str, *, max_items: int = 8
) -> list[Dict[str, Any]]:
    """Parse SerpAPI shopping JSON from ``product_recommendations`` into synthesis/fallback product rows."""
    products: list[Dict[str, Any]] = []
    if not (products_json or "").strip():
        return products
    try:
        blob = json.loads(products_json)
        rp = blob.get("recommendedProducts") if isinstance(blob, dict) else None
        if not isinstance(rp, dict) or rp.get("message") or rp.get("error"):
            return products
        diy_block = rp.get("DIY") if isinstance(rp.get("DIY"), dict) else {}
        raw_list = diy_block.get("products") if isinstance(diy_block, dict) else None
        if not isinstance(raw_list, list):
            return products
        for p in raw_list[:max_items]:
            if isinstance(p, dict):
                row: Dict[str, Any] = {
                    "item_name": p.get("item_name"),
                    "image_url": p.get("image_url"),
                    "vendor": p.get("vendor"),
                    "reviews": p.get("reviews"),
                    "store_url": p.get("store_url"),
                }
                price = p.get("item_price") or p.get("price")
                if price:
                    row["item_price"] = price
                    row["price"] = price
                products.append(row)
    except Exception:
        logger.debug("Serp shopping product parse failed", exc_info=True)
    return products


def _apply_prefetched_diy_artifacts(
    diy_results: Dict[str, Any],
    youtube_videos: list[Dict[str, Any]],
    products_json: str,
) -> None:
    """Mutate ``diy_results`` so YouTube / shopping always match fetchers (never LLM placeholders)."""
    yt_norm = _youtube_videos_client_shape(youtube_videos)
    diy_results["youtubeSearch"] = {"videos": yt_norm}
    logger.debug(
        "DIY synthesis: applied prefetched youtube videos=%d",
        len(yt_norm),
    )
    serp_products = _serp_shopping_products_list(products_json)
    diy_results["recommendedProducts"] = {"products": serp_products}
    logger.debug(
        "DIY synthesis: applied SerpAPI products=%d",
        len(serp_products),
    )


def _cost_query(diagnosis: str, market_location: str) -> str:
    parts = [f"{diagnosis.strip()[:2000]} DIY cost estimate"]
    if market_location.strip() and market_location.strip() != "not provided":
        parts.append(f"Market location: {market_location.strip()[:500]}")
    return " ".join(parts)


def _parse_diy_cost_inner(cost_json: str) -> Dict[str, Any]:
    if not (cost_json or "").strip():
        return {}
    try:
        parsed = json.loads(cost_json)
        if isinstance(parsed, dict):
            inner = parsed.get("diyCostEstimates")
            if isinstance(inner, dict):
                return inner
    except Exception:
        logger.debug("DIY cost inner parse failed", exc_info=True)
    return {}

