"""Thin guardrail: homecare tests delegate to agent-platform-core boundary checks."""

from __future__ import annotations

import importlib.util
from pathlib import Path


def _core_boundary_test_path() -> Path:
    homeapp = Path(__file__).resolve().parents[4]
    return (
        homeapp.parent
        / "agent-platform"
        / "packages"
        / "core"
        / "tests"
        / "test_boundaries.py"
    )


def test_agent_platform_core_boundary_test_module_exists() -> None:
    boundary_path = _core_boundary_test_path()
    assert boundary_path.is_file(), f"missing {boundary_path}"


def test_agent_platform_core_has_no_property_agent_or_adk_imports() -> None:
    boundary_path = _core_boundary_test_path()
    spec = importlib.util.spec_from_file_location(
        "agent_platform_core_test_boundaries",
        boundary_path,
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.test_core_does_not_import_property_agent_or_adk()
