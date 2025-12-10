from fastapi import APIRouter, Request
from telegram_api import get_telegram_webhook_endpoint

router = APIRouter()

@router.post("")
async def telegram_webhook(request: Request):
    return await get_telegram_webhook_endpoint()(request)

