import os
import uuid
import base64
from google.cloud.storage.client import Client
from google.adk.agents import Agent 
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import ToolContext, google_search
from google.adk.tools.langchain_tool import LangchainTool
from langchain_community.tools import YouTubeSearchTool
from langchain_community.utilities import SerpAPIWrapper
from vertexai.preview import rag  
from dotenv import load_dotenv
from .prompts import (
    triage_agent_instructions, 
    coverage_agent_instructions,
    diy_agent_instructions,
    service_agent_instructions,
    analysis_agent_instructions,
    multimodal_parsing_prompt
)
import sys
import logging
from ..user_docs_agent.agent import ask_user_docs_retreival  
from ..cost_agent.agent import cost_agent, cost_estimation, cost_estimation_diy
from ...agent_inputs import DiagnosisInput, DocsInput
import requests
import json

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


## cost estimation moved to cost_agent; imported above

def product_recommendations_diy(query: str) -> str:
    """Provides product recommendations for DIY repairs only."""
    serpapi_api_key = os.environ.get("SERP_API_KEY")
    
    if not serpapi_api_key:
        return json.dumps({"recommendedProducts": {"message": "Product recommendations service not available (missing API key)."}})
    
    try:
        import serpapi
        
        # Search for DIY products only
        diy_query = f"{query} DIY repair products tools"
        diy_search = serpapi.GoogleSearch({
            "q": diy_query,
            "tbm": "shop",
            "api_key": serpapi_api_key,
            "num": 6,
            "gl": "us",
            "hl": "en"
        })
        
        diy_results = diy_search.get_dict()
        diy_products = diy_results.get("shopping_results", [])
        
        # Process products
        def process_products(products, max_results=5):
            processed = []
            for result in products[:max_results]:
                try:
                    title = result.get("title", "Unknown Product")
                    price = result.get("price", "Price not available")
                    link = result.get("link", "")
                    source = result.get("source", "Unknown Store")
                    rating = result.get("rating", "")
                    reviews = result.get("reviews", "")
                    image_url = result.get("thumbnail", "")
                    
                    product_data = {
                        "product_name": title,
                        "vendor": source if source != "Unknown Store" else None,
                        "url": link if link else None,
                        "item_price": price if price != "Price not available" else None,
                        "rating": rating if rating else None,
                        "reviews": reviews if reviews else None,
                        "image_url": image_url if image_url else None,
                    }
                    processed.append(product_data)
                except (KeyError, TypeError) as e:
                    logger.warning(f"Error processing product: {e}")
                    continue
            return processed
        
        diy_items = process_products(diy_products)
        
        response_data = {
            "recommendedProducts": {
                "DIY": {
                    "products": diy_items,
                    "description": "Essential products you'll need to fix this yourself"
                }
            }
        }
        return json.dumps(response_data)
    except Exception as e:
        logger.error(f"Error searching for product recommendations: {e}")
        return json.dumps({"recommendedProducts": {"error": f"Error retrieving product recommendations: {str(e)}"}})


# Create agents
triage_agent = Agent(
    model='gemini-2.5-flash',
    name='triage_agent',
    description="Analyzes multimodal data and extracts the problem description.",
    instruction=triage_agent_instructions(),
    tools=[analyse_multimodal_data],
    input_schema=DiagnosisInput
)

coverage_agent = Agent(
    model='gemini-2.5-flash',
    name='coverage_agent',
    description="Retrieves warranty and insurance coverage information from user documents.",
    instruction=coverage_agent_instructions(),
    tools=[ask_user_docs_retreival],
    input_schema=DocsInput
)

diy_agent = Agent(
    model='gemini-2.5-flash',
    name='diy_agent',
    description="Provides DIY repair recommendations, tutorials, and product suggestions.",
    instruction=diy_agent_instructions(),
    tools=[
        AgentTool(agent=google_search_agent),
        LangchainTool(tool=youtube_search, name="youtube_search", description="Searches YouTube for DIY tutorials."),
        product_recommendations_diy,
    ],
    input_schema=DocsInput
)

service_agent = Agent(
    model='gemini-2.5-flash',
    name='service_agent',
    description="Provides professional service recommendations, cost estimates, and service provider information.",
    instruction=service_agent_instructions(),
    tools=[
        LangchainTool(tool=serpapi_search, name="serpapi_search", description="Searches for local business listings and service providers."),
        yelpapi_search
    ],
    input_schema=DocsInput
)

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
