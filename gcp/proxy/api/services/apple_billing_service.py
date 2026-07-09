"""Apple App Store In-App Purchase validation and Firestore billing sync."""

from __future__ import annotations

import base64
import binascii
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
import jwt
from google.cloud import firestore
from fastapi import HTTPException

from common.billing_plans import B2CPricePlan, plan_for_apple_product
from core.config import settings

logger = logging.getLogger(__name__)

APPLE_API_PRODUCTION = "https://api.storekit.itunes.apple.com"
APPLE_API_SANDBOX = "https://api.storekit-sandbox.itunes.apple.com"

# Stable namespace for mapping Firebase UID ↔ Apple appAccountToken (UUID).
_APP_ACCOUNT_TOKEN_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

APPLE_SUBSCRIPTION_LINKS_COLLECTION = "apple_subscription_links"

# Apple subscription statuses that grant paid entitlements.
_ACTIVE_APPLE_STATUSES = frozenset({"active", "trialing", "grace_period", "billing_retry"})


def firebase_uid_to_app_account_token(uid: str) -> str:
    """Deterministic UUID for StoreKit ``appAccountToken`` (Apple requires UUID format)."""
    return str(uuid.uuid5(_APP_ACCOUNT_TOKEN_NAMESPACE, uid.strip()))


def app_account_token_to_firebase_uid(token: str) -> Optional[str]:
    """Reverse lookup is not possible from UUID5 alone; use Firestore links instead."""
    return None


def _apple_api_base() -> str:
    env = (settings.APPLE_APP_STORE_ENVIRONMENT or "Production").strip().lower()
    if env == "sandbox":
        return APPLE_API_SANDBOX
    return APPLE_API_PRODUCTION


def _decode_apple_private_key() -> str:
    raw = (settings.APPLE_APP_STORE_PRIVATE_KEY or "").strip()
    if not raw:
        raise HTTPException(status_code=503, detail="Apple billing is not configured (missing private key)")
    if "BEGIN PRIVATE KEY" in raw:
        return raw
    try:
        decoded = base64.b64decode(raw, validate=True).decode("utf-8").strip()
    except (binascii.Error, UnicodeDecodeError) as e:
        raise HTTPException(
            status_code=503,
            detail="Apple billing private key is not valid PEM or base64 PEM",
        ) from e
    if "BEGIN PRIVATE KEY" not in decoded:
        raise HTTPException(status_code=503, detail="Apple billing private key is not valid PEM")
    return decoded


def _apple_configured() -> bool:
    return bool(
        settings.APPLE_APP_STORE_KEY_ID
        and settings.APPLE_APP_STORE_ISSUER_ID
        and settings.APPLE_APP_STORE_PRIVATE_KEY
        and settings.APPLE_BUNDLE_ID
    )


def _generate_apple_api_jwt() -> str:
    if not _apple_configured():
        raise HTTPException(status_code=503, detail="Apple billing is not configured")
    private_key = _decode_apple_private_key()
    now = int(time.time())
    headers = {"alg": "ES256", "kid": settings.APPLE_APP_STORE_KEY_ID, "typ": "JWT"}
    payload = {
        "iss": settings.APPLE_APP_STORE_ISSUER_ID,
        "iat": now,
        "exp": now + 3000,
        "aud": "appstoreconnect-v1",
        "bid": settings.APPLE_BUNDLE_ID,
    }
    return jwt.encode(payload, private_key, algorithm="ES256", headers=headers)


def _decode_jws_payload(signed_jws: str) -> dict[str, Any]:
    """Decode Apple JWS payload without signature verification (data fetched from Apple API)."""
    try:
        parts = signed_jws.split(".")
        if len(parts) != 3:
            raise ValueError("invalid JWS structure")
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("JWS payload is not an object")
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Apple signed payload: {e}") from e


def _ms_to_datetime(ms: Any) -> Optional[datetime]:
    try:
        value = int(ms)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)


def _subscription_status_from_apple(
    *,
    expires_at: Optional[datetime],
    revocation_date: Optional[datetime],
    grace_period_expires: Optional[datetime] = None,
    is_in_billing_retry: bool = False,
) -> str:
    now = datetime.now(timezone.utc)
    if revocation_date is not None and revocation_date <= now:
        return "canceled"
    if expires_at is None:
        return "active"
    if expires_at > now:
        if grace_period_expires and grace_period_expires > now:
            return "grace_period"
        if is_in_billing_retry:
            return "billing_retry"
        return "active"
    if grace_period_expires and grace_period_expires > now:
        return "grace_period"
    if is_in_billing_retry:
        return "billing_retry"
    return "expired"


