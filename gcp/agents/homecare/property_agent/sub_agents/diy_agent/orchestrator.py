"""
Python orchestrator for DIY: parallel data fetch (web + YouTube + products + library cost),
then a steps-only Gemini call plus deterministic JSON assembly (YouTube, products, cost).

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
from typing import Any, Callable, Dict, Optional, Tuple

from google.genai import types

from ...agent_inputs import SearchLocation
from ...logging_context import auth_uid_scope, get_auth_uid
from ...model_config import LEGACY_API_GEMINI
from ...search_location_utils import market_label
from ..cost_agent.agent import cost_estimation_diy_from_library
from ..shopping_agent.agent import product_recommendations

from .youtube import youtube_search

logger = logging.getLogger(__name__)


def _run_pool_phase(
    fn: Callable[..., Any], args: tuple[Any, ...], uid: Optional[str]
) -> Any:
    """Run ``fn(*args)`` in a thread pool with the caller's Firebase UID on log records."""
    with auth_uid_scope(uid):
        return fn(*args)


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


# Steps-only LLM schema; YouTube / products / cost are assembled in Python.
_DIY_STEPS_ONLY_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "hire_professional_recommended": {"type": "boolean"},
        "diySteps": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "maxLength": 2000},
                "steps": {
                    "type": "array",
                    "maxItems": 8,
                    "items": {
                        "type": "object",
                        "properties": {
                            "stepNumber": {"type": "integer"},
                            "description": {"type": "string", "maxLength": 700},
                        },
                        "required": ["stepNumber", "description"],
                    },
                },
            },
            "required": ["summary", "steps"],
        },
    },
    "required": ["hire_professional_recommended", "diySteps"],
}


def _steps_llm_max_output_tokens() -> int:
    raw = os.getenv("DIY_STEPS_LLM_MAX_OUTPUT_TOKENS", "2048").strip()
    try:
        n = int(raw)
    except ValueError:
        return 2048
    return max(512, min(n, 4096))


def _diy_search_seed_max_chars() -> int:
    raw = os.getenv("DIY_SEARCH_SEED_MAX_CHARS", "280").strip()
    try:
        n = int(raw)
    except ValueError:
        return 280
    return max(40, min(n, 2000))


def _web_grounding_max_output_tokens() -> int:
    raw = os.getenv("DIY_WEB_GROUNDING_MAX_OUTPUT_TOKENS", "1536").strip()
    try:
        n = int(raw)
    except ValueError:
        return 1536
    return max(256, min(n, 4096))


def _web_summary_max_chars() -> int:
    raw = os.getenv("DIY_WEB_SUMMARY_MAX_CHARS", "3500").strip()
    try:
        n = int(raw)
    except ValueError:
        return 3500
    return max(500, min(n, 8000))


def _truncate_web_summary(text: str) -> str:
    cap = _web_summary_max_chars()
    s = (text or "").strip()
    if len(s) <= cap:
        return s
    cut = s[: cap + 1]
    if " " in cut:
        return cut.rsplit(" ", 1)[0].strip()
    return s[:cap].strip()


