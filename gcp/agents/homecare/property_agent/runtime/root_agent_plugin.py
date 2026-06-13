"""Property plugin adapter for ``agent_platform.adk.build_root_agent``."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional

from dotenv import load_dotenv
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import BaseTool, ToolContext

from agent_platform.adk.bridge import turn_outcome_to_llm_response
from agent_platform.adk.build_root_agent import RootAgentPlugin, build_root_agent
from agent_platform.adk.context_bridge import (
    tool_call_context_from_adk,
    turn_context_from_adk_callback,
)
from agent_platform.adk.hook_registry import (
    build_adk_after_tool_callback,
    build_adk_before_tool_callback,
)
from agent_platform.core.observability.logging_context import (
    install_auth_uid_logging,
    suppress_otel_context_detach_noise,
)
from agent_platform.core.runtime.logging_plugin import LoggingRootAgentPlugin
from property_agent.manifest import PropertyPlugin, load_property_plugin
from property_agent.observability.lifecycle_events import (
    PHASE_ENGINE_BEFORE_MODEL,
    emit_lifecycle_from_callback,
)
from property_agent.observability.turn_request_timing import mark
from property_agent.runtime.hook_registry import PropertyHookRegistry

load_dotenv()
install_auth_uid_logging(level=logging.INFO)
suppress_otel_context_detach_noise()

logger = logging.getLogger(__name__)


@dataclass
class PropertyRootAgentPlugin(LoggingRootAgentPlugin):
    """ADK root-agent façade over ``PropertyHookRegistry`` + logging shell."""

    plugin: PropertyPlugin
    root_agent_name: str = "property_agent"
    root_agent_description: str = "Agent that manages and executes homecare-related tasks."
    hooks: PropertyHookRegistry = field(init=False)

    def __post_init__(self) -> None:
        self.hooks = PropertyHookRegistry(plugin=self.plugin)

    @property
    def global_gemini_model(self) -> Any:
        return self.plugin.global_gemini_model

    @property
    def executor_instructions(self) -> Callable[[], str]:
        return self.plugin.property_agent_executor_instructions

    @property
    def executor_input_schema(self) -> type:
        return self.plugin.diagnosis_input_schema

    @property
    def build_executor_tools(self) -> Callable[[Callable[[], bool]], list]:
        return self.plugin.build_executor_tools

    @property
    def memory_preload_enabled(self) -> Callable[[], bool]:
        return self.plugin.memory_preload_enabled

    def before_model_callback(
        self, callback_context: Any, llm_request: LlmRequest
    ) -> Optional[LlmResponse]:
        self.bind_request_context(callback_context)
        logger.debug(
            "ADK before_model agent_name=%s invocation_id=%s",
            getattr(callback_context, "agent_name", None),
            getattr(callback_context, "invocation_id", None),
        )
        mark("before_model_start")
        emit_lifecycle_from_callback(
            callback_context,
            phase=PHASE_ENGINE_BEFORE_MODEL,
            state_key="_lifecycle_emitted_engine.before_model",
        )
        try:
            turn_ctx = turn_context_from_adk_callback(callback_context)
            outcome = self.hooks.before_turn(turn_ctx, llm_request=llm_request)
            if outcome is not None:
                return turn_outcome_to_llm_response(outcome)
            return None
        finally:
            mark("before_model_end")

    def after_model_callback(
        self, callback_context: CallbackContext, llm_response: LlmResponse
    ) -> Optional[LlmResponse]:
        self.unbind_request_context()
        self.hooks.after_model(callback_context)
        return None

    def after_tool_callback(
        self,
        tool: BaseTool,
        args: Dict[str, Any],
        tool_context: ToolContext,
        tool_response: dict,
    ) -> Optional[dict]:
        self.unbind_request_context()
        build_adk_after_tool_callback(self.hooks)(tool, args, tool_context, tool_response)
        return None

    async def after_agent_callback(self, callback_context: CallbackContext) -> None:
        turn_ctx = turn_context_from_adk_callback(callback_context)
        self.hooks.after_turn(turn_ctx)
        await self.hooks.ingest_turn_memory(callback_context)

    def before_tool_callback(
        self,
        tool: BaseTool,
        args: Dict[str, Any],
        tool_context: ToolContext,
        **kwargs: Any,
    ) -> Optional[dict]:
        _ = kwargs
        return build_adk_before_tool_callback(self.hooks)(tool, args, tool_context)


def build_property_root_agent(plugin: PropertyPlugin | None = None):
    if plugin is None:
        plugin = load_property_plugin()
    adapter: RootAgentPlugin = PropertyRootAgentPlugin(plugin=plugin)
    return build_root_agent(adapter)