def _plan_limits_payload(plan: B2CPricePlan) -> dict[str, Any]:
    return {
        "monthlyTokenLimit": plan.monthly_token_limit if plan.monthly_token_limit > 0 else None,
        "monthlyDocumentLimit": plan.monthly_document_limit if plan.monthly_document_limit > 0 else None,
        "monthlyCheckpointLimit": plan.monthly_checkpoint_limit if plan.monthly_checkpoint_limit > 0 else None,
        "monthlyReportGenerationsLimit": (
            plan.monthly_report_generations if plan.monthly_report_generations > 0 else None
        ),
    }


def _clear_paid_limits() -> dict[str, Any]:
    return {
        "monthlyTokenLimit": None,
        "monthlyDocumentLimit": None,
        "monthlyCheckpointLimit": None,
        "monthlyReportGenerationsLimit": None,
    }


def _subscription_link_ref(db: firestore.Client, original_transaction_id: str):
    return db.collection(APPLE_SUBSCRIPTION_LINKS_COLLECTION).document(str(original_transaction_id))


def _store_subscription_link(
    db: firestore.Client,
    *,
    original_transaction_id: str,
    firebase_uid: str,
    apple_product_id: str,
) -> None:
    _subscription_link_ref(db, original_transaction_id).set(
        {
            "firebaseUid": firebase_uid,
            "appleProductId": apple_product_id,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )


def _firebase_uid_for_original_transaction(
    db: firestore.Client, original_transaction_id: str
) -> Optional[str]:
    snap = _subscription_link_ref(db, original_transaction_id).get()
    if not snap.exists:
        return None
    uid = (snap.to_dict() or {}).get("firebaseUid")
    return str(uid).strip() if uid else None


def _billing_summary_ref(db: firestore.Client, uid: str):
    return db.collection("users").document(uid).collection("billing").document("summary")


def _active_stripe_subscription(db: firestore.Client, uid: str) -> bool:
    snap = _billing_summary_ref(db, uid).get()
    if not snap.exists:
        return False
    data = snap.to_dict() or {}
    if str(data.get("billingProvider") or "").lower() != "stripe":
        return False
    status = str(data.get("subscriptionStatus") or "").lower()
    return status in ("active", "trialing")


def sync_apple_subscription_to_firestore(
    db: firestore.Client,
    uid: str,
    *,
    apple_product_id: Optional[str],
    apple_original_transaction_id: Optional[str],
    subscription_status: Optional[str],
    apple_expires_at: Optional[datetime] = None,
    apple_transaction_id: Optional[str] = None,
) -> None:
    """Write Apple IAP entitlements to the same billing summary Stripe uses."""
    ref = _billing_summary_ref(db, uid)
    status_l = (subscription_status or "").lower()
    payload: dict[str, Any] = {
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "billingProvider": "apple",
        "appleProductId": apple_product_id,
        "appleOriginalTransactionId": apple_original_transaction_id,
        "appleTransactionId": apple_transaction_id,
        "subscriptionStatus": subscription_status,
        "appleExpiresAt": apple_expires_at,
        # Clear Stripe fields when Apple is the active provider.
        "stripeCustomerId": None,
        "stripeSubscriptionId": None,
        "priceId": None,
    }
    if status_l in _ACTIVE_APPLE_STATUSES and apple_product_id:
        plan = plan_for_apple_product(settings.STRIPE_B2C_PRICE_TOKEN_CAPS_JSON, apple_product_id)
        if plan is not None:
            payload.update(_plan_limits_payload(plan))
        else:
            logger.warning("Unknown Apple product id for caps: %s", apple_product_id)
            payload.update(_clear_paid_limits())
    else:
        payload.update(_clear_paid_limits())

    ref.set(payload, merge=True)
    if apple_original_transaction_id:
        _store_subscription_link(
            db,
            original_transaction_id=apple_original_transaction_id,
            firebase_uid=uid,
            apple_product_id=apple_product_id or "",
        )


async def _apple_get(path: str) -> dict[str, Any]:
    token = _generate_apple_api_jwt()
    url = f"{_apple_api_base()}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, headers=headers)
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Apple transaction not found")
    if resp.status_code >= 400:
        logger.warning("Apple API %s returned %s: %s", path, resp.status_code, resp.text[:500])
        raise HTTPException(status_code=502, detail="Apple App Store API error")
    try:
        return resp.json()
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail="Invalid Apple API response") from e


