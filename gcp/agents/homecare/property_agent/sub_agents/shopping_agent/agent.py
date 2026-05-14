import os
import json
from google.adk.agents import Agent
from dotenv import load_dotenv
from .prompts import shopping_agent_instructions
from ...agent_inputs import DocsInput
from ...model_config import GLOBAL_GEMINI_MODEL
import logging

logger = logging.getLogger(__name__)
load_dotenv()

def product_recommendations(query: str, category: str = "DIY") -> str:
    """Provides product recommendations for repairs. Can be used for DIY or professional service products."""
    serpapi_api_key = os.environ.get("SERP_API_KEY")

    if not serpapi_api_key:
        logger.info(
            "product_recommendations: SERP_API_KEY unset; returning unavailable payload (category=%s query_len=%d)",
            category,
            len(query or ""),
        )
        return json.dumps({"recommendedProducts": {"message": "Product recommendations service not available (missing API key)."}})
    
    try:
        import serpapi
        
        # Build search query based on category
        if category == "DIY":
            search_query = f"{query} DIY repair products tools"
        else:
            search_query = f"{query} {category} repair products tools"

        logger.info("product_recommendations: SerpAPI search_query=%r", search_query)

        product_search = serpapi.GoogleSearch({
            "q": search_query,
            "tbm": "shop",
            "api_key": serpapi_api_key,
            "num": 6,
            "gl": "us",
            "hl": "en"
        })
        
        search_results = product_search.get_dict()
        if isinstance(search_results, dict) and search_results.get("error"):
            logger.info(
                "product_recommendations: SerpAPI error in response category=%s search_query=%r error=%s",
                category,
                search_query,
                search_results.get("error"),
            )
        products = search_results.get("shopping_results") or []
        if not isinstance(products, list):
            logger.info(
                "product_recommendations: shopping_results not a list (type=%s); treating as empty",
                type(products).__name__,
            )
            products = []
        
        # Process products
        def process_products(products, max_results=5):
            processed = []
            for result in products[:max_results]:
                try:
                    title = result.get("title", "Unknown Product")
                    link = result.get("link", "")
                    source = result.get("source", "Unknown Store")
                    reviews = result.get("reviews", "")
                    image_url = result.get("thumbnail", "")
                    
                    # Ensure we have all required fields
                    product_data = {
                        "item_name": title if title != "Unknown Product" else None,
                        "image_url": image_url if image_url else None,
                        "vendor": source if source != "Unknown Store" else None,
                        "reviews": reviews if reviews else None,
                        "store_url": link if link else None,
                    }
                    processed.append(product_data)
                except (KeyError, TypeError) as e:
                    logger.warning(f"Error processing product: {e}")
                    continue
            return processed
        
        processed_items = process_products(products)
        logger.debug(
            "product_recommendations: SerpAPI processed_items=%s",
            json.dumps(processed_items, ensure_ascii=False),
        )

        if not processed_items:
            top_keys = (
                list(search_results.keys())[:15]
                if isinstance(search_results, dict)
                else []
            )
            logger.info(
                "product_recommendations: zero products after processing "
                "(category=%s search_query=%r raw_shopping_count=%d response_keys=%s)",
                category,
                search_query,
                len(products),
                top_keys,
            )

        response_data = {
            "recommendedProducts": {
                category: {
                    "products": processed_items,
                    "description": f"Essential products you'll need for {category.lower()} repair"
                }
            }
        }
        return json.dumps(response_data)
    except Exception as e:
        logger.error(f"Error searching for product recommendations: {e}")
        return json.dumps({"recommendedProducts": {"error": f"Error retrieving product recommendations: {str(e)}"}})


shopping_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name='shopping_agent',
    description="Provides product recommendations for DIY repairs, professional services, and general repair needs.",
    instruction=shopping_agent_instructions(),
    tools=[product_recommendations],
    input_schema=DocsInput
)

__all__ = ["shopping_agent", "product_recommendations"]

