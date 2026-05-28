"""Homecare tool bindings built on top of platform tool contracts."""

from __future__ import annotations

from typing import Callable

from google.adk.tools import FunctionTool
from google.adk.tools.preload_memory_tool import preload_memory_tool

from agent_framework.registry.tool_spec import ToolSpec, build_tools

from property_agent.checkpoint.branch_registry import CHECKPOINT_OPTIONAL_BRANCH_SPECS


def _checkpoint_pipeline_tool():
    from property_agent.checkpoint.pipeline import run_checkpoint_pipeline

    return FunctionTool(run_checkpoint_pipeline)


def _user_docs_tool():
    from google.adk.tools.agent_tool import AgentTool

    from property_agent.agents.user_docs_agent import user_docs_agent

    return AgentTool(user_docs_agent)


def _knowledge_base_tool():
    from google.adk.tools.agent_tool import AgentTool

    from property_agent.agents.knowledge_base_agent import knowledge_base_agent

    return AgentTool(knowledge_base_agent)


def _base_tool_specs() -> tuple[ToolSpec, ...]:
    return (
        ToolSpec(
            id="user_docs_retrieval",
            factory=_user_docs_tool,
        ),
        ToolSpec(
            id="knowledge_base_retrieval",
            factory=_knowledge_base_tool,
        ),
        ToolSpec(
            id="run_checkpoint_pipeline",
            factory=_checkpoint_pipeline_tool,
            branches=CHECKPOINT_OPTIONAL_BRANCH_SPECS,
        ),
    )


def build_executor_tools(memory_preload_enabled: Callable[[], bool]) -> list:
    tools = build_tools(_base_tool_specs())
    if memory_preload_enabled():
        tools.append(preload_memory_tool)
    return tools
