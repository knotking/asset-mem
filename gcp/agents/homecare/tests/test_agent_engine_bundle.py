"""Validate Agent Engine deploy bundle generation."""

from __future__ import annotations

import io
import os
import sys
import tarfile
import tempfile
from pathlib import Path

import pytest

from deployment.agent_engine_bundle import (
    AGENT_ENGINE_EXCLUDED_DISTS,
    build_extra_packages_tar,
    load_agent_engine_requirements,
    stage_extra_packages,
    validate_agent_engine_requirements,
    validate_extra_packages_tar,
)


def test_load_agent_engine_requirements_excludes_bundled_dists():
    requirements = load_agent_engine_requirements()
    validate_agent_engine_requirements(requirements)
    assert "agent-platform-core" in AGENT_ENGINE_EXCLUDED_DISTS
    assert "agent-platform-adk" in AGENT_ENGINE_EXCLUDED_DISTS
    assert all(
        "agent-platform-core" not in req and "agent-platform-adk" not in req
        for req in requirements
    )


def test_stage_extra_packages_tar_has_flat_import_roots():
    staging_dir, staged_paths = stage_extra_packages()
    try:
        assert len(staged_paths) == 2
        assert all(os.path.isdir(path) for path in staged_paths)
        assert (staging_dir / "property_agent" / "__init__.py").is_file()
        assert (staging_dir / "agent_platform" / "core").is_dir()
        assert (staging_dir / "agent_platform" / "adk").is_dir()

        tar_bytes = build_extra_packages_tar(staged_paths)
        validate_extra_packages_tar(tar_bytes)

        with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:gz") as tar:
            names = tar.getnames()
        top_level = {name.split("/", 1)[0] for name in names if name}
        assert top_level == {"property_agent", "agent_platform"}
        assert not any(".." in name for name in names)
    finally:
        import shutil

        shutil.rmtree(staging_dir, ignore_errors=True)


def test_extracted_bundle_imports_property_agent_without_repo_paths():
    staging_dir, staged_paths = stage_extra_packages()
    extract_dir = Path(tempfile.mkdtemp(prefix="agent_engine_extract_"))
    try:
        tar_bytes = build_extra_packages_tar(staged_paths)
        with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:gz") as tar:
            tar.extractall(extract_dir)

        import subprocess

        probe = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; "
                    f"sys.path.insert(0, {str(extract_dir)!r}); "
                    "import property_agent; "
                    "import agent_platform.core.execution.thread_context; "
                    "import agent_platform.adk.build_root_agent; "
                    "print(property_agent.__file__); "
                    "print(agent_platform.core.execution.thread_context.__file__)"
                ),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        lines = probe.stdout.strip().splitlines()
        assert str(extract_dir / "property_agent") in lines[0]
        assert str(extract_dir / "agent_platform") in lines[1]
    finally:
        import shutil

        shutil.rmtree(staging_dir, ignore_errors=True)
        shutil.rmtree(extract_dir, ignore_errors=True)


def test_validate_agent_engine_requirements_rejects_leaks():
    with pytest.raises(ValueError, match="agent-platform-core"):
        validate_agent_engine_requirements(
            ["google-adk==1.33.0", "agent-platform-core"]
        )
