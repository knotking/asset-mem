"""
Checkpoint Analysis Agent

Orchestrates coverage, DIY, service, and cost agents to provide comprehensive
recommendations based on checkpoint data analysis.
"""

import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, List, Dict, Any
from google.adk.agents import Agent, SequentialAgent
from google.adk.tools import ToolContext
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from ..coverage_agent.agent import coverage_agent
from ..diy_agent.agent import diy_agent
from ..service_agent.agent import service_agent
from ..cost_agent.agent import cost_agent
from ...agent_inputs import CheckpointOptionalAgent
from ...model_config import GLOBAL_GEMINI_MODEL

load_dotenv()

logger = logging.getLogger(__name__)


class CheckpointAnalysisInput(BaseModel):
    """Input schema for checkpoint analysis agent."""
    checkpoint_results: str = Field(description="The checkpoint retrieval results containing checkpoint data and analysis")
    user_query: str = Field(description="The original user query for context")
    checkpoint_optional_agents: List[CheckpointOptionalAgent] = Field(
        description="List of optional sub-agents to invoke: coverage, diy, service, cost"
    )
    context_doc_uris: Optional[List[str]] = Field(default=None, description="Context document URIs for coverage checks")
    property_address: Optional[str] = Field(default=None, description="Property address for location-based services")
    property_id: Optional[str] = Field(default=None, description="Property ID for reference")
    location_coordinates: Optional[Dict[str, float]] = Field(default=None, description="Location coordinates for service searches")
    location_radius: Optional[int] = Field(default=None, description="Search radius for local services")


def _normalize_agent_result(result: Any) -> str:
    if result is None:
        return "SKIPPED"
    if isinstance(result, str):
        return result
    try:
        return json.dumps(result, ensure_ascii=False)
    except Exception:
        return str(result)


def _run_single_optional_agent(
    agent_name: str,
    checkpoint_results: str,
    user_query: str,
    context_doc_uris: Optional[List[str]],
    property_address: Optional[str],
    property_id: Optional[str],
    location_coordinates: Optional[Dict[str, float]],
    location_radius: Optional[int],
) -> str:
    payload: Dict[str, Any] = {
        "user_query": f"{user_query}\n\nCheckpoint context:\n{checkpoint_results}",
        "checkpoint_results": checkpoint_results,
        "context_doc_uris": context_doc_uris,
        "property_address": property_address,
        "property_id": property_id,
        "location_coordinates": location_coordinates,
        "location_radius": location_radius,
    }
    if agent_name == "coverage":
        return _normalize_agent_result(_invoke_optional_agent(coverage_agent, payload))
    if agent_name == "diy":
        return _normalize_agent_result(_invoke_optional_agent(diy_agent, payload))
    if agent_name == "service":
        return _normalize_agent_result(_invoke_optional_agent(service_agent, payload))
    if agent_name == "cost":
        return _normalize_agent_result(_invoke_optional_agent(cost_agent, payload))
    return "SKIPPED"


def _invoke_optional_agent(agent: Agent, payload: Dict[str, Any]) -> Any:
    """Compatibility helper across ADK interfaces."""
    if hasattr(agent, "run"):
        return agent.run(payload)  # type: ignore[attr-defined]
    if hasattr(agent, "invoke"):
        return agent.invoke(payload)  # type: ignore[attr-defined]
    raise AttributeError(f"Agent {getattr(agent, 'name', '<unknown>')} has no run/invoke method")


def run_checkpoint_optional_agents_parallel(
    checkpoint_results: str,
    user_query: str,
    checkpoint_optional_agents: List[CheckpointOptionalAgent],
    context_doc_uris: Optional[List[str]] = None,
    property_address: Optional[str] = None,
    property_id: Optional[str] = None,
    location_coordinates: Optional[Dict[str, float]] = None,
    location_radius: Optional[int] = None,
    tool_context: ToolContext = None,
) -> str:
    """Run requested optional agents in parallel without extra branch-level LLM wrappers."""
    total_start = time.monotonic()
    if tool_context and hasattr(tool_context, "_invocation_context") and hasattr(tool_context._invocation_context, "session"):
        tool_context.state["user_id"] = tool_context._invocation_context.session.user_id

    requested = set(checkpoint_optional_agents or [])
    results: Dict[str, str] = {
        "checkpoint_parallel_coverage_result": "SKIPPED",
        "checkpoint_parallel_diy_result": "SKIPPED",
        "checkpoint_parallel_service_result": "SKIPPED",
        "checkpoint_parallel_cost_result": "SKIPPED",
    }
    branch_map = {
        "coverage": "checkpoint_parallel_coverage_result",
        "diy": "checkpoint_parallel_diy_result",
        "service": "checkpoint_parallel_service_result",
        "cost": "checkpoint_parallel_cost_result",
    }

    futures = {}
    branch_starts: Dict[str, float] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for name in requested:
            if name not in branch_map:
                continue
            branch_starts[name] = time.monotonic()
            futures[pool.submit(
                _run_single_optional_agent,
                name,
                checkpoint_results,
                user_query,
                context_doc_uris,
                property_address,
                property_id,
                location_coordinates,
                location_radius,
            )] = name

        for fut in as_completed(futures):
            name = futures[fut]
            key = branch_map[name]
            try:
                results[key] = fut.result()
            except Exception:
                logger.exception("checkpoint optional branch failed: %s", name)
                results[key] = "SKIPPED"
            finally:
                started = branch_starts.get(name)
                if started is not None:
                    logger.info(
                        "checkpoint optional branch timing: branch=%s duration_ms=%d",
                        name,
                        int((time.monotonic() - started) * 1000),
                    )

    logger.info(
        "checkpoint optional runner timing: requested=%s total_duration_ms=%d",
        sorted(requested),
        int((time.monotonic() - total_start) * 1000),
    )
    return json.dumps(results, ensure_ascii=False)


