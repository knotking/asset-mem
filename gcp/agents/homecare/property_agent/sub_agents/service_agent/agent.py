import os
import requests
from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext, google_search
from google.adk.tools.langchain_tool import LangchainTool
from langchain_community.utilities import SerpAPIWrapper
from dotenv import load_dotenv
from .prompts import service_agent_instructions
from ...agent_inputs import DocsInput
from ..cost_agent.agent import cost_estimation
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

def yelpapi_search(query: str) -> str:
    yelp_api_key=os.environ.get("YELP_API_KEY")
    yelp_url = os.environ.get("YELP_URL")
    headers = {
        "accept": "application/json",
        "Content-Type": "application/json", 
        "Authorization": f"Bearer {yelp_api_key}"
    }
    data: dict[str, any] = {
        "query": query,
    }
    try:
        response = requests.post(url=yelp_url, json=data, headers=headers)
        response.raise_for_status()
        logger.info(f"Yelp query: {query} Response: {response.text}")
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Yelp API call failed: {e} for query {query}")
        return "No service providers found"


service_agent = Agent(
    model='gemini-3-flash-preview',
    name='service_agent',
    description="Provides professional service recommendations, cost estimates, and service provider information.",
    instruction=service_agent_instructions(),
    tools=[
        LangchainTool(tool=serpapi_search, name="serpapi_search", description="Searches for local business listings and service providers."),
        yelpapi_search,
        AgentTool(agent=google_search_agent),
        cost_estimation,
    ],
    input_schema=DocsInput
)

__all__ = ["service_agent"]

