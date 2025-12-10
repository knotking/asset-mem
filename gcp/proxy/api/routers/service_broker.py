from fastapi import APIRouter, Request
import logging
import asyncio
from services.service_broker_service import handle_service_broker_payload

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/service-broker-agent")
async def service_broker_agent_webhook(request: Request):
    logger.info("Service broker agent webhook received a request.")
    try:
        payload = await request.json()
        logger.info(f"Service broker agent webhook payload: {payload}")
        
        loop = asyncio.get_running_loop()
        # Schedule async processing on current loop
        loop.create_task(handle_service_broker_payload(payload))
        
        return {"status": "ok", "message": "Payload received"}
    except Exception as e:
        logger.error(f"Error processing service broker agent webhook: {e}")
        return {"status": "error", "message": str(e)}