parallel_optional_runner_agent = Agent(
    name="checkpoint_optional_agents_parallel_runner",
    model=GLOBAL_GEMINI_MODEL,
    description="Runs requested optional checkpoint branches in parallel using Python orchestration.",
    instruction="""
Call run_checkpoint_optional_agents_parallel exactly once with the full input payload.
Return only the tool output without additional narration.
""",
    tools=[run_checkpoint_optional_agents_parallel],
    input_schema=CheckpointAnalysisInput,
    output_key="checkpoint_parallel_results",
    disallow_transfer_to_parent=True,
)

synthesis_agent = Agent(
    name="checkpoint_analysis_synthesis_agent",
    model=os.getenv("CHECKPOINT_SYNTHESIS_MODEL", GLOBAL_GEMINI_MODEL.model),
    description="Synthesizes parallel checkpoint analysis results into final dual-format output.",
    instruction="""
You are the final checkpoint analysis synthesizer.

Inputs:
- checkpoint_results
- user_query
- checkpoint_optional_agents
- checkpoint_parallel_results (JSON string with keys:
  checkpoint_parallel_coverage_result, checkpoint_parallel_diy_result,
  checkpoint_parallel_service_result, checkpoint_parallel_cost_result)

Your task:
1) Summarize checkpoint findings from checkpoint_results.
2) Parse checkpoint_parallel_results JSON once; treat missing/invalid values as SKIPPED.
3) Build strict dual format output:
   - Markdown first (start with # Title)
   - Then a ```json code block with an "analysis" object
4) Include sections only for requested optional agents.
5) Ignore branch values that are SKIPPED.
6) Never mention internal branch/tool execution details.

The JSON must include:
- analysis.title
- analysis.checkpointSummary (always, OBJECT type)
- analysis.coverageResult only if coverage requested and result exists
- analysis.diyResults only if diy requested and result exists
- analysis.serviceResults only if service requested and result exists
- analysis.costEstimationResults only if cost requested and result exists

CRITICAL SCHEMA CONTRACT FOR WEBAPP/MAPP:
- Return BOTH:
  1) Markdown text first
  2) A ```json block second
- The JSON root must be:
  {
    "analysis": { ... }
  }
- NEVER return strings for structured sections.
- NEVER set analysis.checkpointSummary to a string.
- NEVER set analysis.serviceResults to a string.
- NEVER set analysis.diyResults to a string.
- NEVER set analysis.coverageResult to a string.
- NEVER set analysis.costEstimationResults to a string.

DIY branch merge rule (checkpoint_parallel_diy_result):
- The DIY tool may return JSON shaped as { "hire_professional_recommended": <boolean>, "diyResults": { ... } }.
- Always set analysis.diyResults to the INNER "diyResults" object only (must contain diySteps, youtubeSearch, recommendedProducts as today).
- You may copy hire_professional_recommended into analysis.diyResults as optional boolean "hireProfessionalRecommended" for clients; omit if false.
- Preserve diyCostEstimates inside analysis.diyResults when present (optional object).

Required checkpointSummary shape (always present, object):
{
  "checkpointsAnalyzed": <number>,
  "issuesDetected": <string[]>,
  "overallCondition": <string>,
  "locations": <string[]>,
  "queryType": <"single" | "comparison" | "trend" | "location-specific"> (optional),
  "dateRange": <string> (optional)
}

If an optional section is requested but data is sparse, return an object with empty/default nested fields instead of a string.

Expected optional section shapes:

coverageResult (object):
{
  "warrantyInfo": <string>,
  "insuranceInfo": <string>
}

diyResults (object):
{
  "diySteps": {
    "summary": <string>,
    "steps": [{"stepNumber": <number>, "description": <string>}]
  },
  "youtubeSearch": {
    "videos": [{"title": <string>, "url": <string>, "description": <string>}]
  },
  "recommendedProducts": {
    "products": [{"item_name": <string>, "vendor": <string>, "url": <string>, "price": <string>}]
  }
}

serviceResults (object):
{
  "localPros": {
    "serpAPIResults": <array>,
    "googleSearchResults": <array>
  }
}

costEstimationResults (object):
{
  "costEstimates": {
    "repair_type": <string>,
    "DIY": {
      "cost_range": <string>,
      "includes": <string[]>,
      "savings": <string>,
      "complexity": <string>
    },
    "Service": {
      "cost_range": <string>,
      "includes": <string[]>,
      "benefits": <string>,
      "complexity": <string>
    },
    "comparison": {
      "diy_savings": <string>,
      "professional_benefits": <string>,
      "considerations": <string>
    }
  }
}

Final validation before returning:
1) `analysis` exists and is an object.
2) `analysis.title` is a non-empty string.
3) `analysis.checkpointSummary` is an object (not string) with:
   - checkpointsAnalyzed (number)
   - issuesDetected (array)
   - overallCondition (string)
   - locations (array)
4) Any included optional section is an object, never string.
5) JSON is valid and parseable.
""",
    input_schema=CheckpointAnalysisInput,
)

checkpoint_analysis_workflow = SequentialAgent(
    name="checkpoint_analysis_agent",
    description="Runs optional checkpoint agents in parallel then synthesizes one stable response.",
    sub_agents=[parallel_optional_runner_agent, synthesis_agent],
)

# Use the workflow directly as the exported entrypoint to remove one extra
# LLM delegation hop from the checkpoint-analysis path.
checkpoint_analysis_agent = checkpoint_analysis_workflow

__all__ = ["checkpoint_analysis_agent", "CheckpointAnalysisInput"]
