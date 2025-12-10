from fastapi import APIRouter, Request
from telegram_api import telegram_webhook_handler

router = APIRouter()

@router.post("/telegram/webhook")
async def webhook_handler(request: Request):
    """
    Handle Telegram webhook updates.
    """
    return await telegram_webhook_handler(request)
