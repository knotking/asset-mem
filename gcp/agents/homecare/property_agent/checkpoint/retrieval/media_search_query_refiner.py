"""
Optional LLM pass: refine checkpoint retrieval search into branch-specific intents.

One small Gemini call produces issue stem, YouTube query, shopping materials, and
service trade query. On failure, returns deterministic fallbacks from the raw query.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

from agent_platform.core.ports import GenerateRequest
from property_agent.model_config import (
    direct_gemini_thinking_config,
    direct_generate_model_client,
)

from property_agent.checkpoint.branch_search_intents import (
    BranchSearchIntents,
    compact_youtube_search_query,
)

logger = logging.getLogger(__name__)


def _direct_generate_model_client():
    """Indirection so tests can monkeypatch without replacing a cached factory."""
    return direct_generate_model_client()


_REFINE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "issue_stem": {
            "type": "string",
            "description": (
                "Short issue phrase for cost/coverage context (no URLs, no addresses)."
            ),
        },
        "youtube_query": {
            "type": "string",
            "description": (
                "Short YouTube keyword phrase (3-6 words): asset + problem + action. "
                "Example: 'garage door paint repair'. No 'how to', no tutorial wording."
            ),
        },
        "shopping_materials": {
            "type": "array",
            "description": (
                "3-5 Google Shopping product/tool phrases for the chosen repair focus "
                "(home: plumbing, paint, HVAC; vehicle: touch-up paint, polish, etc.). "
                "Not generic 'scratch repair kit'. Do not assume materials unless stated."
            ),
            "items": {"type": "string"},
            "minItems": 1,
            "maxItems": 5,
        },
        "service_trade_query": {
            "type": "string",
            "description": (
                "Local Maps search for a licensed trade contractor (not hardware stores)."
            ),
        },
    },
    "required": [
        "issue_stem",
        "youtube_query",
        "shopping_materials",
        "service_trade_query",
    ],
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
    return q[:max_chars].strip()


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
            str(x).strip() for x in items[:12] if isinstance(x, str) and str(x).strip()
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
    Parse branch-intent JSON from a generate_content response.

    Accepts ``issue_stem`` or legacy ``refined_query``.
    """
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, dict) and (
        parsed.get("issue_stem") is not None or parsed.get("refined_query") is not None
    ):
        return parsed

    primary = (getattr(response, "text", None) or "").strip()

    def _try_parse_json_blob(blob: str) -> Optional[Dict[str, Any]]:
        if not blob:
            return None
        cleaned = blob.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```\s*$", "", cleaned).strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            return None
        if isinstance(data, dict) and (
            "issue_stem" in data or "refined_query" in data
        ):
            return data
        return None

    from_primary = _try_parse_json_blob(primary)
    if from_primary is not None:
        return from_primary

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
            if isinstance(data, dict) and (
                "issue_stem" in data or "refined_query" in data
            ):
                return data
    return None


def _normalize_refiner_payload(
    data: Dict[str, Any],
    raw: str,
    *,
    max_out_chars: int,
) -> BranchSearchIntents:
    """Map LLM JSON to BranchSearchIntents with legacy field support."""
    if "issue_stem" not in data and data.get("refined_query"):
        data = {**data, "issue_stem": data["refined_query"]}
    parsed = BranchSearchIntents.from_dict(data)
    if parsed is None:
        return BranchSearchIntents.fallback_from_raw_query(raw)
    return BranchSearchIntents(
        issue_stem=_truncate_at_word(parsed.issue_stem, max_out_chars),
        youtube_query=compact_youtube_search_query(parsed.youtube_query or parsed.issue_stem),
        shopping_materials=[
            _truncate_at_word(m, 80) for m in parsed.shopping_materials[:5] if m
        ]
        or [_truncate_at_word(parsed.issue_stem, 80)],
        service_trade_query=_truncate_at_word(parsed.service_trade_query, 120),
    )


def _refiner_prompt(raw_query: str, hints_json: str) -> str:
    """
    LLM instructions for branch search intents.

    One intent set is emitted per retrieval run and shared by DIY, service, YouTube,
    and cost branches — including when INPUT_JSON lists multiple checkpoints/issues.
    """
    return (
        "You rewrite home-care checkpoint issues into search intents for "
        "YouTube tutorials, Google Shopping materials, and local service providers.\n"
        "Scope includes BOTH the home (structure, systems, grounds, garage doors, etc.) "
        "AND vehicles (cars and other autos described in INPUT_JSON). Match the asset "
        "type the checkpoint actually describes.\n"
        "Ground rules:\n"
        "- Use ONLY facts in INPUT_JSON and RAW_QUERY. Do not invent damage, rooms, "
        "materials, or trades.\n"
        "- Tailor outputs to the ACTUAL issue and asset (plumbing, HVAC, garage door, "
        "vehicle paint scratch, tire, etc.).\n"
        "- Do NOT assume surface materials (metal, wood, vinyl, clear coat) unless "
        "INPUT_JSON states them. When unknown, use neutral phrases (e.g. 'exterior "
        "primer', 'touch-up paint', 'automotive touch-up paint').\n"
        "- Do not mix domains: home garage-door paint is not vehicle body repair; "
        "vehicle scratches/dents are not residential garage door repair.\n"
        "\n"
        "Multiple checkpoints or issues in INPUT_JSON:\n"
        "- RAW_QUERY may concatenate several locations/issues (often truncated). Prefer "
        "INPUT_JSON for structure.\n"
        "- If issues are unrelated, choose ONE most actionable repair focus and use it "
        "consistently across issue_stem, youtube_query, shopping_materials, and "
        "service_trade_query.\n"
        "- If several issues share one trade (e.g. multiple plumbing items), merge into "
        "one coherent stem.\n"
        "- shopping_materials must all relate to the SAME chosen repair focus (3-5 items).\n"
        "\n"
        "Issue-type hints (apply only when INPUT_JSON supports them — not defaults):\n"
        "Home:\n"
        "- Garage + door + paint/chips/scratches: issue_stem may be descriptive; "
        "youtube_query short keyword e.g. 'garage door paint repair' — not car touch-up.\n"
        "- Plumbing leak or clog: plumber; plumber's putty, drain snake, pipe sealant.\n"
        "- Electrical panel/outlets: electrician.\n"
        "- Roof/gutter: roofer or gutter contractor; roofing sealant or gutter parts.\n"
        "- HVAC: HVAC technician; filter or duct supplies only if mentioned.\n"
        "Vehicle:\n"
        "- Paint scratch, chip, or scuff on car/auto: youtube_query e.g. "
        "'car paint chip repair'; auto body shop — not garage door products.\n"
        "- Dent, bumper, or body panel damage: auto body repair shop or PDR specialist.\n"
        "- Tire, battery, or mechanical: tire shop, mobile mechanic, or relevant trade.\n"
        "\n"
        "Output fields:\n"
        "- issue_stem: concise problem phrase for cost/coverage (no addresses).\n"
        "- youtube_query: 3-6 word keyword phrase as typed into YouTube search — "
        "asset + problem + action (e.g. 'garage door paint repair', "
        "'car paint chip repair', 'kitchen sink leak fix'). No 'how to', no "
        "'tutorial', no full sentences.\n"
        "- shopping_materials: 3-5 specific product/tool phrases for that repair — NOT "
        "generic 'scratch repair kit' or 'DIY repair products tools'.\n"
        "- service_trade_query: appropriate licensed or specialist provider (plumber, "
        "electrician, painter, auto body shop, mobile mechanic, etc.) — NOT hardware "
        "store, lumber yard, or parts retailer as the primary search.\n"
        "- Omit street addresses and personal names. Keep each string concise.\n\n"
        f"RAW_QUERY:\n{raw_query}\n\nINPUT_JSON:\n{hints_json}\n"
    )


def refine_checkpoint_branch_search_intents(
    raw_query: str,
    formatted_results: List[Dict[str, Any]],
    *,
    max_out_chars: int = 200,
) -> BranchSearchIntents:
    """
    Return branch-specific search intents for optional checkpoint analysis.

    When ``HOMEAPP_REFINE_MEDIA_SEARCH_QUERY`` is unset or truthy, calls Gemini with
    structured output. Otherwise, or on any error, returns deterministic fallbacks.
    """
    raw = (raw_query or "").strip()
    if not raw:
        return BranchSearchIntents.fallback_from_raw_query("")
    if not _truthy_env("HOMEAPP_REFINE_MEDIA_SEARCH_QUERY", "1") or not formatted_results:
        return BranchSearchIntents.fallback_from_raw_query(raw)

    hints = _hints_from_formatted(formatted_results)
    model_client = _direct_generate_model_client()
    prompt = _refiner_prompt(raw, hints)
    t0 = time.monotonic()
    try:
        response = model_client.generate(
            GenerateRequest(
                contents=prompt,
                temperature=0.15,
                max_output_tokens=512,
                response_mime_type="application/json",
                response_json_schema=_REFINE_SCHEMA,
                extra_config={
                    "top_p": 0.85,
                    "thinking_config": direct_gemini_thinking_config(
                        "MEDIA_SEARCH_REFINE_THINKING",
                        default="minimal",
                    ),
                },
            )
        )
        data = _refiner_json_from_response(response.raw)
        if not isinstance(data, dict):
            fb = getattr(response, "prompt_feedback", None)
            logger.warning(
                "media_search_query_refiner: empty or unparseable JSON "
                "(prompt_feedback=%r); using fallback intents",
                getattr(fb, "block_reason", None) if fb is not None else None,
            )
            return BranchSearchIntents.fallback_from_raw_query(raw)

        intents = _normalize_refiner_payload(data, raw, max_out_chars=max_out_chars)
        dur_ms = int((time.monotonic() - t0) * 1000)
        if intents.issue_stem.casefold() == raw.casefold():
            logger.debug(
                "media_search_query_refiner: issue_stem unchanged duration_ms=%d",
                dur_ms,
            )
        else:
            logger.info(
                "media_search_query_refiner: refined duration_ms=%d raw_len=%d "
                "stem_len=%d materials=%d",
                dur_ms,
                len(raw),
                len(intents.issue_stem),
                len(intents.shopping_materials),
            )
        logger.debug(
            "media_search_query_refiner: intents=%s",
            json.dumps(intents.to_dict(), ensure_ascii=False),
        )
        return intents
    except Exception as exc:
        logger.warning(
            "media_search_query_refiner: failed (%s: %s); using fallback intents",
            type(exc).__name__,
            exc,
        )
        return BranchSearchIntents.fallback_from_raw_query(raw)


def refine_checkpoint_media_search_query(
    raw_query: str,
    formatted_results: List[Dict[str, Any]],
    *,
    max_out_chars: int = 200,
) -> str:
    """Backward-compatible wrapper: returns ``issue_stem`` only."""
    intents = refine_checkpoint_branch_search_intents(
        raw_query, formatted_results, max_out_chars=max_out_chars
    )
    return intents.issue_stem or (raw_query or "").strip()


__all__ = [
    "BranchSearchIntents",
    "_refiner_prompt",
    "refine_checkpoint_branch_search_intents",
    "refine_checkpoint_media_search_query",
]
