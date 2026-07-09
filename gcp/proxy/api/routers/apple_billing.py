"""Apple In-App Purchase (StoreKit) routes."""

import logging

from fastapi import APIRouter, Depends
from google.cloud import firestore

from schemas.apple_billing import (
    RestoreIosTransactionsRequest,
    VerifyIosTransactionRequest,
)
from services.apple_billing_service import (
    restore_ios_subscriptions,
    verify_ios_transaction,
)
from utils.firebase_auth import firebase_uid_from_header

router = APIRouter(tags=["Apple billing"])
logger = logging.getLogger(__name__)


@router.post(
    "/billing/ios/verify-transaction",
    summary="Verify StoreKit transaction and sync entitlements",
)
async def ios_verify_transaction(
    body: VerifyIosTransactionRequest,
    uid: str = Depends(firebase_uid_from_header),
):
    db = firestore.Client()
    return await verify_ios_transaction(db, uid, body.transaction_id)


@router.post(
    "/billing/ios/restore",
    summary="Restore StoreKit purchases for the signed-in user",
)
async def ios_restore_transactions(
    body: RestoreIosTransactionsRequest,
    uid: str = Depends(firebase_uid_from_header),
):
    db = firestore.Client()
    return await restore_ios_subscriptions(db, uid, body.transaction_ids)
