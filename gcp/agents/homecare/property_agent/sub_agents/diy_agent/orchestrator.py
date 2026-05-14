"""
Python orchestrator for DIY: parallel data fetch (web + YouTube + products + library cost),
then a single Gemini synthesis call (no second Google Search on cost).

Caching is optional via DIY_ORCHESTRATOR_CACHE_TTL_SECONDS (default 300; set 0 to disable).
"""

from __future__ import annotations

import asyncio
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


def _cache_key(
    user_query: str,
    property_address: Optional[str],
    *,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> str:
    payload = json.dumps(
        {
            "q": user_query.strip(),
            "a": (property_address or "").strip(),
            "r": checkpoint_retrieval_search_query,
        },
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


# Constrains Gemini synthesis output so responses stay parseable (avoids truncated
# JSON / unterminated strings when free-form JSON runs long).
_DIY_SYNTHESIS_RESPONSE_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "hire_professional_recommended": {"type": "boolean"},
        "diyResults": {
            "type": "object",
            "properties": {
                "diySteps": {
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string", "maxLength": 4000},
                        "steps": {
                            "type": "array",
                            "maxItems": 8,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "stepNumber": {"type": "integer"},
                                    "description": {
                                        "type": "string",
                                        "maxLength": 800,
                                    },
                                },
                                "required": ["stepNumber", "description"],
                            },
                        },
                    },
                    "required": ["summary", "steps"],
                },
                "youtubeSearch": {
                    "type": "object",
                    "properties": {
                        "videos": {
                            "type": "array",
                            "maxItems": 15,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string", "maxLength": 400},
                                    "url": {"type": "string", "maxLength": 600},
                                    "description": {
                                        "type": "string",
                                        "maxLength": 600,
                                    },
                                },
                                "required": ["title", "url", "description"],
                            },
                        }
                    },
                    "required": ["videos"],
                },
                "recommendedProducts": {
                    "type": "object",
                    "properties": {
                        "products": {
                            "type": "array",
                            "maxItems": 8,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "item_name": {"type": "string", "maxLength": 400},
                                    "image_url": {"type": "string", "maxLength": 2000},
                                    "vendor": {"type": "string", "maxLength": 200},
                                    "reviews": {"type": "string", "maxLength": 80},
                                    "store_url": {"type": "string", "maxLength": 2000},
                                },
                                "required": [
                                    "item_name",
                                    "image_url",
                                    "vendor",
                                    "reviews",
                                    "store_url",
                                ],
                            },
                        }
                    },
                    "required": ["products"],
                },
                "diyCostEstimates": {
                    "type": "object",
                    "additionalProperties": True,
                },
            },
            "required": [
                "diySteps",
                "youtubeSearch",
                "recommendedProducts",
                "diyCostEstimates",
            ],
        },
    },
    "required": ["hire_professional_recommended", "diyResults"],
}


def _diy_search_seed_max_chars() -> int:
    raw = os.getenv("DIY_SEARCH_SEED_MAX_CHARS", "280").strip()
    try:
        n = int(raw)
    except ValueError:
        return 280
    return max(40, min(n, 2000))


def _extract_labeled_line(text: str, label: str) -> str:
    """Return one-line value after ``Label:`` (checkpoint-style blobs)."""
    m = re.search(rf"(?im)^{re.escape(label)}\s*:\s*(.+)$", text)
    if not m:
        return ""
    return re.sub(r"\s+", " ", m.group(1).strip())


# Comma-separated checkpoint summaries (single line) use the same labels; values end at the next label.
_KNOWN_CHECKPOINT_LABEL = (
    r"(?:Checkpoint\s+Name|(?:Location/Asset|Location)|Summary|Issues|Detected\s+items)"
)


def _extract_inline_labeled_value(one_line: str, label_regex: str) -> str:
    """Parse ``..., Label: value, NextLabel:`` style checkpoint text."""
    m = re.search(
        rf"(?i)(?:^|,)\s*{label_regex}\s*:\s*(.+?)(?=,\s*{_KNOWN_CHECKPOINT_LABEL}\s*:|$)",
        one_line,
    )
    if not m:
        return ""
    return re.sub(r"\s+", " ", m.group(1).strip())


def _joined_clean_parts(loc: str, sum_: str, iss: str) -> list[str]:
    """Join Location / Summary / Issues without duplicating sentence-ending periods."""
    out: list[str] = []
    for p in (loc, sum_, iss):
        s = (p or "").strip().rstrip(" \t.;")
        if s:
            out.append(s)
    return out


def _shopping_query_max_chars() -> int:
    raw = os.getenv("DIY_SHOPPING_QUERY_MAX_CHARS", "120").strip()
    try:
        n = int(raw)
    except ValueError:
        return 120
    return max(30, min(n, 400))


