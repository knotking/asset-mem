from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import google_search
from google.adk.tools.langchain_tool import LangchainTool
from langchain_community.tools import YouTubeSearchTool
from dotenv import load_dotenv
from .prompts import diy_agent_instructions
from ...agent_inputs import DocsInput
from ..cost_agent.agent import cost_estimation_diy
from ..shopping_agent.agent import shopping_agent
import logging

logger = logging.getLogger(__name__)
load_dotenv()

# Google search agent for DIY searches
google_search_agent = Agent(
    name="google_search_agent",
    model="gemini-3-flash-lite",
    description="Agent to answer questions using Google Search.",
    instruction="I can answer your questions by searching the internet. Just ask me anything!",
    tools=[google_search],
)

youtube_search = YouTubeSearchTool(
    name="youtube_search",
    description=(
        "Searches YouTube for videos related to the provided query.\n"
        "Output Format:\n"
        "- Title: Title of the video.\n"
        "- Video Link: Formatted as https://www.youtube.com/watch?v={video_id}."
    ),
    max_results=5,
)


diy_agent = Agent(
    model='gemini-3-flash',
    name='diy_agent',
    description="Provides DIY repair recommendations, tutorials, and product suggestions.",
    instruction=diy_agent_instructions(),
    tools=[
        AgentTool(agent=google_search_agent),
        LangchainTool(tool=youtube_search, name="youtube_search", description="Searches YouTube for DIY tutorials."),
        AgentTool(agent=shopping_agent),
        cost_estimation_diy,
    ],
    input_schema=DocsInput
)

__all__ = ["diy_agent"]

