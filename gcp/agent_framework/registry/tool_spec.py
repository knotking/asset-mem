"""Platform-facing tool registry contracts."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterable

from agent_framework.registry.orchestration import BranchToolSpec

ToolFactory = Callable[[], Any]


@dataclass(frozen=True)
class ToolSpec:
    """Declarative tool registry entry; ``id`` is the ADK tool name.

    Optional ``branches`` declares nested branch orchestration for composite
    tools (e.g. checkpoint optional agents). Consumers derive execution plans
    via ``agent_framework.registry.orchestration.build_execution_plan``.
    """

    id: str
    factory: ToolFactory
    branches: tuple[BranchToolSpec, ...] = ()


def _apply_spec_id(spec: ToolSpec, tool: Any) -> Any:
    """Expose registry ``spec.id`` as the ADK tool name when supported."""
    if not hasattr(tool, "name"):
        return tool
    try:
        tool.name = spec.id
    except (AttributeError, TypeError, ValueError):
        # Some tool wrappers may expose a read-only or frozen ``name``.
        pass
    return tool


def build_tools(specs: Iterable[ToolSpec]) -> list[Any]:
    """Instantiate concrete tools from a sequence of specs."""
    return [_apply_spec_id(spec, spec.factory()) for spec in specs]
