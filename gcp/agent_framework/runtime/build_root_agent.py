"""Generic ADK root-agent builder (plugin supplies hooks via protocol)."""

from __future__ import annotations

from typing import Any, Callable, Protocol

from google.adk.agents import Agent


class RootAgentPlugin(Protocol):
    """Hooks required to construct a root ADK executor."""

    root_agent_name: str
    root_agent_description: str
    global_gemini_model: str
    executor_instructions: Callable[[], str]
    executor_input_schema: type
    build_executor_tools: Callable[[Callable[[], bool]], list]
    memory_preload_enabled: Callable[[], bool]
    before_model_callback: Callable[..., Any]
    before_tool_callback: Callable[..., Any]
    after_model_callback: Callable[..., Any]
    after_tool_callback: Callable[..., Any]
    after_agent_callback: Callable[..., Any]


def build_root_agent(plugin: RootAgentPlugin) -> Agent:
    """Construct an ADK root agent from a plugin's registered callbacks."""
    return Agent(
        model=plugin.global_gemini_model,
        name=plugin.root_agent_name,
        description=plugin.root_agent_description,
        instruction=plugin.executor_instructions(),
        input_schema=plugin.executor_input_schema,
        tools=plugin.build_executor_tools(plugin.memory_preload_enabled),
        before_model_callback=plugin.before_model_callback,
        before_tool_callback=plugin.before_tool_callback,
        after_model_callback=plugin.after_model_callback,
        after_tool_callback=plugin.after_tool_callback,
        after_agent_callback=plugin.after_agent_callback,
    )
