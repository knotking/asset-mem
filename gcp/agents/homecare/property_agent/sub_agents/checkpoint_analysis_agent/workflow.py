"""Checkpoint analysis workflow agents (parallel runner + synthesis)."""

from __future__ import annotations

from typing import Tuple

from google.adk.agents import Agent, SequentialAgent

from ...model_config import GLOBAL_GEMINI_MODEL
from ..checkpoint_dual_format_guard import synthesis_after_model_callback
from .input_schema import CheckpointAnalysisInput
from .parallel_runner import CheckpointOptionalParallelAgent
from .synthesis_prompt import CHECKPOINT_SYNTHESIS_INSTRUCTION


def _build_checkpoint_analysis_workflow(
    *,
    workflow_name: str,
    parallel_agent_name: str,
    synthesis_agent_name: str,
    workflow_description: str,
) -> Tuple[SequentialAgent, CheckpointOptionalParallelAgent, Agent]:
    """Build a fresh parallel+synthesis workflow (ADK forbids sharing sub-agents)."""
    parallel = CheckpointOptionalParallelAgent(
        name=parallel_agent_name,
        description="Runs requested optional checkpoint branches in parallel using Python orchestration.",
    )
    synthesis = Agent(
        name=synthesis_agent_name,
        model=GLOBAL_GEMINI_MODEL,
        description="Synthesizes parallel checkpoint analysis results into final dual-format output.",
        instruction=CHECKPOINT_SYNTHESIS_INSTRUCTION,
        input_schema=CheckpointAnalysisInput,
        after_model_callback=synthesis_after_model_callback,
    )
    workflow = SequentialAgent(
        name=workflow_name,
        description=workflow_description,
        sub_agents=[parallel, synthesis],
    )
    return workflow, parallel, synthesis


checkpoint_analysis_workflow, checkpoint_optional_parallel_agent, synthesis_agent = (
    _build_checkpoint_analysis_workflow(
        workflow_name="checkpoint_analysis_agent",
        parallel_agent_name="checkpoint_optional_agents_parallel_runner",
        synthesis_agent_name="checkpoint_analysis_synthesis_agent",
        workflow_description=(
            "Runs optional checkpoint agents in parallel then synthesizes one stable response."
        ),
    )
)

checkpoint_progress_agent, _, _ = _build_checkpoint_analysis_workflow(
    workflow_name="checkpoint_progress_agent",
    parallel_agent_name="checkpoint_progress_parallel_runner",
    synthesis_agent_name="checkpoint_progress_synthesis_agent",
    workflow_description=(
        "Runs optional checkpoint analysis with progressive updates; "
        "invoked after checkpoint_agent retrieval when optional branches are requested."
    ),
)
