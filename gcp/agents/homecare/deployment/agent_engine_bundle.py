# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Stage local-only packages for Vertex AI Agent Engine ``extra_packages``."""

from __future__ import annotations

import io
import os
import pathlib
import shutil
import tarfile
import tempfile
import tomllib
from typing import Iterable, Sequence

# Distributions in pyproject.toml that must not be pip-installed on Agent Engine.
# Path-only packages are copied into the bundle via ``stage_extra_packages``.
AGENT_ENGINE_EXCLUDED_DISTS = frozenset(
    {
        "adk",
        "agent-platform-core",
        "agent-platform-adk",
        "tabulate",
        "tool",
        "tools",
        "tqdm",
    }
)

_BUNDLE_PACKAGE_SOURCES: dict[str, str] = {
    "property_agent": "property_agent",
}

_COPY_IGNORE = shutil.ignore_patterns(
    "__pycache__",
    "*.pyc",
    "*.pyo",
    ".adk",
    ".pytest_cache",
    "*.egg-info",
    ".venv",
    ".ruff_cache",
    "tests",
    "uv.lock",
    "README.md",
    "pyproject.toml",
)


def homecare_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parent.parent


def requirement_distribution_name(requirement: str) -> str:
    """Extract the distribution name from a PEP 508 requirement string."""
    name = requirement
    for sep in ("[", "=", ">", "<", "!", "~", ";", " "):
        name = name.split(sep, 1)[0]
    return name.strip()


def load_agent_engine_requirements(
    pyproject_path: pathlib.Path | None = None,
) -> list[str]:
    """Return ``project.dependencies`` minus local-only / bundled distributions."""
    path = pyproject_path or (homecare_root() / "pyproject.toml")
    with path.open("rb") as fh:
        pyproject = tomllib.load(fh)
    dependencies = pyproject.get("project", {}).get("dependencies", [])
    return [
        req
        for req in dependencies
        if requirement_distribution_name(req) not in AGENT_ENGINE_EXCLUDED_DISTS
    ]


def resolve_package_source(relative_path: str) -> pathlib.Path:
    source = (homecare_root() / relative_path).resolve()
    if not source.is_dir():
        raise FileNotFoundError(f"Agent Engine bundle source not found: {source}")
    return source


def agent_platform_root() -> pathlib.Path:
    """Resolve sibling ``agent-platform`` repo (or ``AGENT_PLATFORM_ROOT``)."""
    env = os.environ.get("AGENT_PLATFORM_ROOT", "").strip()
    if env:
        candidate = pathlib.Path(env).resolve()
        if (candidate / "packages" / "core").is_dir():
            return candidate
    root = homecare_root()
    for rel in ("../../../../agent-platform", "../../../agent-platform"):
        candidate = (root / rel).resolve()
        if (candidate / "packages" / "core").is_dir():
            return candidate
    raise FileNotFoundError(
        "agent-platform not found; set AGENT_PLATFORM_ROOT or clone beside HomeApp"
    )


def stage_agent_platform_namespace(staging_dir: pathlib.Path) -> pathlib.Path:
    """Copy ``agent_platform.core`` + ``agent_platform.adk`` into the bundle."""
    platform_root = agent_platform_root()
    destination = staging_dir / "agent_platform"
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    for pkg in ("core", "adk"):
        source = (
            platform_root / "packages" / pkg / "src" / "agent_platform" / pkg
        )
        if not source.is_dir():
            raise FileNotFoundError(f"Agent Engine bundle source not found: {source}")
        shutil.copytree(source, destination / pkg, ignore=_COPY_IGNORE)
    return destination


def stage_extra_packages(
    *,
    staging_root: pathlib.Path | None = None,
) -> tuple[pathlib.Path, list[str]]:
    """Copy bundled packages into a flat staging directory.

    Returns the staging root and absolute paths ready for ``extra_packages``.
    Each staged directory name matches the import root (``property_agent``,
    ``agent_platform``) so the dependency tarball can use flat arcnames.
    """
    staging_dir = staging_root or pathlib.Path(
        tempfile.mkdtemp(prefix="agent_engine_bundle_")
    )
    staged_paths: list[str] = []

    for package_name, relative_source in _BUNDLE_PACKAGE_SOURCES.items():
        source = resolve_package_source(relative_source)
        destination = staging_dir / package_name
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(source, destination, ignore=_COPY_IGNORE)
        staged_paths.append(str(destination))

    staged_paths.append(str(stage_agent_platform_namespace(staging_dir)))

    return staging_dir, staged_paths


def build_extra_packages_tar(extra_packages: Sequence[str]) -> bytes:
    """Build ``dependencies.tar.gz`` bytes with flat top-level package roots."""
    tar_fileobj = io.BytesIO()
    with tarfile.open(fileobj=tar_fileobj, mode="w:gz") as tar:
        for package_path in extra_packages:
            normalized = os.path.normpath(package_path)
            tar.add(normalized, arcname=os.path.basename(normalized))
    tar_fileobj.seek(0)
    return tar_fileobj.read()


def validate_extra_packages_tar(tar_bytes: bytes) -> None:
    """Fail fast when the tarball would break Agent Engine imports."""
    tar_fileobj = io.BytesIO(tar_bytes)
    with tarfile.open(fileobj=tar_fileobj, mode="r:gz") as tar:
        names = tar.getnames()

    if any(".." in name for name in names):
        bad = [name for name in names if ".." in name][:5]
        raise ValueError(
            "Agent Engine bundle tar contains path traversal entries: "
            + ", ".join(bad)
        )

    top_level = {name.split("/", 1)[0] for name in names if name}
    expected = set(_BUNDLE_PACKAGE_SOURCES) | {"agent_platform"}
    missing = expected - top_level
    if missing:
        raise ValueError(
            f"Agent Engine bundle tar missing top-level packages: {sorted(missing)}"
        )


def validate_agent_engine_requirements(requirements: Iterable[str]) -> None:
    """Ensure pip requirements do not reference path-only distributions."""
    leaked = [
        req
        for req in requirements
        if requirement_distribution_name(req) in AGENT_ENGINE_EXCLUDED_DISTS
    ]
    if leaked:
        raise ValueError(
            "Agent Engine requirements must not include bundled/local-only "
            f"distributions: {leaked}"
        )
