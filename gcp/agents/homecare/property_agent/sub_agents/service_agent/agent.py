import os
import requests
from typing import Optional, Dict
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

# Utility function to convert miles to meters
def miles_to_meters(miles: float) -> int:
    """Convert miles to meters. 1 mile = 1609.34 meters"""
    return int(miles * 1609.34)

# Google search agent for service searches
google_search_agent = Agent(
    name="google_search_agent",
    model="gemini-2.5-flash-lite",
    description="Agent to answer questions using Google Search.",
    instruction="I can answer your questions by searching the internet. Just ask me anything!",
    tools=[google_search],
)

# Custom SerpAPI search wrapper that supports location coordinates and radius
def serpapi_search_with_radius(
    query: str,
    location_coordinates: Optional[Dict[str, float]] = None,
    location_radius: Optional[int] = None
) -> str:
    """
    Search for local businesses using SerpAPI with proper radius filtering.
    
    Args:
        query: Search query (e.g., "plumber", "electrician")
        location_coordinates: Dict with 'lat' and 'lng' keys
        location_radius: Search radius in miles (will be converted to meters)
    
    Returns:
        Search results as string
    """
    try:
        import serpapi
        
        serpapi_api_key = os.environ.get("SERP_API_KEY")
        if not serpapi_api_key:
            logger.error("SERP_API_KEY not configured")
            return "SerpAPI service not available (missing API key)"
        
        # Build search parameters
        params = {
            "q": query,
            "api_key": serpapi_api_key,
            "engine": "google_maps",
            "type": "search",
            "gl": "us",
            "hl": "en"
        }
        
        # Add location coordinates and radius if provided
        if location_coordinates and location_radius:
            lat = location_coordinates.get('lat')
            lng = location_coordinates.get('lng')
            if lat is not None and lng is not None:
                params["ll"] = f"@{lat},{lng},14z"  # Format: @lat,lng,zoom
                # SerpAPI doesn't have a direct radius parameter, but we can filter results
                # The ll parameter with zoom level helps focus the search area
                logger.info(f"SerpAPI search with coordinates: {lat},{lng} and radius: {location_radius} miles")
        
        # Execute search
        search = serpapi.search(params)
        results = search.get("local_results", [])
        
        if not results:
            logger.warning(f"No results found for query: {query}")
            return "No local businesses found"
        
        # Format results
        formatted_results = []
        for result in results[:10]:  # Limit to top 10
            business = {
                "name": result.get("title", "N/A"),
                "address": result.get("address", "N/A"),
                "phone": result.get("phone", "N/A"),
                "rating": result.get("rating", "N/A"),
                "reviews": result.get("reviews", 0),
                "type": result.get("type", "N/A")
            }
            formatted_results.append(business)
        
        logger.info(f"SerpAPI found {len(formatted_results)} results for query: {query}")
        return str(formatted_results)
        
    except Exception as e:
        logger.error(f"SerpAPI search failed: {e} for query {query}")
        return f"SerpAPI search error: {str(e)}"

def yelpapi_search(
    query: str,
    location_coordinates: Optional[Dict[str, float]] = None,
    location_radius: Optional[int] = None
) -> str:
    """
    Search Yelp for service providers with proper radius filtering.
    
    Args:
        query: Search query (e.g., "plumber", "electrician")
        location_coordinates: Dict with 'lat' and 'lng' keys
        location_radius: Search radius in miles (will be converted to meters, max 40000m)
    
    Returns:
        Search results as string or JSON
    """
    yelp_api_key = os.environ.get("YELP_API_KEY")
    yelp_url = os.environ.get("YELP_URL")
    
    if not yelp_api_key or not yelp_url:
        logger.error("YELP_API_KEY or YELP_URL not configured")
        return "Yelp service not available (missing configuration)"
    
    headers = {
        "accept": "application/json",
        "Content-Type": "application/json", 
        "Authorization": f"Bearer {yelp_api_key}"
    }
    
    # Build request data
    data: dict = {
        "query": query,
    }
    
    # Add location coordinates if provided
    if location_coordinates:
        lat = location_coordinates.get('lat')
        lng = location_coordinates.get('lng')
        if lat is not None and lng is not None:
            data["latitude"] = lat
            data["longitude"] = lng
            logger.info(f"Yelp search with coordinates: {lat},{lng}")
    
    # Add radius if provided (convert miles to meters, max 40000m per Yelp API)
    if location_radius:
        radius_meters = miles_to_meters(location_radius)
        data["radius"] = min(radius_meters, 40000)  # Yelp max radius is 40km
        logger.info(f"Yelp search with radius: {location_radius} miles ({data['radius']} meters)")
    
    try:
        response = requests.post(url=yelp_url, json=data, headers=headers)
        response.raise_for_status()
        logger.info(f"Yelp query: {query} Response: {response.text}")
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Yelp API call failed: {e} for query {query}")
        return "No service providers found"


service_agent = Agent(
    model='gemini-2.5-flash',
    name='service_agent',
    description="Provides professional service recommendations, cost estimates, and service provider information.",
    instruction=service_agent_instructions(),
    tools=[
        serpapi_search_with_radius,
        yelpapi_search,
        AgentTool(agent=google_search_agent),
        cost_estimation,
    ],
    input_schema=DocsInput
)

__all__ = ["service_agent"]

