"""Homecare tool bindings built on top of platform tool contracts."""

from __future__ import annotations

from typing import Callable

from google.adk.tools import FunctionTool
from google.adk.tools.preload_memory_tool import preload_memory_tool

from agent_platform.core.registry.tool_spec import ToolSpec, build_tools

from property_agent.checkpoint.branch_registry import CHECKPOINT_OPTIONAL_BRANCH_SPECS
from property_agent.checkpoint.constants import (
    CHECKPOINT_ANALYSIS_TOOL,
    CHECKPOINT_LIST_TOOL,
)


def _list_checkpoints_tool():
    from property_agent.checkpoint.executor_tools import list_checkpoints

    return FunctionTool(list_checkpoints)


def _analyze_checkpoints_tool():
    from property_agent.checkpoint.executor_tools import analyze_checkpoints

    return FunctionTool(analyze_checkpoints)


def _user_docs_tool():
    from google.adk.tools.agent_tool import AgentTool

    from property_agent.agents.user_docs_agent import user_docs_agent

    return AgentTool(user_docs_agent)


def _report_retrieval_tool():
    from property_agent.reports.retrieval import report_retrieval

    return FunctionTool(report_retrieval)


def _base_tool_specs() -> tuple[ToolSpec, ...]:
    return (
        ToolSpec(
            id="user_docs_retrieval",
            factory=_user_docs_tool,
        ),
        ToolSpec(
            id="report_retrieval",
            factory=_report_retrieval_tool,
        ),
        ToolSpec(
            id=CHECKPOINT_LIST_TOOL,
            factory=_list_checkpoints_tool,
        ),
        ToolSpec(
            id=CHECKPOINT_ANALYSIS_TOOL,
            factory=_analyze_checkpoints_tool,
            branches=CHECKPOINT_OPTIONAL_BRANCH_SPECS,
        ),
    )


def build_executor_tools(memory_preload_enabled: Callable[[], bool]) -> list:
    tools = build_tools(_base_tool_specs())
    if memory_preload_enabled():
        tools.append(preload_memory_tool)
    return tools