def _shopping_search_seed(loc: str, sum_: str, iss: str) -> str:
    """
    Short keyword-style query for Google Shopping (SerpAPI).

    Long narrative strings often return ``Google hasn't returned any results``;
    location + issues (or summary) tends to match product search better than
    the full YouTube-oriented seed.
    """
    loc = (loc or "").strip().rstrip(" \t.;")
    sum_ = (sum_ or "").strip().rstrip(" \t.;")
    iss = (iss or "").strip().rstrip(" \t.;")
    chunks: list[str] = []
    if loc:
        chunks.append(loc)
    body = iss or sum_
    if body:
        chunks.append(body)
    elif sum_ and not chunks:
        chunks.append(sum_)
    q = " ".join(chunks).strip()
    q = re.sub(r"\s+", " ", q)
    max_c = _shopping_query_max_chars()
    if len(q) > max_c:
        cut = q[: max_c + 1]
        q = cut.rsplit(" ", 1)[0].strip() if " " in cut else cut[:max_c].strip()
    return q


def _parse_checkpoint_fields(diagnosis: str) -> tuple[str, str, str, str]:
    """
    Strip checkpoint boilerplate; return (location, summary, issues, rest_one_line).

    ``rest_one_line`` is the blob collapsed to one line if structured fields are absent.
    """
    raw = (diagnosis or "").strip()
    if not raw:
        return "", "", "", ""

    t = re.sub(r"\r\n?", "\n", raw)
    t = re.sub(
        r"(?is)^\s*analyse?\s+my\s+checkpoints\s*",
        "",
        t,
        count=1,
    ).lstrip()
    t = re.sub(r"(?is)\bcheckpoint\s+context\s*:?\s*", "", t, count=1).strip()
    t = re.sub(r"(?is)checkpoint\s+name\s*:\s*[^\n,]+(?:,|\n)?\s*", "", t, count=1).strip()

    one_line = re.sub(r"\s+", " ", t)

    loc = _extract_labeled_line(t, "Location/Asset") or _extract_labeled_line(t, "Location")
    sum_ = _extract_labeled_line(t, "Summary")
    iss = _extract_labeled_line(t, "Issues")

    if not loc:
        loc = _extract_inline_labeled_value(one_line, r"(?:Location/Asset|Location)")
    if not sum_:
        sum_ = _extract_inline_labeled_value(one_line, "Summary")
    if not iss:
        iss = _extract_inline_labeled_value(one_line, "Issues")

    return loc, sum_, iss, one_line


def _compact_diy_search_seed(diagnosis: str) -> str:
    """
    Turn long checkpoint-style prompts into a short phrase for YouTube search (and fallbacks).

    SerpAPI uses ``_shopping_search_seed`` with a shorter keyword-style query. Full diagnosis is
    still passed to grounded web search and synthesis.
    """
    raw = (diagnosis or "").strip()
    if not raw:
        return ""

    loc, sum_, iss, one_line = _parse_checkpoint_fields(diagnosis)

    parts = _joined_clean_parts(loc, sum_, iss)
    if parts:
        seed = ". ".join(parts)
    else:
        seed = one_line

    seed = re.sub(r"(?i),?\s*detected\s+items\s*:.*$", "", seed).strip()
    seed = re.sub(r"\s+", " ", seed).strip()
    seed = re.sub(r"\.\s*\.+", ". ", seed).strip()

    max_c = _diy_search_seed_max_chars()
    if len(seed) > max_c:
        cut = seed[: max_c + 1]
        if " " in cut:
            seed = cut.rsplit(" ", 1)[0].strip()
        else:
            seed = cut[:max_c].strip()

    if not seed:
        seed = re.sub(r"\s+", " ", raw)[:200].strip()

    if len(diagnosis) > len(seed) + 80:
        logger.debug(
            "DIY external search seed: diagnosis_len=%d seed_len=%d",
            len(diagnosis),
            len(seed),
        )
    return seed


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
    seed = _compact_diy_search_seed(diagnosis)
    q = f"{seed} DIY tutorial how to fix"
    return youtube_search(q, max_results=5)


def _youtube_for_checkpoint_retrieval_seed(seed: str) -> list[Dict[str, Any]]:
    """YouTube Data API uses only the server-built checkpoint retrieval phrase (no extra suffix)."""
    return youtube_search((seed or "").strip(), max_results=5)


def _products_for_diagnosis(diagnosis: str) -> str:
    loc, sum_, iss, _one = _parse_checkpoint_fields(diagnosis)
    seed = _shopping_search_seed(loc, sum_, iss)
    if not seed.strip():
        seed = _compact_diy_search_seed(diagnosis)
    return product_recommendations(seed, "DIY")


