"""Architecture guardrails: agent_framework must not import property_agent."""

from __future__ import annotations

import ast
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
AGENT_FRAMEWORK_ROOT = REPO_ROOT

_FORBIDDEN_PREFIXES = (
    "property_agent",
    "property_agent.business",
    "property_agent.plugins",
    "property_agent.routing",
    "property_agent.sub_agents",
)


def _iter_python_files(root: Path) -> list[Path]:
    return [
        p
        for p in root.rglob("*.py")
        if p.is_file() and "tests" not in p.parts
    ]


def _forbidden_imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if any(alias.name.startswith(prefix) for prefix in _FORBIDDEN_PREFIXES):
                    found.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if any(module.startswith(prefix) for prefix in _FORBIDDEN_PREFIXES):
                found.append(module)
    return found


def test_agent_framework_does_not_import_property_agent() -> None:
    violations: list[str] = []
    for py_file in _iter_python_files(AGENT_FRAMEWORK_ROOT):
        imports = _forbidden_imports(py_file)
        if imports:
            imports_str = ", ".join(sorted(set(imports)))
            violations.append(f"{py_file.relative_to(REPO_ROOT)} -> {imports_str}")

    assert not violations, (
        "agent_framework must not import property_agent or legacy homecare modules.\n"
        + "\n".join(violations)
    )
