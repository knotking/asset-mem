"""DIY steps LLM synthesis and JSON assembly."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Callable, Dict, Optional, Tuple

from google.genai import types

from agent_framework.observability.logging_context import auth_uid_scope
from property_agent.model_config import LEGACY_API_GEMINI

from .checkpoint_parse import (
    _infer_hire_professional,
    parse_checkpoint_structured_context,
)
from .prefetch import (
    _apply_prefetched_diy_artifacts,
    _parse_diy_cost_inner,
)

logger = logging.getLogger(__name__)


def _run_pool_phase(
    fn: Callable[..., Any], args: tuple[Any, ...], uid: Optional[str]
) -> Any:
    """Run ``fn(*args)`` in a thread pool with the caller's Firebase UID on log records."""
    with auth_uid_scope(uid):
        return fn(*args)


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


def _synthesis_model() -> str:
    return LEGACY_API_GEMINI.model


def _steps_llm_max_output_tokens() -> int:
    raw = os.getenv("DIY_STEPS_LLM_MAX_OUTPUT_TOKENS", "3072").strip()
    try:
        n = int(raw)
    except ValueError:
        return 3072
    return max(512, min(n, 4096))


def _steps_web_excerpt_chars() -> int:
    raw = os.getenv("DIY_STEPS_WEB_EXCERPT_CHARS", "2200").strip()
    try:
        n = int(raw)
    except ValueError:
        return 2200
    return max(400, min(n, 6000))


def _web_excerpt_for_steps(web_summary: str) -> str:
    """Cap web research in the steps prompt to reduce truncation / JSON parse failures."""
    text = (web_summary or "").strip()
    limit = _steps_web_excerpt_chars()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip() + "…"


def _strip_code_fences(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```\s*$", "", s)
    return s.strip()


def _repair_json_text(raw: str) -> str:
    """Best-effort fix for truncated JSON from max_output_tokens."""
    s = _strip_code_fences(raw)
    if not s:
        return s
    for _ in range(16):
        try:
            json.loads(s)
            return s
        except json.JSONDecodeError:
            if s.count('"') % 2 == 1:
                s += '"'
            elif s.count("[") > s.count("]"):
                if s.rstrip().endswith("}"):
                    s += "]"
                else:
                    s += "}]"
            elif s.count("{") > s.count("}"):
                s += "}"
            else:
                s += "}"
    return s


def _load_steps_parsed(raw: str) -> Optional[Dict[str, Any]]:
    for candidate in (raw, _repair_json_text(raw)):
        if not candidate:
            continue
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict) and isinstance(parsed.get("diySteps"), dict):
            return parsed
    return None


def _extract_numbered_steps_from_web(web_summary: str) -> list[Dict[str, Any]]:
    """Pull numbered/bulleted lines from web research when JSON synthesis fails."""
    steps: list[Dict[str, Any]] = []
    for line in (web_summary or "").splitlines():
        line = line.strip()
        if len(line) < 10:
            continue
        m = re.match(r"^(?:\d+[\).\]]\s*|[-*•]\s+)(.+)$", line)
        desc = (m.group(1) if m else line).strip()
        if len(desc) < 8:
            continue
        if desc.lower().startswith(("http://", "https://", "www.")):
            continue
        steps.append({"stepNumber": len(steps) + 1, "description": desc[:500]})
        if len(steps) >= 8:
            break
    return steps


def _log_steps_finish_reason(response: Any) -> None:
    try:
        candidates = getattr(response, "candidates", None) or []
        if not candidates:
            return
        finish = getattr(candidates[0], "finish_reason", None)
        if finish and str(finish) not in ("STOP", "FinishReason.STOP"):
            logger.warning("DIY steps LLM finish_reason=%s", finish)
    except Exception:
        pass


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
    *,
    retrieval_search_query: Optional[str] = None,
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
    web_excerpt = _web_excerpt_for_steps(web_summary)
    payload: Dict[str, Any] = {
        "checkpoint": checkpoint_ctx,
        "diagnosis_excerpt": diagnosis[:4000],
        "web_research_summary": web_excerpt,
    }
    prompt = (
        "You write DIY repair steps as strict JSON only (no markdown fences).\n"
        "Output hire_professional_recommended (boolean) and diySteps with a short summary "
        "(max 400 chars) plus up to 8 numbered steps (each description max 200 chars).\n"
        "Use web_research_summary only to infer step order and actions; do NOT paste the "
        "full web research into summary or step text. Do not invent tools not implied by inputs.\n\n"
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
            _log_steps_finish_reason(response)
            raw = _strip_code_fences((response.text or "").strip())
            parsed = _load_steps_parsed(raw)
            if parsed is None:
                raise ValueError("steps LLM JSON invalid or missing diySteps")
            diy_steps = parsed["diySteps"]
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
    steps = _extract_numbered_steps_from_web(web_summary)
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
    summary = _web_excerpt_for_steps(web_summary)[:400]
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
    *,
    retrieval_search_query: Optional[str] = None,
) -> str:
    """Steps-only LLM call, then Python assembly of prefetched YouTube / products / cost."""
    hire, diy_steps = _generate_diy_steps_llm(diagnosis, web_summary)
    assembled = _assemble_diy_results(
        hire,
        diy_steps,
        youtube_videos,
        products_json,
        cost_json,
        retrieval_search_query=retrieval_search_query,
    )
    return json.dumps(assembled, ensure_ascii=False)


def _fallback_json(
    diagnosis: str,
    web_summary: str,
    youtube_videos: list[Dict[str, Any]],
    products_json: str,
    cost_json: str,
    *,
    retrieval_search_query: Optional[str] = None,
) -> str:
    hire = _infer_hire_professional(diagnosis)
    diy_steps = _fallback_diy_steps(diagnosis, web_summary)
    assembled = _assemble_diy_results(
        hire,
        diy_steps,
        youtube_videos,
        products_json,
        cost_json,
        retrieval_search_query=retrieval_search_query,
    )
    return json.dumps(assembled, ensure_ascii=False)