def resolve_pipeline_diagnosis(
    user_query: str,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> tuple[str, Optional[str]]:
    """
    Split synthesis context from external API / web-grounding seeds.

    ``user_query`` carries the full diagnosis / checkpoint blob for synthesis. When a
    checkpoint retrieval seed is set, grounded web search, YouTube, SerpAPI, and library
    DIY cost use that phrase (after strip). Synthesis always uses ``user_query`` (falling
    back to the seed if ``user_query`` is empty).
    """
    llm_diagnosis = (user_query or "").strip()
    seed = (checkpoint_retrieval_search_query or "").strip()
    api_seed = seed if seed else None
    if not llm_diagnosis and api_seed:
        llm_diagnosis = api_seed
    return llm_diagnosis, api_seed


def _web_grounding_query(llm_diagnosis: str, api_seed: Optional[str]) -> str:
    """Issue text for Google Search grounding: retrieval seed when set, else compacted diagnosis."""
    if api_seed:
        return api_seed
    compact = _compact_diy_search_seed(llm_diagnosis)
    return compact or llm_diagnosis


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
    t = re.sub(
        r"(?is)checkpoint\s+name\s*:\s*[^\n,]+(?:,|\n)?\s*", "", t, count=1
    ).strip()

    one_line = re.sub(r"\s+", " ", t)

    loc = _extract_labeled_line(t, "Location/Asset") or _extract_labeled_line(
        t, "Location"
    )
    sum_ = _extract_labeled_line(t, "Summary")
    iss = _extract_labeled_line(t, "Issues")

    if not loc:
        loc = _extract_inline_labeled_value(one_line, r"(?:Location/Asset|Location)")
    if not sum_:
        sum_ = _extract_inline_labeled_value(one_line, "Summary")
    if not iss:
        iss = _extract_inline_labeled_value(one_line, "Issues")

    return loc, sum_, iss, one_line


def _split_list_field(raw: str) -> list[str]:
    if not (raw or "").strip():
        return []
    return [x.strip() for x in re.split(r"[,;]", raw) if x.strip()]


def parse_checkpoint_structured_context(diagnosis: str) -> Dict[str, Any]:
    """
    Structured checkpoint fields for step generation (location, summary, issues, etc.).

    Returns a dict with only non-empty values suitable for JSON ``checkpoint`` input.
    """
    raw = (diagnosis or "").strip()
    if not raw:
        return {}

    t = re.sub(r"\r\n?", "\n", raw)
    loc, sum_, iss, one_line = _parse_checkpoint_fields(diagnosis)

    detected_raw = _extract_labeled_line(
        t, "Detected items"
    ) or _extract_inline_labeled_value(one_line, r"Detected\s+items")
    conditions_raw = _extract_labeled_line(
        t, "Conditions"
    ) or _extract_inline_labeled_value(one_line, "Conditions")

    out: Dict[str, Any] = {}
    if loc:
        out["location"] = loc
    if sum_:
        out["summary"] = sum_
    if iss:
        out["issues"] = iss
    detected = _split_list_field(detected_raw)
    if detected:
        out["detected_items"] = detected
    conditions = _split_list_field(conditions_raw)
    if conditions:
        out["conditions"] = conditions
    return out


def _compact_diy_search_seed(diagnosis: str) -> str:
    """
    Turn long checkpoint-style prompts into a short phrase for YouTube search (and fallbacks).

    SerpAPI uses ``_shopping_search_seed`` with a shorter keyword-style query. Checkpoint flows
    pass the retrieval seed to YouTube/shopping/web/cost; synthesis uses full ``user_query``.
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


def _market_location_string(
    search_location: Optional[SearchLocation],
    property_address: Optional[str],
) -> str:
    label = market_label(search_location, property_address=property_address)
    if label:
        return label
    return (property_address or "").strip() or "not provided"


def _diy_web_search_grounded(diagnosis: str, market_location: str) -> str:
    """One Gemini call with Google Search grounding for DIY steps context."""
    client = LEGACY_API_GEMINI.api_client
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
    try:
        response = client.models.generate_content(
            model=_web_search_model(),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.35,
                top_p=0.9,
                max_output_tokens=_web_grounding_max_output_tokens(),
                response_modalities=["TEXT"],
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
        return _truncate_web_summary(response.text or "")
    except Exception as exc:
        logger.exception(
            "DIY grounded web search failed (%s: %s)",
            type(exc).__name__,
            exc,
        )
        return ""


def _youtube_for_diagnosis(
    diagnosis: str,
    search_location: Optional[SearchLocation] = None,
) -> list[Dict[str, Any]]:
    seed = _compact_diy_search_seed(diagnosis)
    q = f"{seed} DIY tutorial how to fix"
    return youtube_search(q, max_results=5, search_location=search_location)


def _youtube_for_checkpoint_retrieval_seed(
    seed: str,
    search_location: Optional[SearchLocation] = None,
) -> list[Dict[str, Any]]:
    """YouTube: server-built checkpoint retrieval seed plus DIY intent (same tail as diagnosis path)."""
    base = (seed or "").strip()
    if not base:
        return youtube_search("", max_results=5, search_location=search_location)
    q = f"{base} DIY tutorial how to fix"
    return youtube_search(q, max_results=5, search_location=search_location)


def _products_for_diagnosis(
    diagnosis: str,
    search_location: Optional[SearchLocation] = None,
    property_address: Optional[str] = None,
) -> str:
    loc, sum_, iss, _one = _parse_checkpoint_fields(diagnosis)
    seed = _shopping_search_seed(loc, sum_, iss)
    if not seed.strip():
        seed = _compact_diy_search_seed(diagnosis)
    sl_dict = search_location.model_dump() if search_location else None
    return product_recommendations(
        seed, "DIY", search_location=sl_dict, property_address=property_address
    )


def _products_for_checkpoint_retrieval_seed(
    seed: str,
    search_location: Optional[SearchLocation] = None,
    property_address: Optional[str] = None,
) -> str:
    """SerpAPI shopping uses checkpoint retrieval phrase; geo via search_location."""
    sl_dict = search_location.model_dump() if search_location else None
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


def _normalize_step_list(raw_steps: Any) -> list[Dict[str, Any]]:
    if not isinstance(raw_steps, list):
        return []
    out: list[Dict[str, Any]] = []
    for i, item in enumerate(raw_steps[:8]):
        if not isinstance(item, dict):
            continue
        desc = str(item.get("description") or "").strip()
        if not desc:
            continue
        try:
            num = int(item.get("stepNumber", i + 1))
        except (TypeError, ValueError):
            num = i + 1
        out.append({"stepNumber": num, "description": desc[:700]})
    for j, step in enumerate(out, start=1):
        step["stepNumber"] = j
    return out


def _assemble_diy_results(
    hire_professional_recommended: bool,
    diy_steps: Dict[str, Any],
    youtube_videos: list[Dict[str, Any]],
    products_json: str,
    cost_json: str,
) -> Dict[str, Any]:
    """Build client ``diyResults`` from steps LLM output and prefetched artifacts."""
    summary = str((diy_steps or {}).get("summary") or "").strip()
    steps = _normalize_step_list((diy_steps or {}).get("steps"))
    dr: Dict[str, Any] = {
        "diySteps": {
            "summary": summary or "See steps below.",
            "steps": steps,
        },
        "youtubeSearch": {"videos": []},
        "recommendedProducts": {"products": []},
        "diyCostEstimates": _parse_diy_cost_inner(cost_json),
    }
    _apply_prefetched_diy_artifacts(dr, youtube_videos, products_json)
    return {
        "hire_professional_recommended": hire_professional_recommended,
        "diyResults": dr,
    }


def _generate_diy_steps_llm(
    diagnosis: str,
    web_summary: str,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Single Gemini call: steps + hire-pro only (no YouTube/products/cost in schema).

    Returns ``(hire_professional_recommended, diySteps dict)``.
    """
    client = LEGACY_API_GEMINI.api_client
    checkpoint_ctx = parse_checkpoint_structured_context(diagnosis)
    payload: Dict[str, Any] = {
        "checkpoint": checkpoint_ctx,
        "diagnosis_excerpt": diagnosis[:4000],
        "web_research_summary": (web_summary or "")[:6000],
    }
    prompt = (
        "You write DIY repair steps as strict JSON only (no markdown fences).\n"
        "Use checkpoint fields and web_research_summary when present; prefer web for step order. "
        "Do not invent tools or materials not implied by the inputs. At most 8 numbered steps.\n\n"
        f"INPUT_JSON:\n{json.dumps(payload, ensure_ascii=False)}"
    )
    last_exc: Optional[Exception] = None
    for use_response_schema in (True, False):
        try:
            cfg_kwargs: Dict[str, Any] = {
                "temperature": 0.2,
                "top_p": 0.85,
                "max_output_tokens": _steps_llm_max_output_tokens(),
                "response_mime_type": "application/json",
            }
            if use_response_schema:
                cfg_kwargs["response_json_schema"] = _DIY_STEPS_ONLY_JSON_SCHEMA
            response = client.models.generate_content(
                model=_synthesis_model(),
                contents=prompt,
                config=types.GenerateContentConfig(**cfg_kwargs),
            )
            raw = _strip_code_fences((response.text or "").strip())
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise ValueError("steps LLM root must be object")
            diy_steps = parsed.get("diySteps")
            if not isinstance(diy_steps, dict):
                raise ValueError("missing diySteps")
            model_hire = parsed.get("hire_professional_recommended")
            inferred = _infer_hire_professional(diagnosis)
            hire = (
                (model_hire or inferred) if isinstance(model_hire, bool) else inferred
            )
            return hire, diy_steps
        except Exception as exc:
            last_exc = exc
            if use_response_schema:
                logger.warning(
                    "DIY steps LLM with response_json_schema failed (%s: %s); retrying",
                    type(exc).__name__,
                    exc,
                )
            continue
    logger.exception(
        "DIY steps LLM failed after retries (%s: %s)",
        type(last_exc).__name__ if last_exc else "Unknown",
        last_exc,
    )
    return _infer_hire_professional(diagnosis), _fallback_diy_steps(
        diagnosis, web_summary
    )


def _fallback_diy_steps(diagnosis: str, web_summary: str) -> Dict[str, Any]:
    steps: list[Dict[str, Any]] = []
    for line in (web_summary or "").splitlines()[:12]:
        line = line.strip()
        if len(line) < 8:
            continue
        steps.append({"stepNumber": len(steps) + 1, "description": line[:500]})
        if len(steps) >= 8:
            break
    if not steps:
        ctx = parse_checkpoint_structured_context(diagnosis)
        hint = (ctx.get("issues") or ctx.get("summary") or diagnosis or "")[:500]
        steps = [
            {
                "stepNumber": 1,
                "description": (
                    f"Review the issue ({hint}) and manufacturer guidance before starting."
                    if hint
                    else "Review manufacturer guidance before starting."
                ),
            }
        ]
    summary = (web_summary or "")[:2000]
    if not summary.strip():
        parts = [
            parse_checkpoint_structured_context(diagnosis).get(k)
            for k in ("location", "issues", "summary")
        ]
        summary = ". ".join(p for p in parts if p)[:2000] or "See steps below."
    return {"summary": summary, "steps": steps}


def _synthesize_diy_json(
    diagnosis: str,
    web_summary: str,
    youtube_videos: list[Dict[str, Any]],
    products_json: str,
    cost_json: str,
) -> str:
    """Steps-only LLM call, then Python assembly of prefetched YouTube / products / cost."""
    hire, diy_steps = _generate_diy_steps_llm(diagnosis, web_summary)
    assembled = _assemble_diy_results(
        hire,
        diy_steps,
        youtube_videos,
        products_json,
        cost_json,
    )
    return json.dumps(assembled, ensure_ascii=False)


def _fallback_json(
    diagnosis: str,
    web_summary: str,
    youtube_videos: list[Dict[str, Any]],
    products_json: str,
    cost_json: str,
) -> str:
    hire = _infer_hire_professional(diagnosis)
    diy_steps = _fallback_diy_steps(diagnosis, web_summary)
    assembled = _assemble_diy_results(
        hire,
        diy_steps,
        youtube_videos,
        products_json,
        cost_json,
    )
    return json.dumps(assembled, ensure_ascii=False)


def run_diy_pipeline_sync(
    user_query: str,
    property_address: Optional[str] = None,
    search_location: Optional[SearchLocation] = None,
    context_doc_uris: Optional[list[str]] = None,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> str:
    """
    Runs the optimized DIY pipeline: parallel grounded web search, YouTube, shopping,
    library-only DIY cost, then steps-only LLM + Python assembly.

    Args:
        user_query: Diagnosis or issue text (checkpoint branch usually embeds checkpoint context here).
        property_address: Property record address (identity only; not used for market geo when search_location is set).
        search_location: Unified market/geo for web, cost, and shopping locality.
        context_doc_uris: Reserved for future RAG; ignored for now.
        checkpoint_retrieval_search_query: When set, grounded web search, YouTube, shopping,
            and library DIY cost use this retrieval phrase (after strip). Synthesis uses
            ``user_query`` (full checkpoint / diagnosis text). When ``None``, web/YouTube/products
            derive from compacted ``user_query``.

    Returns:
        JSON string suitable for clients (includes hire_professional_recommended and diyResults).
    """
    del context_doc_uris  # reserved
    diagnosis, api_seed = resolve_pipeline_diagnosis(
        user_query, checkpoint_retrieval_search_query
    )
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

    market_loc = _market_location_string(search_location, property_address)
    ttl = _cache_ttl_seconds()
    ck = _cache_key(
        diagnosis,
        market_loc,
        checkpoint_retrieval_search_query=api_seed,
    )
    if ttl > 0:
        with _CACHE_LOCK:
            hit = _DIY_CACHE.get(ck)
            if hit and (time.time() - hit[0]) <= ttl:
                logger.info("DIY orchestrator cache hit key=%s", ck[:16])
                return hit[1]

    t0 = time.monotonic()
    cost_source = api_seed or diagnosis
    web_query = _web_grounding_query(diagnosis, api_seed)
    cost_q = _cost_query(cost_source, market_loc)

    logger.info(
        "DIY orchestrator: pipeline_start diagnosis_chars=%d web_query_chars=%d "
        "cost_query_chars=%d market_location_set=%s retrieval_seed_len=%d cache_ttl_s=%.0f",
        len(diagnosis),
        len(web_query),
        len(cost_source),
        bool(market_loc and market_loc != "not provided"),
        -1 if api_seed is None else len(api_seed),
        ttl,
    )

    web_text = ""
    yt: list[Dict[str, Any]] = []
    products_raw = ""
    cost_raw = ""

    future_map: Dict[Future[Any], str] = {}
    submit_at: Dict[Future[Any], float] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        submit_uid = get_auth_uid()

        def submit_phase(phase: str, fn, *args: Any) -> None:
            fut = pool.submit(_run_pool_phase, fn, args, submit_uid)
            future_map[fut] = phase
            submit_at[fut] = time.monotonic()

        submit_phase("web", _diy_web_search_grounded, web_query, market_loc)
        if api_seed:
            logger.debug(
                "DIY orchestrator: web+YouTube+shopping use checkpoint retrieval search_query "
                "stem len=%d query=%r",
                len(api_seed),
                api_seed,
            )
            submit_phase(
                "youtube",
                _youtube_for_checkpoint_retrieval_seed,
                api_seed,
                search_location,
            )
            submit_phase(
                "products",
                _products_for_checkpoint_retrieval_seed,
                api_seed,
                search_location,
                property_address,
            )
        else:
            submit_phase("youtube", _youtube_for_diagnosis, diagnosis, search_location)
            submit_phase(
                "products",
                _products_for_diagnosis,
                diagnosis,
                search_location,
                property_address,
            )
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
        "DIY orchestrator phase=steps_synthesis duration_ms=%d",
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
    search_location: Optional[SearchLocation] = None,
    context_doc_uris: Optional[list[str]] = None,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> str:
    """Async ADK tool entrypoint; heavy sync pipeline runs in a worker thread."""
    logger.debug(
        "DIY run_diy_pipeline async entry user_query_len=%d address_set=%s "
        "checkpoint_retrieval_seed=%s context_doc_uris=%d",
        len((user_query or "").strip()),
        bool(market_label(search_location) or (property_address or "").strip()),
        checkpoint_retrieval_search_query is not None,
        len(context_doc_uris or []),
    )
    return await asyncio.to_thread(
        run_diy_pipeline_sync,
        user_query,
        property_address,
        search_location,
        context_doc_uris,
        checkpoint_retrieval_search_query,
    )
