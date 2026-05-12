"""
Python orchestrator for DIY: parallel data fetch (web + YouTube + products + library cost),
then a single Gemini synthesis call (no second Google Search on cost).

Caching is optional via DIY_ORCHESTRATOR_CACHE_TTL_SECONDS (default 300; set 0 to disable).
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from typing import Any, Dict, Optional, Tuple

from google.genai import types

from ...model_config import LEGACY_API_GEMINI
from ..cost_agent.agent import cost_estimation_diy_from_library
from ..shopping_agent.agent import product_recommendations

from .youtube import youtube_search

logger = logging.getLogger(__name__)

_CACHE_LOCK = threading.Lock()
_DIY_CACHE: Dict[str, Tuple[float, str]] = {}
_CACHE_MAX = 200

_HIRE_PRO_KEYWORDS = (
    "gas line",
    "gas leak",
    "main electrical",
    "service panel",
    "breaker panel",
    "knob and tube",
    "asbestos",
    "structural",
    "load-bearing",
    "foundation",
    "sewage backup",
    "black mold",
    "refrigerant",
    "freon",
    "combustion",
    "carbon monoxide",
)


def _cache_ttl_seconds() -> float:
    raw = os.getenv("DIY_ORCHESTRATOR_CACHE_TTL_SECONDS", "300").strip()
    try:
        v = float(raw)
    except ValueError:
        return 300.0
    return max(0.0, v)


def _synthesis_model() -> str:
    return LEGACY_API_GEMINI.model


def _web_search_model() -> str:
    return LEGACY_API_GEMINI.model


def _cache_key(user_query: str, property_address: Optional[str]) -> str:
    payload = json.dumps(
        {"q": user_query.strip(), "a": (property_address or "").strip()},
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _prune_cache_unlocked() -> None:
    if len(_DIY_CACHE) <= _CACHE_MAX:
        return
    # Drop oldest ~20% by timestamp
    items = sorted(_DIY_CACHE.items(), key=lambda kv: kv[1][0])
    for k, _ in items[: max(1, len(items) // 5)]:
        _DIY_CACHE.pop(k, None)


def _infer_hire_professional(diagnosis: str) -> bool:
    low = diagnosis.lower()
    return any(k in low for k in _HIRE_PRO_KEYWORDS)


def _strip_code_fences(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```\s*$", "", s)
    return s.strip()


def _diy_web_search_grounded(diagnosis: str, property_address: str) -> str:
    """One Gemini call with Google Search grounding for DIY steps context."""
    client = LEGACY_API_GEMINI.api_client
    addr = property_address.strip() if property_address else "not provided"
    prompt = (
        f"Issue / diagnosis:\n{diagnosis}\n\n"
        f"Property address context: {addr}\n\n"
        "Summarize practical DIY repair steps, tools, materials, and important safety warnings. "
        "Be concise (under 900 words). Do not fabricate URLs."
    )
    try:
        response = client.models.generate_content(
            model=_web_search_model(),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.35,
                top_p=0.9,
                max_output_tokens=4096,
                response_modalities=["TEXT"],
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
        return (response.text or "").strip()
    except Exception as exc:
        logger.exception(
            "DIY grounded web search failed (%s: %s)",
            type(exc).__name__,
            exc,
        )
        return ""


def _youtube_for_diagnosis(diagnosis: str) -> list[Dict[str, Any]]:
    q = f"{diagnosis.strip()[:400]} DIY tutorial how to fix"
    return youtube_search(q, max_results=5)


def _products_for_diagnosis(diagnosis: str) -> str:
    q = f"{diagnosis.strip()[:400]} DIY repair products tools materials"
    return product_recommendations(q, "DIY")


def _cost_query(diagnosis: str, property_address: str) -> str:
    parts = [f"{diagnosis.strip()[:2000]} DIY cost estimate"]
    if property_address.strip():
        parts.append(f"Property: {property_address.strip()[:500]}")
    return " ".join(parts)


def _synthesize_diy_json(
    diagnosis: str,
    web_summary: str,
    youtube_videos: list[Dict[str, Any]],
    products_json: str,
    cost_json: str,
) -> str:
    """Single Gemini call: merge inputs into the nested DIY JSON schema (no tools)."""
    client = LEGACY_API_GEMINI.api_client
    payload = {
        "diagnosis": diagnosis[:4000],
        "web_research_summary": web_summary[:6000],
        "youtube_videos": youtube_videos[:15],
        "product_recommendations_raw_json": products_json[:12000],
        "diy_cost_raw_json": cost_json[:8000],
    }
    schema_hint = """
