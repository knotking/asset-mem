"""Gemini text narratives for comparison pairs missing visualDiff summaries."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)

_PROJECT_ID = (os.environ.get("GCP_PROJECT_ID") or "").strip()
_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not _PROJECT_ID:
        return None
    try:
        from google import genai

        _client = genai.Client(vertexai=True, project=_PROJECT_ID, location="global")
        logger.info("Gemini client ready for report comparison narratives")
    except Exception as exc:
        logger.warning("Gemini client init failed for report narratives: %s", exc)
        _client = None
    return _client


def _analysis_text(analysis: dict[str, Any]) -> str:
    parts: list[str] = []
    summary = (analysis.get("summary") or "").strip()
    if summary:
        parts.append(f"Summary: {summary}")
    issues = analysis.get("issues") or []
    if issues:
        parts.append("Issues:")
        for issue in issues[:8]:
            if isinstance(issue, dict):
                desc = issue.get("description") or issue.get("text") or str(issue)
                sev = issue.get("severity")
                parts.append(f"- [{sev or 'minor'}] {desc}")
            else:
                parts.append(f"- {issue}")
    return "\n".join(parts).strip() or "No analysis text available."


def _parse_json_response(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        return {}
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if fence:
        raw = fence.group(1).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"summary": raw}


def generate_comparison_narrative(
    *,
    location: str,
    baseline_analysis: dict[str, Any],
    comparison_analysis: dict[str, Any],
    purpose: str,
    usage_sink: Optional[dict[str, int]] = None,
) -> Optional[str]:
    """Return a short comparison paragraph when visualDiff is unavailable."""
    client = _get_client()
    if not client:
        return None

    from google.genai import types

    prompt = f"""You are writing a property condition comparison for a formal report ({purpose}).
Location: {location}

Baseline checkpoint analysis:
{_analysis_text(baseline_analysis)}

Comparison (later) checkpoint analysis:
{_analysis_text(comparison_analysis)}

Describe what changed between baseline and comparison in 2-4 sentences.
Focus on condition changes, new or resolved issues, and wear. Be factual; do not invent damage.
Return JSON only: {{"summary": "..."}}"""

    model = "gemini-3.1-flash-lite"
    try:
        response = client.models.generate_content(
            model=model,
            contents=[types.Part.from_text(text=prompt)],
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )
        if usage_sink is not None:
            try:
                from common.token import accumulate_google_genai_generate_response

                accumulate_google_genai_generate_response(usage_sink, response)
            except Exception as exc:
                logger.debug("Token usage record skipped: %s", exc)

        parsed = _parse_json_response(getattr(response, "text", "") or "")
        summary = (parsed.get("summary") or "").strip()
        return summary or None
    except Exception as exc:
        logger.warning(
            "Comparison narrative failed location=%s: %s",
            location,
            exc,
        )
        return None

