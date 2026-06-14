"""Deterministic rubric scorer and contentJson schema contract tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from property_agent.evals.rubrics.score_checkpoint_response import (
    DEFAULT_CONTENT_JSON_SCHEMA_PATH,
    DEFAULT_RUBRIC_PATH,
    all_passed,
    load_golden_message,
    message_from_turn_expectation,
    score_content_json_analysis_shape,
    score_deterministic_message,
    score_deterministic_turn_pair,
    score_follow_up_markdown_only,
    score_no_dual_format_fences,
    score_schema_version,
    validate_content_json,
)

pytestmark = pytest.mark.contract

CONTRACTS_ROOT = (
    Path(__file__).resolve().parents[1]
    / "property_agent"
    / "evals"
    / "contracts"
    / "golden_messages"
)
CONFORMANCE_ROOT = Path(__file__).resolve().parents[1] / "property_agent" / "conformance"


def test_rubric_file_lists_deterministic_criteria() -> None:
    rubric = json.loads(DEFAULT_RUBRIC_PATH.read_text(encoding="utf-8"))
    ids = {c["id"] for c in rubric.get("criteria", [])}
    assert "content_json_analysis_shape" in ids
    assert "no_dual_format_fences" in ids
    assert "schema_version" in ids
    assert "follow_up_markdown_only" in ids


def test_content_json_schema_file_exists() -> None:
    assert DEFAULT_CONTENT_JSON_SCHEMA_PATH.is_file()


def test_golden_analysis_message_passes_schema_and_rubric() -> None:
    message = load_golden_message(CONTRACTS_ROOT / "analysis_with_branches.json")
    assert validate_content_json(message["contentJson"]) == []
    scores = score_deterministic_message(message)
    assert all_passed(scores)


def test_golden_greeting_passes_rubric_without_content_json() -> None:
    message = load_golden_message(CONTRACTS_ROOT / "greeting_markdown_only.json")
    scores = score_deterministic_message(message)
    assert all_passed(scores)


def test_golden_follow_up_pair_passes_follow_up_criterion() -> None:
    pair = load_golden_message(CONTRACTS_ROOT / "markdown_follow_up_pair.json")
    scores = score_deterministic_turn_pair(pair["prior"], pair["follow_up"])
    assert all_passed(scores)


def test_no_dual_format_fences_fails_on_json_fence() -> None:
    message = {
        "contentSchemaVersion": 2,
        "contentMarkdown": "See details:\n```json\n{\"analysis\":{}}\n```",
    }
    score = score_no_dual_format_fences(message)
    assert not score.passed


def test_schema_version_rejects_non_v2() -> None:
    score = score_schema_version({"contentSchemaVersion": 1})
    assert not score.passed


def test_content_json_analysis_shape_requires_title() -> None:
    score = score_content_json_analysis_shape(
        {"contentJson": {"analysis": {"analysisStatus": {"diy": "completed"}}}}
    )
    assert not score.passed


def test_follow_up_markdown_only_rejects_content_json_on_follow_up() -> None:
    prior = {"contentJson": {"analysis": {"title": "T"}}}
    follow = {
        "contentMarkdown": "More detail.",
        "contentJson": {"analysis": {"title": "T"}},
    }
    score = score_follow_up_markdown_only(prior, follow)
    assert not score.passed


@pytest.mark.parametrize(
    "fixture_name",
    [
        "routing/hello_plain_welcome",
        "multi_turn/thanks_after_service_analysis",
        "multi_turn/got_it_after_analysis",
        "multi_turn/casual_after_service_analysis",
        "multi_turn/explain_prior_after_cost_diy",
    ],
)
def test_conformance_turn_expectations_score_cleanly(fixture_name: str) -> None:
    case_dir = CONFORMANCE_ROOT / fixture_name
    expected = yaml.safe_load((case_dir / "expected_messages.yaml").read_text())
    turns = expected["turns"]
    messages = [message_from_turn_expectation(t) for t in turns]
    for message in messages:
        assert all_passed(score_deterministic_message(message))
        if message.get("contentJson") is not None:
            assert validate_content_json(message["contentJson"]) == []
    for idx in range(1, len(messages)):
        prior = messages[idx - 1]
        follow = messages[idx]
        if prior.get("contentJson") and not follow.get("contentJson"):
            assert all_passed(score_deterministic_turn_pair(prior, follow))