async def fetch_transaction_info(transaction_id: str) -> dict[str, Any]:
    data = await _apple_get(f"/inApps/v1/transactions/{transaction_id}")
    signed = data.get("signedTransactionInfo")
    if not signed:
        raise HTTPException(status_code=502, detail="Apple API did not return signedTransactionInfo")
    return _decode_jws_payload(str(signed))


async def fetch_subscription_status(original_transaction_id: str) -> dict[str, Any]:
    return await _apple_get(f"/inApps/v1/subscriptions/{original_transaction_id}")


def _transaction_entitlement_from_payload(tx: dict[str, Any]) -> dict[str, Any]:
    bundle_id = str(tx.get("bundleId") or "")
    if settings.APPLE_BUNDLE_ID and bundle_id and bundle_id != settings.APPLE_BUNDLE_ID:
        raise HTTPException(status_code=400, detail="Transaction bundle id does not match this app")

    product_id = str(tx.get("productId") or "")
    if not plan_for_apple_product(settings.STRIPE_B2C_PRICE_TOKEN_CAPS_JSON, product_id):
        raise HTTPException(status_code=400, detail=f"Unknown subscription product: {product_id}")

    original_tx_id = str(tx.get("originalTransactionId") or tx.get("transactionId") or "")
    if not original_tx_id:
        raise HTTPException(status_code=400, detail="Transaction missing originalTransactionId")

    expires_at = _ms_to_datetime(tx.get("expiresDate"))
    revocation = _ms_to_datetime(tx.get("revocationDate"))
    status = _subscription_status_from_apple(expires_at=expires_at, revocation_date=revocation)

    app_account_token = str(tx.get("appAccountToken") or "").strip().lower()
    return {
        "apple_product_id": product_id,
        "apple_original_transaction_id": original_tx_id,
        "apple_transaction_id": str(tx.get("transactionId") or ""),
        "subscription_status": status,
        "apple_expires_at": expires_at,
        "app_account_token": app_account_token,
    }


async def verify_ios_transaction(db: firestore.Client, uid: str, transaction_id: str) -> dict[str, Any]:
    """Validate a StoreKit transaction with Apple and sync entitlements for the authenticated user."""
    if not _apple_configured():
        raise HTTPException(status_code=503, detail="Apple billing is not configured")

    if _active_stripe_subscription(db, uid):
        raise HTTPException(
            status_code=409,
            detail=(
                "You already have an active subscription via the website. "
                "Manage it on the web — Apple In-App Purchase is not available while that subscription is active."
            ),
        )

    tx = await fetch_transaction_info(transaction_id.strip())
    ent = _transaction_entitlement_from_payload(tx)

    expected_token = firebase_uid_to_app_account_token(uid).lower()
    token = ent.get("app_account_token") or ""
    original_tx_id = ent["apple_original_transaction_id"]
    linked_uid = _firebase_uid_for_original_transaction(db, original_tx_id)

    if token:
        if token != expected_token:
            if linked_uid and linked_uid != uid:
                raise HTTPException(
                    status_code=409,
                    detail="This subscription belongs to a different account.",
                )
            raise HTTPException(
                status_code=409,
                detail="Transaction app account token does not match the signed-in user.",
            )
    elif linked_uid and linked_uid != uid:
        raise HTTPException(
            status_code=409,
            detail="This subscription is linked to a different account.",
        )

    sync_apple_subscription_to_firestore(
        db,
        uid,
        apple_product_id=ent["apple_product_id"],
        apple_original_transaction_id=original_tx_id,
        subscription_status=ent["subscription_status"],
        apple_expires_at=ent["apple_expires_at"],
        apple_transaction_id=ent["apple_transaction_id"],
    )
    return {
        "status": "ok",
        "subscriptionStatus": ent["subscription_status"],
        "appleProductId": ent["apple_product_id"],
        "appleOriginalTransactionId": original_tx_id,
    }


