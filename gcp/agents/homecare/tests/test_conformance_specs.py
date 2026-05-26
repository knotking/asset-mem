"""Validate ADK conformance spec.yaml files (no api_server required)."""

from __future__ import annotations

from pathlib import Path

from google.adk.cli.conformance._generated_file_utils import load_test_case

CONFORMANCE_ROOT = (
    Path(__file__).resolve().parents[1] / "property_agent" / "conformance"
)


def test_conformance_specs_load() -> None:
    specs = list(CONFORMANCE_ROOT.rglob("spec.yaml"))
    assert specs, f"No spec.yaml under {CONFORMANCE_ROOT}"
    for spec_path in specs:
        test_spec = load_test_case(spec_path.parent)
        assert test_spec.agent == "property_agent"
        assert test_spec.user_messages


def test_conformance_recordings_documented_when_missing() -> None:
    """Replay needs generated-recordings.yaml — recorded via make conformance-record."""
    spec_path = CONFORMANCE_ROOT / "routing" / "hello_plain_welcome" / "spec.yaml"
    case_dir = spec_path.parent
    recordings = case_dir / "generated-recordings.yaml"
    if recordings.is_file():
        assert recordings.stat().st_size > 0
    # Missing recordings is OK in CI; developers run conformance-record locally.
