import asyncio
import logging
import os

from google.adk.agents import Agent
from google.adk.tools import google_search
from dotenv import load_dotenv
from langchain_community.utilities import SerpAPIWrapper
from .prompts import service_agent_instructions
from ...agent_inputs import DocsInput
from ...model_config import GLOBAL_GEMINI_MODEL

logger = logging.getLogger(__name__)
load_dotenv()

_serpapi_wrapper = SerpAPIWrapper(
    serpapi_api_key=os.environ.get("SERP_API_KEY"),
)


async def serpapi_search(query: str) -> str:
    """Searches for local business listings and service providers (worker thread; avoids blocking the event loop)."""
    return await asyncio.to_thread(_serpapi_wrapper.run, query)


service_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="service_agent",
    description="Provides professional service recommendations, cost estimates, and service provider information.",
    instruction=service_agent_instructions(),
    tools=[
        serpapi_search,
        google_search,
    ],
    input_schema=DocsInput,
)

# ADK AgentEvaluator expects ``root_agent`` on ``*.agent`` modules.
root_agent = service_agent

__all__ = ["service_agent", "root_agent"]
