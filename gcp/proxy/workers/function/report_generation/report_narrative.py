"""Gemini executive summaries for property report PDFs."""

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
    except Exception as exc:
        logger.warning("Gemini client init failed for report summaries: %s", exc)
        _client = None
    return _client


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


def _checkpoint_lines(checkpoints: list[dict[str, Any]], *, limit: int = 12) -> str:
    lines: list[str] = []
    for cp in checkpoints[:limit]:
        location = cp.get("location") or cp.get("name") or "Location"
        summary = (cp.get("aiAnalysis") or {}).get("summary") or ""
        lines.append(f"- {location}: {summary}".strip())
    if len(checkpoints) > limit:
        lines.append(f"- …and {len(checkpoints) - limit} more location(s)")
    return "\n".join(lines) or "No checkpoint summaries available."


def generate_executive_summary(
    *,
    property_name: str,
    purpose: str,
    checkpoints: list[dict[str, Any]],
    metrics: dict[str, Any],
    usage_sink: Optional[dict[str, int]] = None,
) -> Optional[str]:
    client = _get_client()
    if not client:
        return None

    from google.genai import types

    issues = metrics.get("issues") or {}
    by_sev = issues.get("total_by_severity") or {}
    headline = ((metrics.get("overall") or {}).get("headline") or {}).get("value")

    prompt = f"""Write an executive summary for a formal property condition snapshot report.
Purpose: {purpose}
Property: {property_name}
Checkpoints included: {metrics.get('checkpointsIncluded', len(checkpoints))}
Headline condition score (0-100, if known): {headline if headline is not None else 'n/a'}
Issues by severity: critical={by_sev.get('critical', 0)}, major={by_sev.get('major', 0)}, moderate={by_sev.get('moderate', 0)}, minor={by_sev.get('minor', 0)}

Location summaries:
{_checkpoint_lines(checkpoints)}

Write 3-5 sentences for a professional PDF cover page. Be factual; do not invent damage.
Return JSON only: {{"summary": "..."}}"""

    return _generate_summary_text(client, types, prompt, usage_sink)


def generate_comparison_overview(
    *,
    property_name: str,
    purpose: str,
    pair_summaries: list[str],
    metrics: dict[str, Any],
    usage_sink: Optional[dict[str, int]] = None,
) -> Optional[str]:
    client = _get_client()
    if not client:
        return None

    from google.genai import types

    issues = metrics.get("issues") or {}
    by_sev = issues.get("total_by_severity") or {}
    locations = "\n".join(f"- {text}" for text in pair_summaries[:12] if text.strip())
    if not locations:
        locations = "No location comparison text available."

    prompt = f"""Write an executive overview for a formal property condition comparison report ({purpose}).
Property: {property_name}
Paired locations summarized: {len(pair_summaries)}
Issues across included checkpoints: critical={by_sev.get('critical', 0)}, major={by_sev.get('major', 0)}, moderate={by_sev.get('moderate', 0)}, minor={by_sev.get('minor', 0)}

Per-location changes:
{locations}

Write 3-5 sentences highlighting overall change patterns and notable damage or improvements.
Return JSON only: {{"summary": "..."}}"""

    return _generate_summary_text(client, types, prompt, usage_sink)


def _generate_summary_text(
    client: Any,
    types: Any,
    prompt: str,
    usage_sink: Optional[dict[str, int]],
) -> Optional[str]:
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
        logger.warning("Report executive summary failed: %s", exc)
        return None
