from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import google_search
from dotenv import load_dotenv
from .prompts import diy_agent_instructions
from ...agent_inputs import DocsInput
from ..cost_agent.agent import cost_estimation_diy
from ..shopping_agent.agent import shopping_agent
from youtube_search import YoutubeSearch
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)
load_dotenv()

# Google search agent for DIY searches
google_search_agent = Agent(
    name="google_search_agent",
    model="gemini-2.5-flash-lite",
    description="Agent to answer questions using Google Search.",
    instruction="I can answer your questions by searching the internet. Just ask me anything!",
    tools=[google_search],
)

def youtube_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Searches YouTube videos using plain text query input.
    Avoids the fragile comma-delimited parsing behavior of LangChain's YouTubeSearchTool.
    """
    if not query or not query.strip():
        return []

    # Clamp result size to a safe range.
    safe_max_results = max(1, min(int(max_results), 10))

    try:
        results = YoutubeSearch(query.strip(), max_results=safe_max_results).to_dict()
    except Exception:
        logger.exception("YouTube search failed for query: %s", query)
        return []

    normalized_results: List[Dict[str, Any]] = []
    for item in results:
        url_suffix = item.get("url_suffix", "") or ""
        normalized_results.append(
            {
                "title": item.get("title", ""),
                "url": f"https://www.youtube.com{url_suffix}" if url_suffix else "",
                "description": item.get("long_desc", "") or item.get("channel", ""),
                "duration": item.get("duration", ""),
            }
        )
    return normalized_results


diy_agent = Agent(
    model='gemini-2.5-flash',
    name='diy_agent',
    description="Provides DIY repair recommendations, tutorials, and product suggestions.",
    instruction=diy_agent_instructions(),
    tools=[
        AgentTool(agent=google_search_agent),
        youtube_search,
        AgentTool(agent=shopping_agent),
        cost_estimation_diy,
    ],
    input_schema=DocsInput
)

__all__ = ["diy_agent"]

