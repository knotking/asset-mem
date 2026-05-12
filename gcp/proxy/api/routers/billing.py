"""B2C Stripe Checkout and Customer Portal (Firebase Bearer auth)."""

import logging
from google.cloud import firestore
from fastapi import APIRouter, Depends

from schemas.billing import CheckoutSessionRequest, PortalSessionRequest
from services.billing_service import create_b2c_checkout_session, create_b2c_portal_session
from utils.firebase_auth import firebase_uid_from_header

router = APIRouter(tags=["Billing"])
logger = logging.getLogger(__name__)


@router.post(
    "/billing/b2c/checkout-session",
    summary="Create Stripe Checkout Session (B2C subscription)",
)
async def b2c_checkout_session(
    body: CheckoutSessionRequest,
    uid: str = Depends(firebase_uid_from_header),
):
    db = firestore.Client()
    return create_b2c_checkout_session(db, uid, body.tier)


@router.post(
    "/billing/b2c/portal-session",
    summary="Create Stripe Customer Portal session",
)
async def b2c_portal_session(
    body: PortalSessionRequest,
    uid: str = Depends(firebase_uid_from_header),
):
    db = firestore.Client()
    path = body.return_path or "/home/settings"
    return create_b2c_portal_session(db, uid, path)
