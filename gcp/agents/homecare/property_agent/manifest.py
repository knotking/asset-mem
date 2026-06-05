"""Property/homecare plugin registration surface."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class PropertyPlugin:
    """Bindings for the property vertical (homecare rules, tools, routing)."""

    build_executor_tools: Callable[[Callable[[], bool]], list]
    prepare_before_model_turn: Callable[..., Any]
    property_agent_executor_instructions: Callable[[], str]
    diagnosis_input_schema: type
    global_gemini_model: str
    memory_preload_enabled: Callable[[], bool]
    ingest_invocation_to_memory_bank: Callable[..., Any]
    property_agent_name: str
    prune_heavy_checkpoint_state: Callable[[Any], None]
    resolve_property_id: Callable[[Any], Any]


def load_property_plugin() -> PropertyPlugin:
    """Load the property plugin (lazy imports to avoid cycles)."""
    from property_agent.shared.inputs import DiagnosisInput
    from property_agent.memory_bank import (
        PROPERTY_AGENT_NAME,
        ingest_invocation_to_memory_bank,
        memory_preload_enabled,
        resolve_property_id,
    )
    from property_agent.model_config import GLOBAL_GEMINI_MODEL
    from property_agent.prompts import property_agent_executor_instructions
    from property_agent.registry import build_executor_tools
    from property_agent.routing.resolve_turn import prepare_before_model_turn
    from property_agent.runtime.session_diet import prune_heavy_checkpoint_state

    return PropertyPlugin(
        build_executor_tools=build_executor_tools,
        prepare_before_model_turn=prepare_before_model_turn,
        property_agent_executor_instructions=property_agent_executor_instructions,
        diagnosis_input_schema=DiagnosisInput,
        global_gemini_model=GLOBAL_GEMINI_MODEL.model,
        memory_preload_enabled=memory_preload_enabled,
        ingest_invocation_to_memory_bank=ingest_invocation_to_memory_bank,
        property_agent_name=PROPERTY_AGENT_NAME,
        prune_heavy_checkpoint_state=prune_heavy_checkpoint_state,
        resolve_property_id=resolve_property_id,
    )
