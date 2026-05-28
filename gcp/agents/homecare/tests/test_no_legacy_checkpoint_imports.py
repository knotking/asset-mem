"""CI guard: forbid legacy dual-format and duplicate checkpoint agent imports."""

from __future__ import annotations

import ast
from pathlib import Path

_FORBIDDEN_SUBSTRINGS = (
    "checkpoint.dual_format",
    "dual_format_body",
    "build_progressive_checkpoint_dual_format",
    "ensure_dual_format_body",
    "legacy_dual_format",
    ".legacy_parse",
    "from .legacy_parse",
    "split_dual_format_to_fields",
    "dual_format_has_valid_analysis_json",
    "enrich_dual_format_markdown",
    "rebuild_dual_format_from_analysis",
    "extract_analysis_object_from_dual_format",
    "agents.checkpoint_agent",
    "agents.checkpoint_analysis_agent",
    "agents.checkpoint_dual_format",
    "from property_agent.sub_agents.checkpoint_agent",
    "import checkpoint_progress_agent",
    "property_analysis_store",
)

_ROOT = Path(__file__).resolve().parents[1] / "property_agent"

# Active docs that must not describe removed serving paths as current behavior.
_DOC_ROOT = Path(__file__).resolve().parents[1]
_ACTIVE_DOC_PATHS = (
    _DOC_ROOT / "property_agent/ARCHITECTURE.md",
    _DOC_ROOT / "property_agent/README.md",
    _DOC_ROOT / "README.md",
    _DOC_ROOT.parent.parent / "docs/ARCHITECTURE.md",
    _DOC_ROOT.parent.parent / "proxy/api/README.md",
    Path(__file__).resolve().parents[4] / "CLAUDE.md",
    Path(__file__).resolve().parents[4] / "docs/ARCHITECTURE_DIAGRAM.md",
)

_DOC_FORBIDDEN = (
    "doculink_agent",
    "transfer_to_agent(checkpoint_progress_agent",
    "Sub-agent: checkpoint_progress_agent",
    "checkpoint_analysis_dual_format",
    "property_analysis_store",
    "analysis/current` for chat",
    "usePropertyAnalysis",
)

_DOC_NEGATION_MARKERS = (
    "not a separate",
    "no separate",
    "not ... doculink",
    "no `doculink_agent`",
    "removed",
)

_DOC_ALLOWLINE_MARKERS = (
    "Pre–Orchestrator V2",
    "Pre-Orchestrator V2",
    "Removed from the serving path",
    "superseded",
    "Historical",
    "Do **not**",
    "not used for chat",
)


def _py_files() -> list[Path]:
    out: list[Path] = []
    for p in _ROOT.rglob("*.py"):
        if not p.is_file():
            continue
        out.append(p)
    return out


def _line_allowed_in_doc(line: str) -> bool:
    lower = line.lower()
    if any(marker.lower() in lower for marker in _DOC_ALLOWLINE_MARKERS):
        return True
    if any(marker.lower() in lower for marker in _DOC_NEGATION_MARKERS):
        return True
    # Explicit "removed / replaced by" table rows in canonical V2 doc are OK.
    if "| Removed |" in line or "| Replaced by |" in line:
        return True
    if "no `analysis/current`" in lower or "not `analysis/current`" in lower:
        return True
    return False


def test_no_forbidden_checkpoint_import_patterns() -> None:
    violations: list[str] = []
    for path in _py_files():
        text = path.read_text(encoding="utf-8")
        for needle in _FORBIDDEN_SUBSTRINGS:
            if needle in text:
                violations.append(f"{path.relative_to(_ROOT)}: contains {needle!r}")
    assert not violations, "Legacy checkpoint imports found:\n" + "\n".join(violations)


def test_python_ast_imports_no_dual_format_package() -> None:
    violations: list[str] = []
    for path in _py_files():
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                if "checkpoint.dual_format" in node.module:
                    violations.append(f"{path}: from {node.module}")
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if "checkpoint.dual_format" in alias.name:
                        violations.append(f"{path}: import {alias.name}")
    assert not violations, "\n".join(violations)


def test_active_docs_no_legacy_serving_path_descriptions() -> None:
    violations: list[str] = []
    for path in _ACTIVE_DOC_PATHS:
        if not path.is_file():
            continue
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if _line_allowed_in_doc(line):
                continue
            for needle in _DOC_FORBIDDEN:
                if needle in line:
                    violations.append(f"{path}:{lineno}: contains {needle!r}")
    assert not violations, "Legacy checkpoint docs found:\n" + "\n".join(violations)
