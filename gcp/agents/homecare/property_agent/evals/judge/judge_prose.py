"""
LLM-judge for ``content_markdown_prose`` (Phase 4).

CI-safe helpers (prompt + JSON parse) are unit-tested. Live Vertex calls are
opt-in via ``make prose-judge`` / ``RUN_PROSE_JUDGE_EVAL=1``.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_RUBRIC_PATH = (
    _PACKAGE_ROOT / "property_agent/evals/rubrics/checkpoint_response.json"
)

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


@dataclass(frozen=True)
class ProseJudgeResult:
    passed: bool
    score: float
    reasons: list[str]
    raw_response: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "score": self.score,
            "reasons": list(self.reasons),
            "raw_response": self.raw_response,
        }


def load_prose_rubric_text(path: Path | None = None) -> str:
    rubric_path = path or DEFAULT_RUBRIC_PATH
    data = json.loads(rubric_path.read_text(encoding="utf-8"))
    for criterion in data.get("criteria") or []:
        if criterion.get("id") == "content_markdown_prose":
            return str(criterion.get("rubric") or criterion.get("description") or "")
    raise ValueError(f"content_markdown_prose criterion not found in {rubric_path}")


def build_prose_judge_prompt(
    *,
    user_query: str,
    content_markdown: str,
    rubric_text: str,
    context: str | None = None,
) -> str:
    context_block = f"\nContext:\n{context.strip()}\n" if context and context.strip() else ""
    return (
        "You are an evaluator for a property-care AI assistant.\n"
        "Score ONLY the assistant's user-visible markdown prose.\n"
        "Ignore structured accordions (contentJson); they are scored separately.\n\n"
        f"Rubric (content_markdown_prose):\n{rubric_text.strip()}\n\n"
        f"User query:\n{user_query.strip()}\n"
        f"{context_block}\n"
        "Assistant contentMarkdown:\n"
        f"{content_markdown.strip()}\n\n"
        "Respond with JSON only:\n"
        '{"passed": true|false, "score": 0.0-1.0, "reasons": ["short bullet"]}\n'
        "Pass when markdown is non-empty, user-facing, and does not embed analysis JSON."
    )


def parse_prose_judge_response(text: str) -> ProseJudgeResult:
    raw = (text or "").strip()
    if not raw:
        return ProseJudgeResult(
            passed=False,
            score=0.0,
            reasons=["empty judge response"],
            raw_response=raw,
        )

    candidate = raw
    fence = _JSON_FENCE_RE.search(raw)
    if fence:
        candidate = fence.group(1).strip()

    try:
        payload = json.loads(candidate)
    except json.JSONDecodeError:
        return ProseJudgeResult(
            passed=False,
            score=0.0,
            reasons=["judge response was not valid JSON"],
            raw_response=raw,
        )

    if not isinstance(payload, dict):
        return ProseJudgeResult(
            passed=False,
            score=0.0,
            reasons=["judge JSON must be an object"],
            raw_response=raw,
        )

    passed = bool(payload.get("passed"))
    score_raw = payload.get("score", 0.0)
    try:
        score = float(score_raw)
    except (TypeError, ValueError):
        score = 0.0
    score = max(0.0, min(1.0, score))
    reasons_raw = payload.get("reasons") or []
    reasons = [str(r) for r in reasons_raw if str(r).strip()] if isinstance(reasons_raw, list) else []
    if not reasons:
        reasons = ["no reasons provided"]

    return ProseJudgeResult(
        passed=passed,
        score=score,
        reasons=reasons,
        raw_response=raw,
    )


def judge_prose_markdown(
    *,
    user_query: str,
    content_markdown: str,
    rubric_text: str,
    context: str | None = None,
    generate_text: Callable[[str], str] | None = None,
) -> ProseJudgeResult:
    prompt = build_prose_judge_prompt(
        user_query=user_query,
        content_markdown=content_markdown,
        rubric_text=rubric_text,
        context=context,
    )
    if generate_text is None:
        raise RuntimeError("generate_text is required for live prose judge eval")
    response_text = generate_text(prompt)
    return parse_prose_judge_response(response_text)


def live_generate_text(prompt: str) -> str:
    """Call Vertex Gemini for judge eval (weekly / staging only)."""
    from google.genai import types

    from property_agent.model_config import global_direct_generate_client_and_model
    from property_agent.shared.google_search_grounding import (
        text_from_generate_content_response,
    )

    client, model = global_direct_generate_client_and_model()
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=512,
            response_mime_type="application/json",
        ),
    )
    return text_from_generate_content_response(response)
