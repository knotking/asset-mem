"""Markdown-only synthesis LLM for assembled checkpoint analysis."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

from google.genai import types

from property_agent.model_config import (
    direct_gemini_thinking_config,
    global_direct_generate_client_and_model,
)

logger = logging.getLogger(__name__)


def _synthesis_user_content(
    analysis: Dict[str, Any],
    *,
    checkpoint_results: str,
    user_query: str,
) -> str:
    return (
        "Write concise summary markdown for the property owner "
        "(overview, recommendations, next steps).\n"
        "Rules:\n"
        "- Output markdown prose only; start with a single `#` H1 title.\n"
        "- The H1 must be a short, specific issue title "
        '(e.g. `# Garage Door Paint Chipping`). Do NOT use generic titles like '
        '"Executive Summary" or prefix the title with "Executive Summary:".\n'
        "- Do NOT output JSON or ```json fences.\n"
        "- Do not repeat full accordion tables; the UI renders structured sections separately.\n\n"
        f"User question: {user_query}\n\n"
        f"Checkpoint retrieval context (excerpt):\n{(checkpoint_results or '')[:4000]}\n\n"
        "Assembled analysis JSON (for your reasoning only):\n"
        f"{json.dumps({'analysis': analysis}, ensure_ascii=False, indent=2)}"
    )


async def synthesize_checkpoint_markdown(
    analysis: Dict[str, Any],
    *,
    checkpoint_results: str,
    user_query: str,
) -> str:
    """Run synthesis LLM; returns markdown prose only."""
    client, model = global_direct_generate_client_and_model()
    contents = _synthesis_user_content(
        analysis,
        checkpoint_results=checkpoint_results,
        user_query=user_query,
    )
    try:
        response = await client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=2048,
                thinking_config=direct_gemini_thinking_config(
                    "CHECKPOINT_SYNTHESIS_THINKING",
                    default="low",
                ),
            ),
        )
    except Exception:
        logger.exception("checkpoint synthesis: generate_content failed")
        from .assembler import render_markdown

        return render_markdown(analysis)

    text = ""
    if response and response.candidates:
        content = response.candidates[0].content
        for part in (content.parts if content else None) or []:
            if part.text:
                text += part.text
    text = (text or "").strip()
    if not text:
        from .assembler import render_markdown

        return render_markdown(analysis)
    if "```json" in text.lower():
        logger.warning("checkpoint synthesis: model emitted json fence; stripping")
        text = text.split("```json")[0].strip()
    return text
