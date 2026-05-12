"""Stripe webhooks (signature-verified; unprefixed URL for Stripe Dashboard)."""

import logging

from fastapi import APIRouter, Request, HTTPException

from services.billing_service import process_stripe_webhook

router = APIRouter(tags=["Stripe webhook"])
logger = logging.getLogger(__name__)


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        result = process_stripe_webhook(payload, sig)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("stripe_webhook failed: %s", e)
        raise HTTPException(status_code=500, detail="Webhook handler error") from e
