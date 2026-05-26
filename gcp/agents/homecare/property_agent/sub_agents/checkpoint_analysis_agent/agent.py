"""
Checkpoint Analysis Agent

Orchestrates coverage, DIY, service, and cost agents to provide comprehensive
recommendations based on checkpoint data analysis.
"""

from __future__ import annotations

import sys

from dotenv import load_dotenv
from ..cost_agent.agent import _cost_estimation_sync  # noqa: F401
from .legacy_parse import (
    normalize_checkpoint_analysis_tool_args,
    parse_checkpoint_analysis_payload,
    parse_inline_checkpoint_analysis_request,
    parse_legacy_checkpoint_analysis_prose,
)
from .parallel_runner import (
    CheckpointOptionalParallelAgent,
    execute_checkpoint_optional_parallel,
    run_checkpoint_optional_agents_parallel,
)
from .search_query import CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY
from .search_query import (
    optional_branch_search_user_query,
    resolve_branch_search_user_query,
    resolve_effective_search_query,
)
from .synthesis_prompt import CHECKPOINT_SYNTHESIS_INSTRUCTION
from . import legacy_parse as _legacy_parse
from . import parallel_runner as _parallel_runner
from . import search_query as _search_query
from . import synthesis_prompt as _synthesis_prompt
from . import workflow as _workflow
from .input_schema import CheckpointAnalysisInput
from .workflow import (
    checkpoint_analysis_workflow,
    checkpoint_optional_parallel_agent,
    checkpoint_progress_agent,
)

load_dotenv()

# Exported entrypoint (workflow = parallel runner + synthesis).
checkpoint_analysis_agent = checkpoint_analysis_workflow

# Re-export submodule namespace (tests and callers use `agent._parse_*`, etc.).
_mod = sys.modules[__name__]
for _src in (
    _legacy_parse,
    _parallel_runner,
    _search_query,
    _synthesis_prompt,
    _workflow,
):
    for _name in dir(_src):
        if _name.startswith("__"):
            continue
        setattr(_mod, _name, getattr(_src, _name))

__all__ = [
    "checkpoint_analysis_agent",
    "checkpoint_progress_agent",
    "CheckpointAnalysisInput",
    "CheckpointOptionalParallelAgent",
    "checkpoint_optional_parallel_agent",
    "execute_checkpoint_optional_parallel",
    "normalize_checkpoint_analysis_tool_args",
    "parse_checkpoint_analysis_payload",
    "parse_inline_checkpoint_analysis_request",
    "parse_legacy_checkpoint_analysis_prose",
    "run_checkpoint_optional_agents_parallel",
    "CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY",
    "CHECKPOINT_SYNTHESIS_INSTRUCTION",
    "optional_branch_search_user_query",
    "resolve_branch_search_user_query",
    "resolve_effective_search_query",
]
