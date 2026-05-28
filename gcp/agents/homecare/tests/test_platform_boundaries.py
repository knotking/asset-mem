"""Thin guardrail: homecare tests delegate to agent_framework boundary checks."""

from __future__ import annotations

import importlib.util
from pathlib import Path


def test_agent_framework_boundary_test_module_exists() -> None:
    boundary_path = (
        Path(__file__).resolve().parents[3] / "agent_framework" / "tests" / "test_boundaries.py"
    )
    assert boundary_path.is_file(), f"missing {boundary_path}"


def test_agent_framework_has_no_property_agent_imports() -> None:
    spec = importlib.util.spec_from_file_location(
        "agent_framework_test_boundaries",
        Path(__file__).resolve().parents[3] / "agent_framework" / "tests" / "test_boundaries.py",
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.test_agent_framework_does_not_import_property_agent()
