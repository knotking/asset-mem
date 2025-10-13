import os
import uuid
import base64
from google.cloud.storage.client import Client
from google.adk.agents import Agent, SequentialAgent, ParallelAgent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext, google_search
from google.adk.tools.langchain_tool import LangchainTool
from langchain_community.tools import YouTubeSearchTool
from langchain_community.utilities import SerpAPIWrapper
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import diagnostic_agent_instructions, multimodal_parsing_prompt, research_agent_prompt, service_provider_agent_prompt
import sys
import logging
from ..user_docs_agent.agent import ask_user_docs_retreival
from ...agent_inputs import DiagnosisInput, DocsInput
import requests

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
        except Exception as e:
            logger.error(f"Error parsing document type: {e}")
            return "Unable to parse document"
        

google_search_agent = Agent(
    name="google_search_agent",
    model="gemini-2.5-flash-lite",
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

# New SerpAPI tool for business listings
serpapi_search = SerpAPIWrapper(
    serpapi_api_key=os.environ.get("SERP_API_KEY"), # Assuming SERP_API_KEY is in environment variables
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
        response.raise_for_status()  # Raise an exception for HTTP errors (4xx or 5xx)
        logger.info(f"Yelp query: {query} Response: {response.text}")
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Yelp API call failed: {e} for query {query}")
        return "No service providers found"

research_agent = Agent(
    model='gemini-2.5-flash',
    name='research_agent',
    description="Handles comprehensive research tasks for the diagnostics agent by gathering information from multiple sources.",
    instruction=research_agent_prompt(),
    tools=[
        AgentTool(agent=google_search_agent),
        ask_user_docs_retreival,
        LangchainTool(tool=youtube_search, name="youtube_search", description="Searches YouTube for videos related to the user query."),
    ],
    input_schema=DocsInput
)

service_provider_agent = Agent(
    model='gemini-2.5-flash',
    name='service_provider_agent',
    description="Find service providers or authorized service centers for an identified issue near to the user's location.",
    instruction=service_provider_agent_prompt(),
    tools=[
        LangchainTool(tool=serpapi_search, name="serpapi_search", description="Searches for local business listings and service providers."),
        yelpapi_search
    ],
)

diagnostic_agent = Agent(
    model='gemini-2.5-flash',
    name='diagnostic_agent',
    instruction=diagnostic_agent_instructions(),
    tools=[analyse_multimodal_data, AgentTool(research_agent), AgentTool(service_provider_agent)],
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback,
    input_schema=DiagnosisInput
)

__all__ = ["diagnostic_agent"]