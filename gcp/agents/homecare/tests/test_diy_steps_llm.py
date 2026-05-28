"""Unit tests for DIY steps LLM helpers (no Vertex / network)."""

import json

from property_agent.agents.diy_agent.orchestrator import steps_llm as mod


def test_repair_json_text_closes_truncated_string() -> None:
    broken = (
        '{"hire_professional_recommended":false,"diySteps":{"summary":"Brief",'
        '"steps":[{"stepNumber":1,"description":"Sand surface'
    )
    repaired = mod._repair_json_text(broken)
    parsed = json.loads(repaired)
    assert isinstance(parsed["diySteps"]["steps"], list)


def test_load_steps_parsed_accepts_repaired_json() -> None:
    raw = (
        '{"hire_professional_recommended":false,"diySteps":'
        '{"summary":"Brief","steps":[{"stepNumber":1,"description":"Step one'
    )
    parsed = mod._load_steps_parsed(raw)
    assert parsed is not None
    assert parsed["diySteps"]["summary"]


def test_extract_numbered_steps_from_web() -> None:
    web = (
        "1. Clean the surface with mild detergent.\n"
        "2. Sand lightly and wipe dust.\n"
        "- Prime with exterior paint primer.\n"
        "https://example.com/video\n"
    )
    steps = mod._extract_numbered_steps_from_web(web)
    assert len(steps) == 3
    assert steps[0]["stepNumber"] == 1
    assert "Clean" in steps[0]["description"]


def test_web_excerpt_for_steps_truncates_long_text() -> None:
    long = "word " * 2000
    excerpt = mod._web_excerpt_for_steps(long)
    assert len(excerpt) <= mod._steps_web_excerpt_chars() + 4
    assert excerpt.endswith("…")
