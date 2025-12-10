"""
Service Broker Router

Service broker agent webhook endpoints.
"""

import logging
import asyncio
from fastapi import APIRouter, Request, HTTPException, status

from service_broker_api import handle_service_broker_payload
from dependencies import get_request_id, verify_webhook_secret
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["service-broker"])

# Get main event loop for background processing
main_loop = asyncio.get_event_loop()


@router.post("/service-broker-agent")
async def service_broker_agent_webhook(request: Request):
    """
    Webhook endpoint to receive service broker agent notifications.
    
    This endpoint receives JSON payloads from the service broker agent.
    Returns 200 immediately and processes the payload asynchronously on main_loop.
    """
    # Verify webhook secret
    if not verify_webhook_secret(request, settings.firebase_webhook_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret"
        )
    
    logger.info("Service broker agent webhook received a request.")
    request_id = get_request_id(request)
    
    try:
        payload = await request.json()
        logger.info(f"Service broker agent webhook payload: {payload}", extra={"request_id": request_id})
        
        # Schedule async processing on main_loop and return immediately
        asyncio.run_coroutine_threadsafe(
            handle_service_broker_payload(payload),
            main_loop
        )
        
        return {"status": "ok", "message": "Payload received"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing service broker agent webhook: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
