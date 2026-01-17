import os
import uuid
import base64
from google.cloud.storage.client import Client
from google.adk.agents import Agent 
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext
from vertexai.preview import rag  
from dotenv import load_dotenv
from .prompts import (
    triage_agent_instructions, 
    analysis_agent_instructions,
    multimodal_parsing_prompt
)
import sys
import logging
from ..cost_agent.agent import cost_agent
from ..diy_agent.agent import diy_agent
from ..service_agent.agent import service_agent
from ..coverage_agent.agent import coverage_agent
from ...agent_inputs import DiagnosisInput, DocsInput

logger = logging.getLogger(__name__)
load_dotenv()

def before_tool_callback(tool_context: ToolContext, **kwargs):
    # Ensure the user_id is set in the tool context state
    tool_context.state["user_id"] = tool_context._invocation_context.session.user_id


def analyse_multimodal_data(user_query: str, gcs_url: str, tool_context: ToolContext) -> dict:
    """Analyzes multimodal data file.""" 
    try:
        # Use google.genai with Vertex AI API configuration
        from google import genai
        from google.genai import types
        import json as pyjson
        import mimetypes
        user_id = tool_context._invocation_context.session.user_id
        client = genai.Client(
            vertexai=True,
            project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
            location=os.environ.get("GOOGLE_CLOUD_LOCATION"),
            http_options=types.HttpOptions(api_version='v1')
        )
    
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_text(text=user_query),
                types.Part.from_uri(file_uri=gcs_url, mime_type=mimetypes.guess_type(gcs_url)[0])
            ],
            config=types.GenerateContentConfig(system_instruction=multimodal_parsing_prompt()),
        )
        try:
            raw_text = response.candidates[0].content.parts[0].text
            return raw_text 
        except Exception as e:
            logger.error(f"Unable to parse response: {e}")
            return "Unable to analyse media. Please retry again after sometime."
    except Exception as e:
        logger.error(f"Error parsing document type: {e}")
        return "Unable to analyse media. Please retry again after sometime."


# Create agents
triage_agent = Agent(
    model='gemini-2.5-flash',
    name='triage_agent',
    description="Analyzes multimodal data and extracts the problem description.",
    instruction=triage_agent_instructions(),
    tools=[analyse_multimodal_data],
    input_schema=DiagnosisInput
)

# Coverage agent is now imported from its own module

# Main analysis agent calls all agents as tools
analysis_agent = Agent(
    name='analysis_agent',
    model='gemini-2.5-flash',
    description="Orchestrates Triage, Coverage, DIY, and Service agents to provide comprehensive problem analysis.",
    instruction=analysis_agent_instructions(),
    tools=[
        AgentTool(triage_agent),
        AgentTool(coverage_agent),
        AgentTool(diy_agent),
        AgentTool(service_agent),
        AgentTool(cost_agent)
    ],
    input_schema=DiagnosisInput,
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback
)

__all__ = ["analysis_agent"]
