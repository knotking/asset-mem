import os
import json
import time
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
    t0 = time.monotonic()

    def _elapsed_ms() -> int:
        return int((time.monotonic() - t0) * 1000)

    serpapi_api_key = os.environ.get("SERP_API_KEY")

    if not serpapi_api_key:
        logger.info(
            "product_recommendations: skip duration_ms=%d category=%s reason=no_api_key query_len=%d",
            _elapsed_ms(),
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

        logger.debug("product_recommendations: SerpAPI search_query=%r", search_query)

        product_search = serpapi.GoogleSearch({
            "q": search_query,
            "tbm": "shop",
            "api_key": serpapi_api_key,
            "num": 6,
            "gl": "us",
            "hl": "en"
        })
        
        search_results = product_search.get_dict()
        serp_err = isinstance(search_results, dict) and bool(
            search_results.get("error")
        )
        if serp_err:
            logger.info(
                "product_recommendations: SerpAPI error duration_ms=%d category=%s error=%s",
                _elapsed_ms(),
                category,
                search_results.get("error"),
            )
            logger.debug(
                "product_recommendations: SerpAPI error search_query=%r",
                search_query,
            )
        products = search_results.get("shopping_results") or []
        if not isinstance(products, list):
            logger.debug(
                "product_recommendations: shopping_results not a list (type=%s)",
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
                    logger.warning(
                        "Error processing product (skipped one item): %s: %s",
                        type(e).__name__,
                        e,
                    )
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
            logger.debug(
                "product_recommendations: zero_products search_query=%r response_keys=%s",
                search_query,
                top_keys,
            )

        outcome = (
            "serp_api_error"
            if serp_err
            else ("zero_products" if not processed_items else "ok")
        )
        response_data = {
            "recommendedProducts": {
                category: {
                    "products": processed_items,
                    "description": f"Essential products you'll need for {category.lower()} repair"
                }
            }
        }
        logger.info(
            "product_recommendations: done duration_ms=%d category=%s outcome=%s "
            "products=%d raw_shopping_count=%d query_len=%d",
            _elapsed_ms(),
            category,
            outcome,
            len(processed_items),
            len(products) if isinstance(products, list) else 0,
            len(query or ""),
        )
        return json.dumps(response_data)
    except Exception as e:
        logger.exception("Error searching for product recommendations: %s", e)
        logger.info(
            "product_recommendations: exception duration_ms=%d category=%s",
            _elapsed_ms(),
            category,
        )
        return json.dumps({"recommendedProducts": {"error": f"Error retrieving product recommendations: {str(e)}"}})


shopping_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name='shopping_agent',
    description="Provides product recommendations for DIY repairs, professional services, and general repair needs.",
    instruction=shopping_agent_instructions(),
    tools=[product_recommendations],
    input_schema=DocsInput
)

# ADK AgentEvaluator expects ``root_agent`` on ``*.agent`` modules.
root_agent = shopping_agent

__all__ = ["shopping_agent", "product_recommendations", "root_agent"]

