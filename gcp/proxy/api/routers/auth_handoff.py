"""Mobile app → mobile browser: sign web session to the same Firebase user."""

import logging

from fastapi import APIRouter, Depends
from google.cloud import firestore

from schemas.auth_handoff import (
    MobileWebHandoffConsumeRequest,
    MobileWebHandoffConsumeResponse,
    MobileWebHandoffCreateRequest,
    MobileWebHandoffCreateResponse,
)
from services.auth_handoff_service import (
    consume_mobile_web_handoff,
    create_mobile_web_handoff,
)
from utils.firebase_auth import firebase_uid_from_header

router = APIRouter(tags=["Auth"])
logger = logging.getLogger(__name__)


@router.post(
    "/auth/mobile-web-handoff",
    response_model=MobileWebHandoffCreateResponse,
    summary="Create one-time code to sign into web as the mobile user",
)
async def mobile_web_handoff_create(
    body: MobileWebHandoffCreateRequest,
    uid: str = Depends(firebase_uid_from_header),
):
    db = firestore.Client()
    result = create_mobile_web_handoff(db, uid, body.returnPath)
    return MobileWebHandoffCreateResponse(**result)


@router.post(
    "/auth/mobile-web-handoff/consume",
    response_model=MobileWebHandoffConsumeResponse,
    summary="Exchange one-time handoff code for a Firebase custom token",
)
async def mobile_web_handoff_consume(body: MobileWebHandoffConsumeRequest):
    db = firestore.Client()
    result = consume_mobile_web_handoff(db, body.code)
    return MobileWebHandoffConsumeResponse(**result)
