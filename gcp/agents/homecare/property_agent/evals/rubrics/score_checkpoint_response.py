"""
Deterministic scoring for checkpoint_response rubric criteria (no LLM).

Criteria covered: content_json_analysis_shape, no_dual_format_fences,
schema_version, follow_up_markdown_only (pair scoring).

content_markdown_prose requires LLM-judge or human review (Phase 4).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_RUBRIC_PATH = Path(__file__).resolve().parent / "checkpoint_response.json"
DEFAULT_CONTENT_JSON_SCHEMA_PATH = (
    _PACKAGE_ROOT / "property_agent" / "schemas" / "content_json_v2.schema.json"
)

DETERMINISTIC_CRITERION_IDS = frozenset(
    {
        "content_json_analysis_shape",
        "no_dual_format_fences",
        "schema_version",
        "follow_up_markdown_only",
    }
)

_BRANCH_STATUS = frozenset({"pending", "running", "completed"})
_JSON_FENCE_RE = re.compile(r"```\s*json\b", re.IGNORECASE)


@dataclass(frozen=True)
class CriterionScore:
    criterion_id: str
    passed: bool
    detail: str | None = None


def load_content_json_schema(path: Path | None = None) -> dict[str, Any]:
    schema_path = path or DEFAULT_CONTENT_JSON_SCHEMA_PATH
    return json.loads(schema_path.read_text(encoding="utf-8"))


def validate_content_json(
    content_json: Mapping[str, Any],
    *,
    schema_path: Path | None = None,
) -> list[str]:
    """Return validation error messages; empty when contentJson matches schema."""
    schema = load_content_json_schema(schema_path)
    validator = Draft202012Validator(schema)
    errors: list[str] = []
    for err in sorted(validator.iter_errors(dict(content_json)), key=lambda e: list(e.path)):
        path = ".".join(str(p) for p in err.path) or "(root)"
        errors.append(f"{path}: {err.message}")
    return errors


def _text_fields(message: Mapping[str, Any]) -> list[tuple[str, str]]:
    fields: list[tuple[str, str]] = []
    for key in ("contentMarkdown", "content"):
        value = message.get(key)
        if isinstance(value, str) and value:
            fields.append((key, value))
    return fields


def score_schema_version(message: Mapping[str, Any]) -> CriterionScore:
    version = message.get("contentSchemaVersion")
    if version is None and message.get("content_schema_version") is not None:
        version = message.get("content_schema_version")
    passed = version == 2
    return CriterionScore(
        criterion_id="schema_version",
        passed=passed,
        detail=None if passed else f"contentSchemaVersion={version!r}, expected 2",
    )


def score_no_dual_format_fences(message: Mapping[str, Any]) -> CriterionScore:
    for field, text in _text_fields(message):
        if _JSON_FENCE_RE.search(text):
            return CriterionScore(
                criterion_id="no_dual_format_fences",
                passed=False,
                detail=f"{field} contains ```json fence",
            )
    return CriterionScore(criterion_id="no_dual_format_fences", passed=True)


def score_content_json_analysis_shape(message: Mapping[str, Any]) -> CriterionScore:
    content_json = message.get("contentJson")
    if content_json is None:
        return CriterionScore(
            criterion_id="content_json_analysis_shape",
            passed=True,
            detail="no contentJson (not applicable)",
        )
    if not isinstance(content_json, dict):
        return CriterionScore(
            criterion_id="content_json_analysis_shape",
            passed=False,
            detail="contentJson must be an object",
        )
    analysis = content_json.get("analysis")
    if not isinstance(analysis, dict):
        return CriterionScore(
            criterion_id="content_json_analysis_shape",
            passed=False,
            detail="contentJson.analysis must be an object",
        )
    title = analysis.get("title")
    if not isinstance(title, str) or not title.strip():
        return CriterionScore(
            criterion_id="content_json_analysis_shape",
            passed=False,
            detail="contentJson.analysis.title must be a non-empty string",
        )
    status = analysis.get("analysisStatus")
    if status is not None:
        if not isinstance(status, dict):
            return CriterionScore(
                criterion_id="content_json_analysis_shape",
                passed=False,
                detail="analysisStatus must be an object",
            )
        for branch, value in status.items():
            if value not in _BRANCH_STATUS:
                return CriterionScore(
                    criterion_id="content_json_analysis_shape",
                    passed=False,
                    detail=f"analysisStatus.{branch}={value!r} not in pending|running|completed",
                )
    return CriterionScore(criterion_id="content_json_analysis_shape", passed=True)


def score_follow_up_markdown_only(
    prior_message: Mapping[str, Any],
    follow_up_message: Mapping[str, Any],
) -> CriterionScore:
    prior_json = prior_message.get("contentJson")
    follow_json = follow_up_message.get("contentJson")
    follow_md = follow_up_message.get("contentMarkdown")

    if prior_json is None:
        return CriterionScore(
            criterion_id="follow_up_markdown_only",
            passed=False,
            detail="prior message must include contentJson",
        )
    if follow_json is not None:
        return CriterionScore(
            criterion_id="follow_up_markdown_only",
            passed=False,
            detail="follow-up must omit contentJson",
        )
    if not isinstance(follow_md, str) or not follow_md.strip():
        return CriterionScore(
            criterion_id="follow_up_markdown_only",
            passed=False,
            detail="follow-up must include non-empty contentMarkdown",
        )
    return CriterionScore(criterion_id="follow_up_markdown_only", passed=True)


def score_deterministic_message(message: Mapping[str, Any]) -> list[CriterionScore]:
    """Score single-message deterministic rubric criteria."""
    return [
        score_schema_version(message),
        score_no_dual_format_fences(message),
        score_content_json_analysis_shape(message),
    ]


def score_deterministic_turn_pair(
    prior_message: Mapping[str, Any],
    follow_up_message: Mapping[str, Any],
) -> list[CriterionScore]:
    """Score follow-up pair (prior analysis turn + markdown-only follow-up)."""
    return [
        *score_deterministic_message(follow_up_message),
        score_follow_up_markdown_only(prior_message, follow_up_message),
    ]


def all_passed(scores: list[CriterionScore]) -> bool:
    return all(s.passed for s in scores)


def message_from_turn_expectation(turn: Mapping[str, Any]) -> dict[str, Any]:
    """Synthesize an assistant message patch from conformance expected_messages turn."""
    message: dict[str, Any] = {
        "role": "assistant",
        "content": "Assistant response prose.",
        "agentSteps": [],
        "revision": 1,
    }
    if turn.get("content_schema_version") is not None:
        message["contentSchemaVersion"] = turn["content_schema_version"]
    if turn.get("content_markdown_present"):
        message["contentMarkdown"] = "# Summary\n\nAnalysis complete."
    if turn.get("content_json_present"):
        analysis: dict[str, Any] = {"title": "Checkpoint analysis"}
        keys = turn.get("content_json_analysis_keys") or []
        if "analysisStatus" in keys:
            analysis["analysisStatus"] = {"service": "completed"}
        if "checkpointSummary" in keys:
            analysis["checkpointSummary"] = {"checkpointsAnalyzed": 1}
        message["contentJson"] = {"analysis": analysis}
    return message


def load_golden_message(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path}: golden message must be a JSON object")
    return data
