"""Versioned platform contracts (v1)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Protocol

from agent_framework.contracts.message_patch_types import MessagePatchInputV1
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
