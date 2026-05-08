"""
Checkpoint Analysis Agent

Orchestrates coverage, DIY, service, and cost agents to provide comprehensive
recommendations based on checkpoint data analysis.
"""

import logging
from typing import Optional, List, Dict
from google.adk.agents import Agent, ParallelAgent, SequentialAgent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from ..coverage_agent.agent import coverage_agent
from ..diy_agent.agent import diy_agent
from ..service_agent.agent import service_agent
from ..cost_agent.agent import cost_agent
from ...agent_inputs import CheckpointOptionalAgent

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


def before_tool_callback(tool_context: ToolContext, **kwargs):
    """Ensure user_id is set in tool context state."""
    if hasattr(tool_context, '_invocation_context') and hasattr(tool_context._invocation_context, 'session'):
        tool_context.state["user_id"] = tool_context._invocation_context.session.user_id


coverage_parallel_agent = Agent(
    name="checkpoint_coverage_parallel_agent",
    model="gemini-2.5-flash",
    description="Runs coverage analysis branch for checkpoint recommendations.",
    instruction="""
You are the checkpoint coverage branch.

If "coverage" is NOT present in checkpoint_optional_agents, return exactly: SKIPPED.

If "coverage" is present:
- Call coverage_agent exactly once.
- Use checkpoint_results to construct the issue context.
- Pass through context_doc_uris and property_address when available.
- Return only the coverage_agent result text.
""",
    tools=[AgentTool(coverage_agent)],
    input_schema=CheckpointAnalysisInput,
    output_key="checkpoint_parallel_coverage_result",
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback,
)

diy_parallel_agent = Agent(
    name="checkpoint_diy_parallel_agent",
    model="gemini-2.5-flash",
    description="Runs DIY analysis branch for checkpoint recommendations.",
    instruction="""
You are the checkpoint DIY branch.

If "diy" is NOT present in checkpoint_optional_agents, return exactly: SKIPPED.

If "diy" is present:
- Call diy_agent exactly once.
- Use checkpoint_results to construct the issue context.
- Pass through context_doc_uris and property_address when available.
- Return only the diy_agent result text.
""",
    tools=[AgentTool(diy_agent)],
    input_schema=CheckpointAnalysisInput,
    output_key="checkpoint_parallel_diy_result",
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback,
)

service_parallel_agent = Agent(
    name="checkpoint_service_parallel_agent",
    model="gemini-2.5-flash",
    description="Runs service analysis branch for checkpoint recommendations.",
    instruction="""
You are the checkpoint service branch.

If "service" is NOT present in checkpoint_optional_agents, return exactly: SKIPPED.

If "service" is present:
- Call service_agent exactly once.
- Use checkpoint_results to construct the issue context.
- Pass through property_address, location_coordinates, and location_radius when available.
- Return only the service_agent result text.
""",
    tools=[AgentTool(service_agent)],
    input_schema=CheckpointAnalysisInput,
    output_key="checkpoint_parallel_service_result",
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback,
)

cost_parallel_agent = Agent(
    name="checkpoint_cost_parallel_agent",
    model="gemini-2.5-flash",
    description="Runs cost analysis branch for checkpoint recommendations.",
    instruction="""
You are the checkpoint cost branch.

If "cost" is NOT present in checkpoint_optional_agents, return exactly: SKIPPED.

If "cost" is present:
- Call cost_agent exactly once.
- Use checkpoint_results to construct the issue context.
- Pass through context_doc_uris and property_address when available.
- Return only the cost_agent result text.
""",
    tools=[AgentTool(cost_agent)],
    input_schema=CheckpointAnalysisInput,
    output_key="checkpoint_parallel_cost_result",
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback,
)

parallel_optional_agents = ParallelAgent(
    name="checkpoint_optional_agents_parallel_runner",
    description="Runs checkpoint optional agent branches in parallel.",
    sub_agents=[
        coverage_parallel_agent,
        diy_parallel_agent,
        service_parallel_agent,
        cost_parallel_agent,
    ],
)

synthesis_agent = Agent(
    name="checkpoint_analysis_synthesis_agent",
    model="gemini-2.5-flash",
    description="Synthesizes parallel checkpoint analysis results into final dual-format output.",
    instruction="""
You are the final checkpoint analysis synthesizer.

Inputs:
- checkpoint_results
- user_query
- checkpoint_optional_agents
- checkpoint_parallel_coverage_result
- checkpoint_parallel_diy_result
- checkpoint_parallel_service_result
- checkpoint_parallel_cost_result

Your task:
1) Summarize checkpoint findings from checkpoint_results.
2) Build final output in strict dual format:
   - Markdown first (start with # Title)
   - Then a ```json code block with an "analysis" object
3) Include sections only for requested optional agents.
4) Ignore branch values that are SKIPPED.
5) Never mention internal branch/tool execution details.

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
    "yelpAPIResults": <array>,
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
    name="checkpoint_analysis_workflow",
    description="Runs optional checkpoint agents in parallel then synthesizes one stable response.",
    sub_agents=[parallel_optional_agents, synthesis_agent],
)

checkpoint_analysis_agent = Agent(
    name="checkpoint_analysis_agent",
    model="gemini-2.5-flash",
    description="Checkpoint analysis tool entrypoint that delegates to the parallel workflow.",
    instruction="""
You are the checkpoint analysis tool entrypoint.

You must delegate to sub-agent `checkpoint_analysis_workflow` and return that response exactly.
Do not add preamble or post-processing.
""",
    input_schema=CheckpointAnalysisInput,
    sub_agents=[checkpoint_analysis_workflow],
    disallow_transfer_to_parent=True,
)

__all__ = ["checkpoint_analysis_agent", "CheckpointAnalysisInput"]
