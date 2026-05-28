"""Validate ADK conformance spec.yaml files (no api_server required)."""

from __future__ import annotations

import json
from pathlib import Path

import yaml
from google.adk.cli.conformance._generated_file_utils import load_test_case

CONFORMANCE_ROOT = Path(__file__).resolve().parents[1] / "property_agent" / "conformance"
EVALS_RUBRIC = (
    Path(__file__).resolve().parents[1]
    / "property_agent"
    / "evals"
    / "rubrics"
    / "checkpoint_response.json"
)


def _load_expected_messages(case_dir: Path) -> dict:
    path = case_dir / "expected_messages.yaml"
    assert path.is_file(), f"Missing expected_messages.yaml in {case_dir}"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert isinstance(data, dict), f"{path}: root must be a mapping"
    turns = data.get("turns")
    assert isinstance(turns, list) and turns, f"{path}: turns must be a non-empty list"
    return data


def _assert_turn_expectation(turn: dict, *, case_dir: Path, turn_index: int) -> None:
    label = f"{case_dir.name} turn {turn_index + 1}"
    if turn.get("content_schema_version") is not None:
        assert turn["content_schema_version"] == 2, f"{label}: contentSchemaVersion must be 2"

    if turn.get("content_json_absent"):
        assert turn.get("content_json_present") is not True, f"{label}: conflicting json flags"
    if turn.get("content_json_present"):
        keys = turn.get("content_json_analysis_keys") or []
        assert isinstance(keys, list), f"{label}: content_json_analysis_keys must be a list"

    if turn.get("content_markdown_present") is False:
        raise AssertionError(f"{label}: content_markdown_present=false not supported in fixtures")


def test_conformance_specs_load() -> None:
    specs = list(CONFORMANCE_ROOT.rglob("spec.yaml"))
    assert specs, f"No spec.yaml under {CONFORMANCE_ROOT}"
    for spec_path in specs:
        test_spec = load_test_case(spec_path.parent)
        assert test_spec.agent == "property_agent"
        assert test_spec.user_messages


def test_conformance_expected_messages_align_with_user_turns() -> None:
    for spec_path in CONFORMANCE_ROOT.rglob("spec.yaml"):
        case_dir = spec_path.parent
        test_spec = load_test_case(case_dir)
        expected = _load_expected_messages(case_dir)
        turns = expected["turns"]
        assert len(turns) == len(test_spec.user_messages), (
            f"{case_dir}: expected_messages turns ({len(turns)}) "
            f"!= user_messages ({len(test_spec.user_messages)})"
        )
        for idx, turn in enumerate(turns):
            assert isinstance(turn, dict), f"{case_dir} turn {idx + 1}: must be a mapping"
            _assert_turn_expectation(turn, case_dir=case_dir, turn_index=idx)


def test_conformance_recordings_documented_when_missing() -> None:
    """Replay needs generated-recordings.yaml — recorded via make conformance-record."""
    spec_path = CONFORMANCE_ROOT / "routing" / "hello_plain_welcome" / "spec.yaml"
    case_dir = spec_path.parent
    recordings = case_dir / "generated-recordings.yaml"
    if recordings.is_file():
        assert recordings.stat().st_size > 0
    # Missing recordings is OK in CI; developers run conformance-record locally.


def test_checkpoint_response_rubric_targets_content_json() -> None:
    assert EVALS_RUBRIC.is_file(), f"Missing rubric {EVALS_RUBRIC}"
    rubric = json.loads(EVALS_RUBRIC.read_text(encoding="utf-8"))
    assert rubric.get("version") == 2
    criteria_ids = {c["id"] for c in rubric.get("criteria", [])}
    assert "content_json_analysis_shape" in criteria_ids
    assert "no_dual_format_fences" in criteria_ids
    text = EVALS_RUBRIC.read_text(encoding="utf-8")
    assert "dual-format" in text.lower() or "dual format" in text.lower()
    assert "contentJson.analysis" in text or "contentJson" in text
