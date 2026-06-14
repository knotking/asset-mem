"""Tests for Phase 4 prose LLM-judge helpers (no Vertex)."""

from __future__ import annotations

from pathlib import Path

from property_agent.evals.judge.judge_prose import (
    build_prose_judge_prompt,
    load_prose_rubric_text,
    parse_prose_judge_response,
)
from property_agent.evals.judge.run_prose_judge_eval import load_cases, run_eval


def test_load_prose_rubric_text() -> None:
    text = load_prose_rubric_text()
    assert "contentMarkdown" in text or "markdown" in text.lower()


def test_build_prose_judge_prompt_includes_query_and_markdown() -> None:
    prompt = build_prose_judge_prompt(
        user_query="hello",
        content_markdown="Hi there!",
        rubric_text="Pass when prose is user-facing.",
    )
    assert "hello" in prompt
    assert "Hi there!" in prompt
    assert '"passed"' in prompt


def test_parse_prose_judge_response_accepts_fenced_json() -> None:
    result = parse_prose_judge_response(
        '```json\n{"passed": true, "score": 0.9, "reasons": ["clear prose"]}\n```'
    )
    assert result.passed is True
    assert result.score == 0.9
    assert result.reasons == ["clear prose"]


def test_parse_prose_judge_response_invalid_json_fails() -> None:
    result = parse_prose_judge_response("not json")
    assert result.passed is False
    assert result.score == 0.0


def test_prose_judge_dry_run_all_cases_pass() -> None:
    cases_path = (
        Path(__file__).resolve().parents[1]
        / "property_agent/evals/judge/prose_cases.yaml"
    )
    defaults, cases = load_cases(cases_path)
    assert len(cases) >= 10
    results, summary = run_eval(cases_path=cases_path, filter_text=None, live=False)
    assert summary["failed"] == 0
    assert summary["pass_rate"] == 1.0
    assert all(r.expected_passed is not None for r in results)


def test_prose_judge_filter() -> None:
    cases_path = (
        Path(__file__).resolve().parents[1]
        / "property_agent/evals/judge/prose_cases.yaml"
    )
    results, summary = run_eval(cases_path=cases_path, filter_text="greeting", live=False)
    assert summary["total"] == 1
    assert results[0].case_id == "greeting_markdown_only"


def test_live_case_passes_when_judge_rejects_negative_sample() -> None:
    case = {
        "id": "embedded_json_fence_fail",
        "user_query": "summarize",
        "content_markdown": "```json\n{}\n```",
        "expect": {"passed": False},
    }

    def fake_generate(_prompt: str) -> str:
        return '{"passed": false, "score": 0.0, "reasons": ["embedded json"]}'

    from property_agent.evals.judge.run_prose_judge_eval import run_case_live

    result = run_case_live(
        case,
        defaults={"expect": {"min_score": 0.7}},
        rubric_text="Reject embedded JSON.",
        generate_text=fake_generate,
    )
    assert result.passed is True
    assert result.judge is not None
    assert result.judge["passed"] is False
