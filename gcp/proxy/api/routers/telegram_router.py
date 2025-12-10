"""
Telegram Router

Telegram webhook endpoint for bot interactions.
"""

import logging
from fastapi import APIRouter, Request, HTTPException, status

from telegram_api import get_telegram_webhook_endpoint
from dependencies import verify_webhook_secret
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telegram"])


@router.post("")
async def telegram_webhook(request: Request):
    """
    Handle Telegram webhook updates.
    
    Processes Telegram bot updates and dispatches to aiogram handlers.
    """
    # Verify webhook secret
    if not verify_webhook_secret(request, settings.telegram_webhook_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret"
        )
    
    return await get_telegram_webhook_endpoint()(request)
