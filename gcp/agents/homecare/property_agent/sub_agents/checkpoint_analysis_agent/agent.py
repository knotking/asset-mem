"""
Checkpoint Analysis Agent

Orchestrates coverage, DIY, service, and cost agents to provide comprehensive
recommendations based on checkpoint data analysis.
"""

import os
import logging
from typing import Optional, List, Dict
from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from .prompts import checkpoint_analysis_agent_instructions
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


# Create the checkpoint analysis orchestrator agent
checkpoint_analysis_agent = Agent(
    name='checkpoint_analysis_agent',
    model='gemini-2.5-flash',
    description="Orchestrates Coverage, DIY, Service, and Cost agents to provide comprehensive recommendations based on checkpoint analysis.",
    instruction=checkpoint_analysis_agent_instructions(),
    tools=[
        AgentTool(coverage_agent),
        AgentTool(diy_agent),
        AgentTool(service_agent),
        AgentTool(cost_agent)
    ],
    input_schema=CheckpointAnalysisInput,
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback
)

__all__ = ["checkpoint_analysis_agent", "CheckpointAnalysisInput"]
