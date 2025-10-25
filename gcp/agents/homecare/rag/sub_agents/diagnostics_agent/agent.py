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
    Returns structured output for nested JSON response.
    """
    import json
    
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
        
        response_data = {
            "costEstimates": {
                "repair_type": description.title(),
                "DIY": {
                    "cost_range": diy_cost,
                    "includes": ["Material/product costs", "Basic tools (if needed)", "Time investment required"],
                    "savings": "60-80% on labor costs",
                    "complexity": "Simple repairs may be cost-effective"
                },
                "Service": {
                    "cost_range": pro_cost,
                    "includes": ["Labor costs", "Professional expertise", "Warranty/guarantee included"],
                    "benefits": "Expertise and warranty",
                    "complexity": "Complex or safety-critical repairs recommended"
                },
                "comparison": {
                    "diy_savings": "60-80% on labor costs",
                    "professional_benefits": "Expertise and warranty",
                    "considerations": "Complexity and skill level"
                },
                "recommendation": {
                    "simple_repairs": "DIY may be cost-effective",
                    "complex_repairs": "Professional service recommended",
                    "note": "Estimates may vary by location and specific circumstances"
                }
            }
        }
        
    else:
        response_data = {
            "costEstimates": {
                "repair_type": query,
                "DIY": {
                    "cost_range": "$50-300",
                    "includes": ["Material/product costs vary by repair type", "Basic tools may be required", "Time investment needed"],
                    "savings": "60-80% on labor costs",
                    "complexity": "Simple repairs may be cost-effective"
                },
                "Service": {
                    "cost_range": "$200-800",
                    "includes": ["Labor costs depend on complexity", "Professional expertise included", "Warranty/guarantee typically provided"],
                    "benefits": "Expertise and warranty",
                    "complexity": "Complex or safety-critical repairs recommended"
                },
                "comparison": {
                    "diy_savings": "60-80% on labor costs",
                    "professional_benefits": "Expertise and warranty",
                    "considerations": "Repair complexity and safety factors"
                },
                "recommendation": {
                    "simple_repairs": "DIY may be cost-effective",
                    "complex_repairs": "Professional service recommended",
                    "note": "Estimates are rough and may vary significantly by location and specific circumstances. For accurate estimates, consult local professionals or get multiple quotes."
                }
            }
        }
    
    return json.dumps(response_data)

# Enhanced tool for product recommendations with DIY vs Service scenarios
def product_recommendations(query: str) -> str:
    """
    Provides targeted product recommendations for both DIY and Service scenarios.
    Recommends specific products based on problem type and appropriate retailers.
    Returns structured JSON output with nested vendor and product information.
    """
    serpapi_api_key = os.environ.get("SERP_API_KEY")
    
    if not serpapi_api_key:
        return '{"recommendedProducts": "Product recommendations service not available (missing API key)."}'
    
    try:
        import serpapi
        import json
        
        # Determine problem type and appropriate retailers
        query_lower = query.lower()
        
        # Define retailer preferences based on problem type
        retailer_preferences = {
            # Home repair problems
            "plumbing": ["Home Depot", "Lowe's", "Ace Hardware"],
            "electrical": ["Home Depot", "Lowe's", "Electrical Supply"],
            "drywall": ["Home Depot", "Lowe's", "Sherwin Williams"],
            "painting": ["Home Depot", "Lowe's", "Sherwin Williams"],
            "hvac": ["Home Depot", "Lowe's", "HVAC Supply"],
            "appliance": ["Home Depot", "Lowe's", "Appliance Parts"],
            
            # Automotive problems
            "tire": ["Costco", "Discount Tire", "Firestone", "Goodyear"],
            "brake": ["AutoZone", "Advance Auto", "O'Reilly Auto"],
            "oil": ["AutoZone", "Advance Auto", "Walmart"],
            "scratch": ["AutoZone", "Advance Auto", "O'Reilly Auto"],
            "dent": ["AutoZone", "Advance Auto", "Body Shop Supply"],
            "car": ["AutoZone", "Advance Auto", "O'Reilly Auto"],
            
            # General problems
            "tool": ["Home Depot", "Lowe's", "Harbor Freight"],
            "hardware": ["Home Depot", "Lowe's", "Ace Hardware"],
            "supply": ["Home Depot", "Lowe's", "Amazon"]
        }
        
        # Find appropriate retailers for this problem
        preferred_retailers = []
        for problem_type, retailers in retailer_preferences.items():
            if problem_type in query_lower:
                preferred_retailers.extend(retailers)
                break
        
        if not preferred_retailers:
            preferred_retailers = ["Home Depot", "Lowe's", "Amazon", "AutoZone"]
        
        # Search for DIY products
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
        
        # Search for service/repair products
        service_query = f"{query} professional repair parts replacement"
        service_search = serpapi.GoogleSearch({
            "q": service_query,
            "tbm": "shop",
            "api_key": serpapi_api_key,
            "num": 6,
            "gl": "us",
            "hl": "en"
        })
        
        service_results = service_search.get_dict()
        service_products = service_results.get("shopping_results", [])
        
        # Process and filter results
        def process_products(products, scenario_name, max_results=5):
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
                    
                    # Prioritize preferred retailers
                    is_preferred = any(retailer.lower() in source.lower() for retailer in preferred_retailers)
                    
                    product_data = {
                        "product_name": title,
                        "vendor": source if source != "Unknown Store" else None,
                        "url": link if link else None,
                        "item_price": price if price != "Price not available" else None,
                        "rating": rating if rating else None,
                        "reviews": reviews if reviews else None,
                        "image_url": image_url if image_url else None,
                        "is_preferred_retailer": is_preferred
                    }
                    
                    processed.append(product_data)
                    
                except (KeyError, TypeError) as e:
                    logger.warning(f"Error processing {scenario_name} product: {e}")
                    continue
            
            return processed
        
        # Generate recommendations
        diy_items = process_products(diy_products, "DIY")
        service_items = process_products(service_products, "Service")
        
        # Create structured response
        response_data = {
            "recommendedProducts": {
                "DIY": {
                    "products": diy_items,
                    "description": "Essential products you'll need to fix this yourself"
                },
                "Service": {
                    "products": service_items,
                    "description": "Products typically used by professionals for this repair"
                },
                "recommended_retailers": preferred_retailers[:4],
                "shopping_tips": [
                    "★ indicates products from recommended retailers",
                    "Compare prices across multiple stores",
                    "Check return policies before purchasing",
                    "Consider buying extra supplies for future repairs"
                ]
            }
        }
        
        return json.dumps(response_data)
            
    except Exception as e:
        logger.error(f"Error searching for product recommendations: {e}")
        return json.dumps({"recommendedProducts": f"Error retrieving product recommendations: {str(e)}"})

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