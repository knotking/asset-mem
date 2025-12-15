from fastapi import APIRouter, Request
from services.telegram_bot import get_telegram_webhook_endpoint

router = APIRouter(tags=["Telegram"])

@router.post("", summary="Telegram Webhook", description="Handle incoming Telegram webhooks.")
async def telegram_webhook(request: Request):
    return await get_telegram_webhook_endpoint()(request)
