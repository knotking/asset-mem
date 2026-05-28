"""Versioned platform contracts (v1)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Protocol

from agent_framework.registry.tool_spec import ToolSpec

PLATFORM_CONTRACTS_VERSION = "v1"


@dataclass(frozen=True)
class ContextBudgets:
    system_and_rules_budget: int
    recent_turns_budget: int
    retrieved_memory_budget: int
    tool_output_budget: int


@dataclass(frozen=True)
class RetrievedSnippet:
    text: str
    source: str | None = None


@dataclass(frozen=True)
class HydratedContext:
    recent_turns: list[str]
    retrieved: list[RetrievedSnippet]
    compacted_summary: str | None


@dataclass(frozen=True)
class MessagePatchInputV1:
    content_markdown: str
    content_json: dict[str, Any] | None
    revision: int
    client_routing_hint: str | None
    agent_steps: list[dict[str, Any]]
    analysis_run_id: str | None = None


class ContextHydratorV1(Protocol):
    async def hydrate(
        self,
        *,
        query: str,
        recent_turns: list[str],
        budgets: ContextBudgets,
        top_k: int = 5,
    ) -> HydratedContext: ...


class ToolRegistryV1(Protocol):
    def specs(self) -> Iterable[ToolSpec]: ...


class MessagePatchWriterV1(Protocol):
    def write_patch(self, payload: MessagePatchInputV1) -> None: ...
