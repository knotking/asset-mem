"""Proxy slim bundle: message_patch_types + message_patch_v1 must not import registry/runtime."""

from __future__ import annotations

import ast
from pathlib import Path

_CONTRACTS_ROOT = Path(__file__).resolve().parents[1] / "contracts"
_PROXY_SAFE = (
    "message_patch_types.py",
    "message_patch_v1.py",
)
_FORBIDDEN_PREFIXES = (
    "agent_framework.registry",
    "agent_framework.routing",
    "agent_framework.runtime",
    "agent_framework.execution",
    "agent_framework.memory",
    "agent_framework.observability",
)


def _imports_in(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                found.append(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            found.append(node.module)
    return found


def test_proxy_safe_contract_modules_have_no_heavy_framework_imports() -> None:
    violations: list[str] = []
    for name in _PROXY_SAFE:
        path = _CONTRACTS_ROOT / name
        for imp in _imports_in(path):
            if any(imp.startswith(p) for p in _FORBIDDEN_PREFIXES):
                violations.append(f"{name}: {imp}")
            if imp == "agent_framework.contracts.v1":
                violations.append(f"{name}: must not import v1 (pulls registry)")

    assert not violations, "Proxy-safe contracts must stay dependency-free.\n" + "\n".join(
        violations
    )
