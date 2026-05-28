"""
Checkpoint Analysis Agent

Orchestrates coverage, DIY, service, and cost agents to provide comprehensive
recommendations based on checkpoint data analysis.
"""

from __future__ import annotations

from dotenv import load_dotenv
from google.adk.agents.context import Context
from property_agent.agents.cost_agent.agent import _cost_estimation_sync  # noqa: F401
from .checkpoint_parse import (
    normalize_checkpoint_analysis_tool_args,
    parse_checkpoint_analysis_payload,
)
from .parallel_runner import (
    CheckpointOptionalParallelAgent,
    _invoke_optional_agent_async,
    _run_checkpoint_cost_pipeline,
    _run_checkpoint_diy_pipeline,
    _run_single_optional_agent_async,
    execute_checkpoint_optional_parallel,
    run_checkpoint_optional_agents_parallel,
)
from .search_query import CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY
from .search_query import (
    optional_branch_search_user_query,
    resolve_branch_search_user_query,
    resolve_effective_search_query,
    resolve_optional_branch_user_query,
    resolve_service_branch_user_query,
)
from .synthesis_prompt import CHECKPOINT_SYNTHESIS_INSTRUCTION
from .input_schema import CheckpointAnalysisInput
from .checkpoint_parse import _parse_checkpoint_analysis_input
from .parallel_runner import _build_checkpoint_cost_query
from .workflow import (
    checkpoint_analysis_workflow,
    checkpoint_optional_parallel_agent,
)

load_dotenv()

# Exported entrypoint (workflow = parallel runner + synthesis).
checkpoint_analysis_agent = checkpoint_analysis_workflow

__all__ = [
    "Context",
    "_build_checkpoint_cost_query",
    "_cost_estimation_sync",
    "_invoke_optional_agent_async",
    "_parse_checkpoint_analysis_input",
    "_run_checkpoint_cost_pipeline",
    "_run_checkpoint_diy_pipeline",
    "_run_single_optional_agent_async",
    "checkpoint_analysis_agent",
    "CheckpointAnalysisInput",
    "CheckpointOptionalParallelAgent",
    "checkpoint_optional_parallel_agent",
    "execute_checkpoint_optional_parallel",
    "normalize_checkpoint_analysis_tool_args",
    "parse_checkpoint_analysis_payload",
    "run_checkpoint_optional_agents_parallel",
    "CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY",
    "CHECKPOINT_SYNTHESIS_INSTRUCTION",
    "optional_branch_search_user_query",
    "resolve_branch_search_user_query",
    "resolve_effective_search_query",
    "resolve_optional_branch_user_query",
    "resolve_service_branch_user_query",
]
