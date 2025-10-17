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
from .prompts import diagnostic_agent_instructions, multimodal_parsing_prompt, research_agent_prompt, service_provider_agent_prompt, product_recommendations_agent_prompt, cost_estimation_agent_prompt
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

# Tool for cost estimation
def cost_estimation(query: str) -> str:
    """
    Provides high-level cost estimates for DIY and professional service options.
    This is a simplified estimation based on common repair types and market rates.
    """
    query_lower = query.lower()
    
    # Define cost estimation categories with DIY and professional estimates
    cost_categories = {
        # Automotive repairs
        "scratch": {"diy": "$20-50", "pro": "$200-500", "description": "Paint touch-up and scratch repair"},
        "dent": {"diy": "$30-80", "pro": "$150-400", "description": "Minor dent repair"},
        "brake": {"diy": "$100-300", "pro": "$300-600", "description": "Brake pad/rotor replacement"},
        "oil": {"diy": "$30-50", "pro": "$50-80", "description": "Oil change service"},
        
        # Home repairs
        "plumbing": {"diy": "$50-150", "pro": "$150-400", "description": "Minor plumbing repair"},
        "leak": {"diy": "$20-100", "pro": "$200-500", "description": "Pipe leak repair"},
        "electrical": {"diy": "$30-100", "pro": "$150-300", "description": "Outlet/switch replacement"},
        "drywall": {"diy": "$20-50", "pro": "$200-400", "description": "Drywall patch and repair"},
        "painting": {"diy": "$50-200", "pro": "$300-800", "description": "Room painting"},
        
        # Appliance repairs
        "appliance": {"diy": "$50-200", "pro": "$200-500", "description": "Appliance repair"},
        "refrigerator": {"diy": "$100-300", "pro": "$300-600", "description": "Refrigerator repair"},
        "washer": {"diy": "$50-150", "pro": "$200-400", "description": "Washing machine repair"},
        "dryer": {"diy": "$50-150", "pro": "$200-400", "description": "Dryer repair"},
        
        # HVAC
        "hvac": {"diy": "$100-300", "pro": "$300-800", "description": "HVAC maintenance/repair"},
        "furnace": {"diy": "$100-400", "pro": "$400-1000", "description": "Furnace repair"},
        "air conditioning": {"diy": "$100-300", "pro": "$300-800", "description": "AC repair"},
    }
    
    # Find matching category
    matched_category = None
    for category, costs in cost_categories.items():
        if category in query_lower:
            matched_category = costs
            break
    
    if matched_category:
        diy_cost = matched_category["diy"]
        pro_cost = matched_category["pro"]
        description = matched_category["description"]
        
        return f"""### Cost Estimates for {description.title()}:

**DIY Estimate**: {diy_cost}
- Material/product costs
- Basic tools (if needed)
- Time investment required

**Professional Service Estimate**: {pro_cost}
- Labor costs
- Professional expertise
- Warranty/guarantee included

**Cost Comparison**: 
- DIY typically saves 60-80% on labor costs
- Professional service provides expertise and warranty
- Consider complexity and your skill level

**Recommendation**: 
- Simple repairs: DIY may be cost-effective
- Complex or safety-critical repairs: Professional service recommended
- Estimates may vary by location and specific circumstances"""
    
    else:
        return f"""### Cost Estimates for {query}:

**DIY Estimate**: $50-300
- Material/product costs vary by repair type
- Basic tools may be required
- Time investment needed

**Professional Service Estimate**: $200-800
- Labor costs depend on complexity
- Professional expertise included
- Warranty/guarantee typically provided

**Cost Comparison**: 
- DIY typically saves 60-80% on labor costs
- Professional service provides expertise and warranty
- Consider repair complexity and safety factors

**Recommendation**: 
- Simple repairs: DIY may be cost-effective
- Complex or safety-critical repairs: Professional service recommended
- Estimates are rough and may vary significantly by location and specific circumstances

*Note: For accurate estimates, consult local professionals or get multiple quotes.*"""