def _products_for_checkpoint_retrieval_seed(seed: str) -> str:
    """SerpAPI shopping uses only the server-built checkpoint retrieval phrase as the user stem."""
    return product_recommendations((seed or "").strip(), "DIY")


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
    raw: list[Dict[str, Any]], *, limit: int = 10
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
- diySteps.steps must be numbered from 1; derive steps from web_research_summary when possible. Use at most 8 steps; keep each description under 700 characters (complete sentences; no trailing commas).
- youtubeSearch.videos: copy ONLY from the youtube_videos array in INPUT_JSON (same title/url/description per item, in order). If youtube_videos is empty or missing, set videos to [] exactly. Never use search-results pages, youtu.be without a real id from inputs, or any URL not present in youtube_videos.
- recommendedProducts.products: copy ONLY real shopping rows from product_recommendations_raw_json (recommendedProducts.DIY.products when present). If that list is empty, missing, or the payload is an error/unavailable message, set products to [] exactly. Never fabricate items, "N/A" URLs, generic "Hardware store" rows, or placeholder prices. Use string type for reviews (e.g. "1200" not bare numbers).
- diyCostEstimates must match the JSON object in diy_cost_raw_json (same diyCostEstimates subtree); if parse fails use {}.
- Do not invent store_url, image_url, url, or price fields not present in the inputs.
"""
    prompt = (
        "You consolidate prefetched DIY research into strict JSON.\n"
        f"{schema_hint}\n\n"
        f"INPUT_JSON:\n{json.dumps(payload, ensure_ascii=False)}"
    )
    last_exc: Optional[Exception] = None
    for use_response_schema in (True, False):
        try:
            cfg_kwargs: Dict[str, Any] = {
                "temperature": 0.2,
                "top_p": 0.85,
                "max_output_tokens": int(
                    os.getenv("DIY_SYNTHESIS_MAX_OUTPUT_TOKENS", "8192")
                ),
                "response_mime_type": "application/json",
            }
            if use_response_schema:
                cfg_kwargs["response_json_schema"] = (
                    _DIY_SYNTHESIS_RESPONSE_JSON_SCHEMA
                )
            response = client.models.generate_content(
                model=_synthesis_model(),
                contents=prompt,
                config=types.GenerateContentConfig(**cfg_kwargs),
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
            if isinstance(dr, dict):
                _apply_prefetched_diy_artifacts(dr, youtube_videos, products_json)
            return json.dumps(parsed, ensure_ascii=False)
        except Exception as exc:
            last_exc = exc
            if use_response_schema:
                logger.warning(
                    "DIY synthesis with response_json_schema failed (%s: %s); "
                    "retrying without response schema",
                    type(exc).__name__,
                    exc,
                )
            continue

    logger.exception(
        "DIY synthesis failed after retries; using deterministic fallback (%s: %s)",
        type(last_exc).__name__ if last_exc else "Unknown",
        last_exc,
    )
    return _fallback_json(diagnosis, web_summary, youtube_videos, products_json, cost_json)


def _fallback_json(
    diagnosis: str,
    web_summary: str,
    youtube_videos: list[Dict[str, Any]],
    products_json: str,
    cost_json: str,
) -> str:
    products = _serp_shopping_products_list(products_json)

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
            "youtubeSearch": {"videos": _youtube_videos_client_shape(youtube_videos)},
            "recommendedProducts": {"products": products},
            "diyCostEstimates": cost_inner,
        },
    }
    return json.dumps(out, ensure_ascii=False)


def run_diy_pipeline_sync(
    user_query: str,
    property_address: Optional[str] = None,
    context_doc_uris: Optional[list[str]] = None,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> str:
    """
    Runs the optimized DIY pipeline: parallel grounded web search, YouTube, shopping,
    library-only DIY cost, then one synthesis LLM call.

    Args:
        user_query: Diagnosis or issue text (checkpoint branch usually embeds checkpoint context here).
        property_address: Optional property address for location context in search prompts.
        context_doc_uris: Reserved for future RAG; ignored for now.
        checkpoint_retrieval_search_query: When not ``None``, YouTube and shopping APIs use **only**
            this string (after strip). Checkpoint optional-branch code always passes the retrieval
            tool's ``search_query`` (may be empty). When ``None`` (default), YouTube/products derive
            from ``user_query`` via compaction helpers.

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
    ck = _cache_key(
        diagnosis,
        addr,
        checkpoint_retrieval_search_query=checkpoint_retrieval_search_query,
    )
    if ttl > 0:
        with _CACHE_LOCK:
            hit = _DIY_CACHE.get(ck)
            if hit and (time.time() - hit[0]) <= ttl:
                logger.info("DIY orchestrator cache hit key=%s", ck[:16])
                return hit[1]

    t0 = time.monotonic()
    cost_q = _cost_query(diagnosis, addr)

    logger.info(
        "DIY orchestrator: pipeline_start diagnosis_chars=%d address_set=%s "
        "retrieval_seed_len=%d cache_ttl_s=%.0f",
        len(diagnosis),
        bool(addr),
        -1
        if checkpoint_retrieval_search_query is None
        else len(checkpoint_retrieval_search_query.strip()),
        ttl,
    )

    web_text = ""
    yt: list[Dict[str, Any]] = []
    products_raw = ""
    cost_raw = ""

    future_map: Dict[Future[Any], str] = {}
    submit_at: Dict[Future[Any], float] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        def submit_phase(phase: str, fn, *args: Any) -> None:
            fut = pool.submit(fn, *args)
            future_map[fut] = phase
            submit_at[fut] = time.monotonic()

        submit_phase("web", _diy_web_search_grounded, diagnosis, addr)
        if checkpoint_retrieval_search_query is not None:
            api_seed = checkpoint_retrieval_search_query.strip()
            logger.debug(
                "DIY orchestrator: YouTube+shopping use checkpoint retrieval "
                "search_query only len=%d query=%r",
                len(api_seed),
                api_seed,
            )
            submit_phase("youtube", _youtube_for_checkpoint_retrieval_seed, api_seed)
            submit_phase("products", _products_for_checkpoint_retrieval_seed, api_seed)
        else:
            submit_phase("youtube", _youtube_for_diagnosis, diagnosis)
            submit_phase("products", _products_for_diagnosis, diagnosis)
        submit_phase("cost", cost_estimation_diy_from_library, cost_q)

        for fut in as_completed(future_map):
            name = future_map[fut]
            t_submit = submit_at[fut]
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
            dur_ms = int((time.monotonic() - t_submit) * 1000)
            if name == "youtube":
                vcount = len(result) if isinstance(result, list) else 0
                full_yt = (
                    json.dumps(result, ensure_ascii=False)
                    if isinstance(result, list)
                    else repr(result)
                )
                logger.debug(
                    "DIY orchestrator phase=youtube duration_ms=%d videos=%d full_results=%s",
                    dur_ms,
                    vcount,
                    full_yt,
                )
                logger.info(
                    "DIY orchestrator phase=youtube duration_ms=%d videos=%d",
                    dur_ms,
                    vcount,
                )
            elif name == "products":
                pj = result if isinstance(result, str) else ""
                logger.debug(
                    "DIY orchestrator phase=products duration_ms=%d %s full_json=%s",
                    dur_ms,
                    _product_recommendations_log_summary(pj),
                    pj if (pj or "").strip() else "(empty)",
                )
                logger.info(
                    "DIY orchestrator phase=products duration_ms=%d %s",
                    dur_ms,
                    _product_recommendations_log_summary(pj),
                )
            else:
                logger.info(
                    "DIY orchestrator phase=%s duration_ms=%d",
                    name,
                    dur_ms,
                )
            if name == "web" and isinstance(result, str):
                web_text = result
            elif name == "youtube" and isinstance(result, list):
                yt = result
            elif name == "products" and isinstance(result, str):
                products_raw = result
            elif name == "cost" and isinstance(result, str):
                cost_raw = result

    prefetch_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        "DIY orchestrator: prefetch_parallel_done wall_ms=%d "
        "(web+youtube+products+cost thread pool complete)",
        prefetch_ms,
    )

    if not cost_raw:
        cost_raw = cost_estimation_diy_from_library(cost_q)
    if not isinstance(products_raw, str):
        products_raw = json.dumps({"recommendedProducts": {}})

    t_syn = time.monotonic()
    merged = _synthesize_diy_json(diagnosis, web_text, yt, products_raw, cost_raw)
    syn_ms = int((time.monotonic() - t_syn) * 1000)

    logger.info(
        "DIY orchestrator phase=synthesis duration_ms=%d",
        syn_ms,
    )
    logger.info(
        "DIY orchestrator total_duration_ms=%d prefetch_ms=%d synthesis_ms=%d "
        "diagnosis_chars=%d",
        int((time.monotonic() - t0) * 1000),
        prefetch_ms,
        syn_ms,
        len(diagnosis),
    )

    if ttl > 0:
        with _CACHE_LOCK:
            _DIY_CACHE[ck] = (time.time(), merged)
            _prune_cache_unlocked()

    return merged


async def run_diy_pipeline(
    user_query: str,
    property_address: Optional[str] = None,
    context_doc_uris: Optional[list[str]] = None,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> str:
    """Async ADK tool entrypoint; heavy sync pipeline runs in a worker thread."""
    return await asyncio.to_thread(
        run_diy_pipeline_sync,
        user_query,
        property_address,
        context_doc_uris,
        checkpoint_retrieval_search_query,
    )
