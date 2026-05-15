"""
Optional LLM pass: refine checkpoint retrieval ``search_query`` for YouTube / shopping APIs.

Keeps inputs grounded in structured checkpoint fields; on any failure returns the raw query.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

from google.genai import types

from ...model_config import LEGACY_API_GEMINI

logger = logging.getLogger(__name__)


def _vertex_genai_client():
    """Indirection so tests can monkeypatch without replacing a read-only property."""
    return LEGACY_API_GEMINI.api_client

_REFINE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "refined_query": {
            "type": "string",
            "description": (
                "One English search query for residential property DIY videos and "
                "shopping (no URLs, no addresses)."
            ),
        }
    },
    "required": ["refined_query"],
}


def _truthy_env(name: str, default: str = "1") -> bool:
    v = (os.getenv(name, default) or "").strip().lower()
    if v in ("0", "false", "no", "off", ""):
        return False
    return True


def _truncate_at_word(q: str, max_chars: int) -> str:
    q = re.sub(r"\s+", " ", (q or "").strip())
    if len(q) <= max_chars:
        return q
    cut = q[: max_chars + 1]
    if " " in cut:
        return cut.rsplit(" ", 1)[0].strip()
    return cut[:max_chars].strip()


def _hints_from_formatted(
    formatted_results: List[Dict[str, Any]], *, max_json_chars: int = 3500
) -> str:
    """Compact JSON the model may use; capped to keep latency/cost low."""
    rows: List[Dict[str, Any]] = []
    for fc in (formatted_results or [])[:4]:
        if not isinstance(fc, dict):
            continue
        loc = (fc.get("location") or "").strip()
        summ = (fc.get("summary") or "")[:400]
        items = fc.get("detectedItems") or []
        if not isinstance(items, list):
            items = []
        item_strs = [
            str(x).strip()
            for x in items[:12]
            if isinstance(x, str) and str(x).strip()
        ]
        issues_out: List[str] = []
        for issue in (fc.get("issues") or [])[:6]:
            if isinstance(issue, dict):
                d = (issue.get("description") or "").strip()
                if d:
                    issues_out.append(d[:300])
            elif isinstance(issue, str) and issue.strip():
                issues_out.append(issue.strip()[:300])
        rows.append(
            {
                "location": loc,
                "summary": summ,
                "detectedItems": item_strs,
                "issues": issues_out,
            }
        )
    blob = json.dumps({"checkpoints": rows}, ensure_ascii=False)
    if len(blob) > max_json_chars:
        return blob[:max_json_chars] + "…"
    return blob


def _refiner_json_from_response(response: Any) -> Optional[Dict[str, Any]]:
    """
    Parse a JSON object with key ``refined_query`` from a generate_content response.

    Vertex / Gemini 3 may attach JSON to parts flagged as ``thought``, which the
    SDK omits from ``response.text``; ``response.parsed`` is only filled when
    ``_get_text()`` returns non-empty. We therefore try ``parsed``, then
    ``response.text``, then raw concatenation of all text parts (including thought).
    """
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, dict) and parsed.get("refined_query") is not None:
        return parsed

    primary = (getattr(response, "text", None) or "").strip()
    for candidate in (getattr(response, "candidates", None) or [])[:1]:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) if content is not None else None
        if not parts:
            continue
        chunks: list[str] = []
        for part in parts:
            t = getattr(part, "text", None)
            if isinstance(t, str) and t.strip():
                chunks.append(t.strip())
        blob = "\n".join(chunks).strip() if chunks else ""
        if not blob:
            continue
        for attempt in (primary, blob):
            if not attempt:
                continue
            cleaned = attempt.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
                cleaned = re.sub(r"\s*```\s*$", "", cleaned).strip()
            try:
                data = json.loads(cleaned)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and "refined_query" in data:
                return data
    return None


def refine_checkpoint_media_search_query(
    raw_query: str,
    formatted_results: List[Dict[str, Any]],
    *,
    max_out_chars: int = 200,
) -> str:
    """
    Return a YouTube/shopping-friendly search phrase.

    When ``HOMEAPP_REFINE_MEDIA_SEARCH_QUERY`` is unset or truthy, calls a small Gemini
    model with structured output. Otherwise, or on any error, returns ``raw_query``.
    """
    raw = (raw_query or "").strip()
    if not raw or not _truthy_env("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1"):
        return raw
    if not formatted_results:
        return raw

    hints = _hints_from_formatted(formatted_results)
    client = _vertex_genai_client()
    model = LEGACY_API_GEMINI.model
    prompt = (
        "You rewrite property-care search queries for YouTube and Google Shopping.\n"
        "Ground rules:\n"
        "- Use ONLY facts present in INPUT_JSON and RAW_QUERY. Do not invent damage, rooms, or objects.\n"
        "- If the property location is Garage (or similar) and issues mention a door, paint, chips, "
        "scratches, or panels in a residential context, prefer explicit phrases like "
        "\"residential garage door\" or \"garage door\" so results are not confused with car paint repair.\n"
        "- If the context is clearly a vehicle, say so explicitly (e.g. car door paint).\n"
        "- Output one short query string in refined_query; no bullet lists, no markdown, no quotes.\n"
        "- Omit street addresses and personal names.\n"
        "- Keep refined_query under 200 characters when possible.\n\n"
        f"RAW_QUERY:\n{raw}\n\nINPUT_JSON:\n{hints}\n"
    )
    t0 = time.monotonic()
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.15,
                top_p=0.85,
                max_output_tokens=256,
                response_mime_type="application/json",
                response_json_schema=_REFINE_SCHEMA,
                # gemini-2.5-flash spends ~240+ tokens on thinking by default,
                # which truncates JSON at max_output_tokens=256.
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        data = _refiner_json_from_response(response)
        if not isinstance(data, dict):
            fb = getattr(response, "prompt_feedback", None)
            logger.warning(
                "media_search_query_refiner: empty or unparseable JSON from model "
                "(prompt_feedback=%r); using raw query",
                getattr(fb, "block_reason", None) if fb is not None else None,
            )
            return raw
        refined = (data.get("refined_query") or "").strip()
        refined = re.sub(r"\s+", " ", refined)
        if not refined:
            return raw
        refined = _truncate_at_word(refined, max_out_chars)
        if refined.casefold() == raw.casefold():
            logger.debug(
                "media_search_query_refiner: unchanged duration_ms=%d len=%d",
                int((time.monotonic() - t0) * 1000),
                len(refined),
            )
            return refined
        logger.info(
            "media_search_query_refiner: refined duration_ms=%d raw_len=%d out_len=%d",
            int((time.monotonic() - t0) * 1000),
            len(raw),
            len(refined),
        )
        logger.debug(
            "media_search_query_refiner: raw=%r refined=%r",
            raw,
            refined,
        )
        return refined
    except Exception as exc:
        logger.warning(
            "media_search_query_refiner: failed (%s: %s); using raw query",
            type(exc).__name__,
            exc,
        )
        return raw