async def restore_ios_subscriptions(
    db: firestore.Client, uid: str, transaction_ids: list[str]
) -> dict[str, Any]:
    """Verify one or more transaction ids (restore purchases) for the authenticated user."""
    if not transaction_ids:
        raise HTTPException(status_code=400, detail="No transactions to restore")
    last: dict[str, Any] = {"status": "ok", "restored": 0}
    for tx_id in transaction_ids:
        tx_id = str(tx_id).strip()
        if not tx_id:
            continue
        last = await verify_ios_transaction(db, uid, tx_id)
        last["restored"] = last.get("restored", 0) + 1
    return last


def _status_from_subscription_status_item(item: dict[str, Any]) -> tuple[str, Optional[datetime], str]:
    """Parse one entry from GET /subscriptions/{id} lastTransactions."""
    signed_tx = item.get("signedTransactionInfo")
    if not signed_tx:
        return "expired", None, ""
    tx = _decode_jws_payload(str(signed_tx))
    product_id = str(tx.get("productId") or "")
    expires_at = _ms_to_datetime(tx.get("expiresDate"))
    revocation = _ms_to_datetime(tx.get("revocationDate"))
    status = _subscription_status_from_apple(expires_at=expires_at, revocation_date=revocation)
    original_tx_id = str(tx.get("originalTransactionId") or "")
    return status, expires_at, product_id if status in _ACTIVE_APPLE_STATUSES else product_id


async def process_apple_notification(signed_payload: str) -> dict[str, Any]:
    """Handle App Store Server Notifications V2 signedPayload."""
    if not signed_payload.strip():
        raise HTTPException(status_code=400, detail="Missing signedPayload")

    outer = _decode_jws_payload(signed_payload.strip())
    notification_type = str(outer.get("notificationType") or "")
    subtype = str(outer.get("subtype") or "")
    data = outer.get("data") or {}
    if not isinstance(data, dict):
        data = {}

    signed_tx = data.get("signedTransactionInfo")
    if not signed_tx:
        logger.info("Apple notification %s/%s without signedTransactionInfo", notification_type, subtype)
        return {"received": True, "type": notification_type, "handled": False}

    tx = _decode_jws_payload(str(signed_tx))
    original_tx_id = str(tx.get("originalTransactionId") or "")
    product_id = str(tx.get("productId") or "")
    expires_at = _ms_to_datetime(tx.get("expiresDate"))
    revocation = _ms_to_datetime(tx.get("revocationDate"))

    db = firestore.Client()
    uid = _firebase_uid_for_original_transaction(db, original_tx_id)
    if not uid:
        app_token = str(tx.get("appAccountToken") or "").strip().lower()
        if app_token:
            # Best-effort: scan is expensive; links should exist after first verify.
            logger.warning(
                "Apple notification for unknown originalTransactionId %s (token=%s)",
                original_tx_id,
                app_token[:8],
            )
        return {"received": True, "type": notification_type, "handled": False, "reason": "unknown_uid"}

    inactive_types = frozenset(
        {
            "EXPIRED",
            "GRACE_PERIOD_EXPIRED",
            "REFUND",
            "REVOKE",
            "DID_FAIL_TO_RENEW",
        }
    )
    if notification_type in inactive_types and subtype != "AUTO_RENEW_ENABLED":
        status = "expired" if notification_type != "REFUND" else "canceled"
        if revocation:
            status = "canceled"
        sync_apple_subscription_to_firestore(
            db,
            uid,
            apple_product_id=product_id,
            apple_original_transaction_id=original_tx_id,
            subscription_status=status,
            apple_expires_at=expires_at,
            apple_transaction_id=str(tx.get("transactionId") or ""),
        )
        return {"received": True, "type": notification_type, "handled": True}

    status = _subscription_status_from_apple(expires_at=expires_at, revocation_date=revocation)
    if notification_type in ("SUBSCRIBED", "DID_RENEW", "DID_CHANGE_RENEWAL_STATUS", "RENEWAL_EXTENDED"):
        sync_apple_subscription_to_firestore(
            db,
            uid,
            apple_product_id=product_id,
            apple_original_transaction_id=original_tx_id,
            subscription_status=status,
            apple_expires_at=expires_at,
            apple_transaction_id=str(tx.get("transactionId") or ""),
        )
        return {"received": True, "type": notification_type, "handled": True}

    logger.info("Unhandled Apple notification type %s/%s", notification_type, subtype)
    return {"received": True, "type": notification_type, "handled": False}
