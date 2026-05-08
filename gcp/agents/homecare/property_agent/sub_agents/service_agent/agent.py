import os
from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import google_search
from google.adk.tools.langchain_tool import LangchainTool
from langchain_community.utilities import SerpAPIWrapper
from dotenv import load_dotenv
from .prompts import service_agent_instructions
from ...agent_inputs import DocsInput
import logging

logger = logging.getLogger(__name__)
load_dotenv()

# Google search agent for service searches
google_search_agent = Agent(
    name="google_search_agent",
    model="gemini-2.5-flash-lite",
    description="Agent to answer questions using Google Search.",
    instruction="I can answer your questions by searching the internet. Just ask me anything!",
    tools=[google_search],
)

serpapi_search = SerpAPIWrapper(
    serpapi_api_key=os.environ.get("SERP_API_KEY"),
)

service_agent = Agent(
    model='gemini-2.5-flash',
    name='service_agent',
    description="Provides professional service recommendations, cost estimates, and service provider information.",
    instruction=service_agent_instructions(),
    tools=[
        LangchainTool(tool=serpapi_search, name="serpapi_search", description="Searches for local business listings and service providers."),
        AgentTool(agent=google_search_agent),
    ],
    input_schema=DocsInput
)

__all__ = ["service_agent"]