# New tool for product recommendations  
def product_recommendations(query: str) -> str:
    amazon_api_key = os.environ.get("AMAZON_API_KEY")
    home_depot_api_key = os.environ.get("HOME_DEPOT_API_KEY")
    lowes_api_key = os.environ.get("LOWES_API_KEY")
    walmart_api_key = os.environ.get("WALMART_API_KEY")
    
    recommendations = []
    
    # Amazon API search
    amazon_url = f"https://amazon-product-reviews-keywords.p.rapidapi.com/product/search?keyword={query}&country=US"
    headers = {
        "X-RapidAPI-Key": amazon_api_key,
        "X-RapidAPI-Host": "amazon-product-reviews-keywords.p.rapidapi.com"
    }
    response = requests.get(amazon_url, headers=headers)
    if response.status_code == 200:
        results = response.json()
        for result in results["products"][:3]:
            try:
                name = result["title"]
                link = result["url"]
                price = result["price"]["current_price"] 
                desc = result["description"][:100] + "..."
                rec = f"- {name} (${price}) - {desc} - {link}"
                recommendations.append(rec)
            except KeyError:
                pass
                
    # Home Depot API search
    home_depot_url = f"https://home-depot-data-api.p.rapidapi.com/search/products?keyword={query}"
    headers = {
        "X-RapidAPI-Key": home_depot_api_key,
        "X-RapidAPI-Host": "home-depot-data-api.p.rapidapi.com"
    }
    response = requests.get(home_depot_url, headers=headers)
    if response.status_code == 200:  
        results = response.json()
        for result in results["data"][:3]:
            try:
                name = result["store_sku_title"] 
                link = f"https://www.homedepot.com/p/{result['store_sku']}"
                price = result["main_price"]
                desc = result["short_description"][:100] + "..."
                rec = f"- {name} (${price}) - {desc} - {link}"
                recommendations.append(rec)
            except KeyError:
                pass

    # Lowe's API search
    lowes_url = f"https://lowes.p.rapidapi.com/products/search?query={query}"
    headers = {
        "X-RapidAPI-Key": lowes_api_key,
        "X-RapidAPI-Host": "lowes.p.rapidapi.com"  
    }
    response = requests.get(lowes_url, headers=headers)
    if response.status_code == 200:
        results = response.json()  
        for result in results["searchResults"]["products"][:3]:
            try:
                name = result["productName"]
                link = f"https://www.lowes.com{result['productUrl']}" 
                price = result["prices"]["specialPrice"] or result["prices"]["regularPrice"]
                desc = result["description"][:100] + "..."
                rec = f"- {name} (${price}) - {desc} - {link}"
                recommendations.append(rec) 
            except KeyError:
                pass

    # Walmart API search
    walmart_url = f"https://walmart.p.rapidapi.com/products/list?query={query}"
    headers = {
        "X-RapidAPI-Key": walmart_api_key,  
        "X-RapidAPI-Host": "walmart.p.rapidapi.com"
    } 
    response = requests.get(walmart_url, headers=headers)
    if response.status_code == 200:
        results = response.json()
        for result in results["data"]["search"]["searchResult"]["itemStacks"][0]["items"][:3]: 
            try:
                name = result["name"] 
                link = result["canonicalUrl"]
                price = result["price"]
                desc = result["description"][:100] + "..."  
                rec = f"- {name} (${price}) - {desc} - {link}"
                recommendations.append(rec)
            except KeyError: 
                pass

    if recommendations:
        return "\n".join(recommendations)  
    else:
        return f"No recommended products found for {query}."

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

product_recommendations_agent = Agent(
    model='gemini-2.5-flash',
    name='product_recommendations_agent',
    description="Find relevant product recommendations for DIY repair or replacement based on an identified problem.",
    instruction=product_recommendations_agent_prompt(),
    tools=[product_recommendations],
)

cost_estimation_agent = Agent(
    model='gemini-2.5-flash',
    name='cost_estimation_agent',
    description="Provide high-level cost estimates for both DIY repair and professional service engagement.",
    instruction=cost_estimation_agent_prompt(),
    tools=[cost_estimation],
)

diagnostic_agent = Agent(
    model='gemini-2.5-flash',
    name='diagnostic_agent',
    instruction=diagnostic_agent_instructions(),
    tools=[analyse_multimodal_data, AgentTool(research_agent), AgentTool(service_provider_agent), AgentTool(product_recommendations_agent), AgentTool(cost_estimation_agent)], 
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback,
    input_schema=DiagnosisInput
)

__all__ = ["diagnostic_agent"]