"""App Store Server Notifications V2 (fixed URL for App Store Connect)."""

import logging

from fastapi import APIRouter, HTTPException

from schemas.apple_billing import AppleNotificationRequest
from services.apple_billing_service import process_apple_notification

router = APIRouter(tags=["Apple webhook"])
logger = logging.getLogger(__name__)


@router.post("/apple/app-store-notifications")
async def apple_app_store_notifications(body: AppleNotificationRequest):
    try:
        return await process_apple_notification(body.signed_payload)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("apple_app_store_notifications failed: %s", e)
        raise HTTPException(status_code=500, detail="Apple webhook handler error") from e