Return ONE JSON object only (no markdown fences) with this shape:
{
  "hire_professional_recommended": <boolean>,
  "diyResults": {
    "diySteps": {
      "summary": "<string>",
      "steps": [ { "stepNumber": <int>, "description": "<string>" } ]
    },
    "youtubeSearch": {
      "videos": [ { "title": "<string>", "url": "<string>", "description": "<string>" } ]
    },
    "recommendedProducts": {
      "products": [
        {
          "item_name": "<string|null>",
          "image_url": "<string|null>",
          "vendor": "<string|null>",
          "reviews": "<string|null>",
          "store_url": "<string|null>"
        }
      ]
    },
    "diyCostEstimates": <object: parse diy_cost_raw_json and place the diyCostEstimates object here>
  }
}
Rules:
- Set hire_professional_recommended true if the work involves gas, main electrical, structural, asbestos, sewage, HVAC sealed refrigerant, or similar hazards implied by the diagnosis or web summary.
- diySteps.steps must be numbered from 1; derive steps from web_research_summary when possible.
- youtubeSearch.videos must come from the youtube_videos list (titles/urls/descriptions); do not invent URLs.
- recommendedProducts.products must be parsed from product_recommendations_raw_json when possible; otherwise use an empty array.
- diyCostEstimates must match the JSON object in diy_cost_raw_json (same diyCostEstimates subtree); if parse fails use {}.
- Do not invent store_url or image_url values not present in the inputs.
"""
    prompt = (
        "You consolidate prefetched DIY research into strict JSON.\n"
        f"{schema_hint}\n\n"
        f"INPUT_JSON:\n{json.dumps(payload, ensure_ascii=False)}"
    )
    try:
        response = client.models.generate_content(
            model=_synthesis_model(),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.85,
                max_output_tokens=int(os.getenv("DIY_SYNTHESIS_MAX_OUTPUT_TOKENS", "4096")),
                response_modalities=["TEXT"],
            ),
        )
        raw = (response.text or "").strip()
        cleaned = _strip_code_fences(raw)
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            raise ValueError("synthesis root must be object")
        if "diyResults" not in parsed:
            raise ValueError("missing diyResults")
        model_hire = parsed.get("hire_professional_recommended")
        inferred = _infer_hire_professional(diagnosis)
        if isinstance(model_hire, bool):
            parsed["hire_professional_recommended"] = model_hire or inferred
        else:
            parsed["hire_professional_recommended"] = inferred
        dr = parsed.get("diyResults")
        if isinstance(dr, dict) and "diyCostEstimates" not in dr:
            try:
                ce = json.loads(cost_json)
                if isinstance(ce, dict) and "diyCostEstimates" in ce:
                    dr["diyCostEstimates"] = ce["diyCostEstimates"]
                else:
                    dr["diyCostEstimates"] = {}
            except Exception:
                dr["diyCostEstimates"] = {}
        return json.dumps(parsed, ensure_ascii=False)
    except Exception as exc:
        logger.exception(
            "DIY synthesis failed; using deterministic fallback (%s: %s)",
            type(exc).__name__,
            exc,
        )
        return _fallback_json(diagnosis, web_summary, youtube_videos, products_json, cost_json)


def _fallback_json(
    diagnosis: str,
    web_summary: str,
    youtube_videos: list[Dict[str, Any]],
    products_json: str,
    cost_json: str,
) -> str:
    products: list[Dict[str, Any]] = []
    try:
        blob = json.loads(products_json)
        rp = blob.get("recommendedProducts") if isinstance(blob, dict) else None
        if isinstance(rp, dict):
            diy_block = rp.get("DIY") if isinstance(rp.get("DIY"), dict) else {}
            raw_list = diy_block.get("products") if isinstance(diy_block, dict) else None
            if isinstance(raw_list, list):
                for p in raw_list[:8]:
                    if isinstance(p, dict):
                        products.append(
                            {
                                "item_name": p.get("item_name"),
                                "image_url": p.get("image_url"),
                                "vendor": p.get("vendor"),
                                "reviews": p.get("reviews"),
                                "store_url": p.get("store_url"),
                            }
                        )
    except Exception:
        logger.debug("Fallback product parse failed", exc_info=True)

    steps: list[Dict[str, Any]] = []
    for line in web_summary.splitlines()[:12]:
        line = line.strip()
        if len(line) < 8:
            continue
        steps.append({"stepNumber": len(steps) + 1, "description": line[:500]})
        if len(steps) >= 8:
            break

    cost_inner: Dict[str, Any] = {}
    if cost_json:
        try:
            parsed_cost = json.loads(cost_json)
            if isinstance(parsed_cost, dict):
                inner = parsed_cost.get("diyCostEstimates")
                cost_inner = inner if isinstance(inner, dict) else {}
        except Exception:
            logger.debug("Fallback cost parse failed", exc_info=True)

    out = {
        "hire_professional_recommended": _infer_hire_professional(diagnosis),
        "diyResults": {
            "diySteps": {
                "summary": web_summary[:2500] if web_summary else "See steps below.",
                "steps": steps or [{"stepNumber": 1, "description": "Review manufacturer guidance before starting."}],
            },
            "youtubeSearch": {"videos": youtube_videos[:10]},
            "recommendedProducts": {"products": products},
            "diyCostEstimates": cost_inner,
        },
    }
    return json.dumps(out, ensure_ascii=False)


def run_diy_pipeline(
    user_query: str,
    property_address: Optional[str] = None,
    context_doc_uris: Optional[list[str]] = None,
) -> str:
    """
    Runs the optimized DIY pipeline: parallel grounded web search, YouTube, shopping,
    library-only DIY cost, then one synthesis LLM call.

    Args:
        user_query: Diagnosis or issue text (checkpoint branch usually embeds checkpoint context here).
        property_address: Optional property address for location context in search prompts.
        context_doc_uris: Reserved for future RAG; ignored for now.

    Returns:
        JSON string suitable for clients (includes hire_professional_recommended and diyResults).
    """
    del context_doc_uris  # reserved
    diagnosis = (user_query or "").strip()
    if not diagnosis:
        return json.dumps(
            {
                "hire_professional_recommended": False,
                "diyResults": {
                    "diySteps": {"summary": "No issue text provided.", "steps": []},
                    "youtubeSearch": {"videos": []},
                    "recommendedProducts": {"products": []},
                    "diyCostEstimates": {},
                },
            }
        )

    addr = (property_address or "").strip()
    ttl = _cache_ttl_seconds()
    ck = _cache_key(diagnosis, addr)
    if ttl > 0:
        with _CACHE_LOCK:
            hit = _DIY_CACHE.get(ck)
            if hit and (time.time() - hit[0]) <= ttl:
                logger.info("DIY orchestrator cache hit key=%s", ck[:16])
                return hit[1]

    t0 = time.monotonic()
    cost_q = _cost_query(diagnosis, addr)

    web_text = ""
    yt: list[Dict[str, Any]] = []
    products_raw = ""
    cost_raw = ""

    future_map: Dict[Future[Any], str] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        future_map[pool.submit(_diy_web_search_grounded, diagnosis, addr)] = "web"
        future_map[pool.submit(_youtube_for_diagnosis, diagnosis)] = "youtube"
        future_map[pool.submit(_products_for_diagnosis, diagnosis)] = "products"
        future_map[pool.submit(cost_estimation_diy_from_library, cost_q)] = "cost"

        for fut in as_completed(future_map):
            name = future_map[fut]
            ph0 = time.monotonic()
            try:
                result = fut.result()
            except Exception as exc:
                logger.exception(
                    "DIY orchestrator phase=%s failed (%s: %s)",
                    name,
                    type(exc).__name__,
                    exc,
                )
                continue
            logger.info(
                "DIY orchestrator phase=%s duration_ms=%d",
                name,
                int((time.monotonic() - ph0) * 1000),
            )
            if name == "web" and isinstance(result, str):
                web_text = result
            elif name == "youtube" and isinstance(result, list):
                yt = result
            elif name == "products" and isinstance(result, str):
                products_raw = result
            elif name == "cost" and isinstance(result, str):
                cost_raw = result

    if not cost_raw:
        cost_raw = cost_estimation_diy_from_library(cost_q)
    if not isinstance(products_raw, str):
        products_raw = json.dumps({"recommendedProducts": {}})

    merged = _synthesize_diy_json(diagnosis, web_text, yt, products_raw, cost_raw)

    logger.info(
        "DIY orchestrator total_duration_ms=%d diagnosis_chars=%d",
        int((time.monotonic() - t0) * 1000),
        len(diagnosis),
    )

    if ttl > 0:
        with _CACHE_LOCK:
            _DIY_CACHE[ck] = (time.time(), merged)
            _prune_cache_unlocked()

    return merged
