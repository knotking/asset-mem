"""Ensure ``agent_platform`` namespace packages are importable for proxy local dev and staged deploy."""

from __future__ import annotations

import sys
from pathlib import Path


def ensure_agent_platform_on_path() -> None:
    """Add staged or sibling agent-platform source trees to ``sys.path``."""
    api_dir = Path(__file__).resolve().parent
    gcp_root = api_dir.parent.parent
    repo_root = gcp_root.parent

    for root in (api_dir, gcp_root):
        staged = root / "agent_platform"
        if (staged / "core" / "contracts").is_dir() and (staged / "gateway").is_dir():
            if str(root) not in sys.path:
                sys.path.insert(0, str(root))
            return

    platform_candidates = (
        repo_root / "agent-platform",
        repo_root.parent / "agent-platform",
    )
    for platform_root in platform_candidates:
        if not platform_root.is_dir():
            continue
        for pkg in ("core", "gateway"):
            src = platform_root / "packages" / pkg / "src"
            if src.is_dir() and str(src) not in sys.path:
                sys.path.insert(0, str(src))
        return
