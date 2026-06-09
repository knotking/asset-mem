"""B2C Stripe Checkout, Customer Portal, and Firestore billing summary updates."""

from __future__ import annotations

import logging
from typing import Any, Optional

import stripe
from google.cloud import firestore
from fastapi import HTTPException

from common.billing_plans import (
    FREE_PLAN_KEY,
    is_checkout_tier,
    plan_for_price,
    stripe_price_id_for_tier,
)
from core.config import settings
from utils.firebase_auth import ensure_firebase_app

logger = logging.getLogger(__name__)


def monthly_token_cap_for_price(price_id: str | None) -> Optional[int]:
    if not price_id or price_id == FREE_PLAN_KEY:
        return None
    raw = settings.STRIPE_B2C_PRICE_TOKEN_CAPS_JSON
    plan = plan_for_price(raw, price_id)
    if plan is None:
        logger.warning("Unknown Stripe price id for B2C caps: %s", price_id)
        return None
    cap = plan.monthly_token_limit
    return cap if cap > 0 else None


def _configure_stripe() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Billing is not configured (missing STRIPE_SECRET_KEY)")
    stripe.api_key = settings.STRIPE_SECRET_KEY


def _stripe_customer_id_from_firestore(db: firestore.Client, uid: str) -> Optional[str]:
    snap = (
        db.collection("users")
        .document(uid)
        .collection("billing")
        .document("summary")
        .get()
    )
    if not snap.exists:
        return None
    raw = (snap.to_dict() or {}).get("stripeCustomerId")
    if not raw:
        return None
    return str(raw).strip() or None


def _firebase_email_for_uid(uid: str) -> Optional[str]:
    """Firebase Auth email for Checkout prefill (may be absent for some providers)."""
    from firebase_admin import auth

    ensure_firebase_app()
    try:
        record = auth.get_user(uid)
        email = (record.email or "").strip()
        return email or None
    except Exception as e:
        logger.debug("Could not load Firebase email for %s: %s", uid, e)
        return None


def _public_base_url() -> str:
    if not settings.BILLING_PUBLIC_APP_BASE_URL:
        raise HTTPException(
            status_code=503,
            detail="Billing is not configured (missing BILLING_PUBLIC_APP_BASE_URL)",
        )
    return settings.BILLING_PUBLIC_APP_BASE_URL.rstrip("/")


def _uid_from_checkout_session(session: Any) -> Optional[str]:
    ref = getattr(session, "client_reference_id", None) or ""
    if ref:
        return str(ref)
    md = getattr(session, "metadata", None) or {}
    if isinstance(md, dict):
        uid = md.get("firebaseUid")
        if uid:
            return str(uid)
    return None


def _uid_from_subscription(sub: Any) -> Optional[str]:
    md = getattr(sub, "metadata", None) or {}
    if isinstance(md, dict):
        uid = md.get("firebaseUid")
        if uid:
            return str(uid)
    return None


def _primary_price_id(sub: Any) -> Optional[str]:
    items = getattr(sub, "items", None)
    if not items:
        return None
    data = getattr(items, "data", None) or []
    if not data:
        return None
    first = data[0]
    price = getattr(first, "price", None)
    if price is None:
        return None
    pid = getattr(price, "id", None)
    return str(pid) if pid else None


def _price_id_from_subscription_dict(obj: dict) -> Optional[str]:
    items = (obj.get("items") or {}).get("data") or []
    if not items:
        return None
    price = items[0].get("price") or {}
    pid = price.get("id")
    return str(pid) if pid else None


def sync_subscription_to_firestore(
    db: firestore.Client,
    uid: str,
    *,
    stripe_customer_id: Optional[str],
    stripe_subscription_id: Optional[str],
    subscription_status: Optional[str],
    price_id: Optional[str],
) -> None:
    ref = db.collection("users").document(uid).collection("billing").document("summary")
    status_l = (subscription_status or "").lower()
    payload: dict[str, Any] = {
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "stripeCustomerId": stripe_customer_id,
        "stripeSubscriptionId": stripe_subscription_id,
        "subscriptionStatus": subscription_status,
        "priceId": price_id,
    }
    if status_l in ("active", "trialing") and price_id:
        plan = plan_for_price(settings.STRIPE_B2C_PRICE_TOKEN_CAPS_JSON, price_id)
        if plan is not None:
            payload["monthlyTokenLimit"] = (
                plan.monthly_token_limit if plan.monthly_token_limit > 0 else None
            )
            payload["monthlyDocumentLimit"] = (
                plan.monthly_document_limit if plan.monthly_document_limit > 0 else None
            )
            payload["monthlyCheckpointLimit"] = (
                plan.monthly_checkpoint_limit if plan.monthly_checkpoint_limit > 0 else None
            )
            payload["monthlyReportGenerationsLimit"] = (
                plan.monthly_report_generations if plan.monthly_report_generations > 0 else None
            )
        else:
            payload["monthlyTokenLimit"] = None
            payload["monthlyDocumentLimit"] = None
            payload["monthlyCheckpointLimit"] = None
            payload["monthlyReportGenerationsLimit"] = None
    else:
        payload["monthlyTokenLimit"] = None
        payload["monthlyDocumentLimit"] = None
        payload["monthlyCheckpointLimit"] = None
        payload["monthlyReportGenerationsLimit"] = None

    ref.set(payload, merge=True)


def create_b2c_checkout_session(db: firestore.Client, uid: str, tier: str) -> dict[str, Any]:
    _configure_stripe()
    tier_key = (tier or "").strip().lower()
    if tier_key == FREE_PLAN_KEY or not is_checkout_tier(
        tier_key, settings.STRIPE_B2C_PRICE_TOKEN_CAPS_JSON
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown or unavailable subscription tier '{tier_key}'. "
                f"Configure a paid tier (e.g. plus, pro) with stripePriceId and positive "
                f"monthlyTokenLimit in STRIPE_B2C_PRICE_TOKEN_CAPS_JSON."
            ),
        )
    price_id = stripe_price_id_for_tier(settings.STRIPE_B2C_PRICE_TOKEN_CAPS_JSON, tier_key)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"Tier '{tier_key}' has no Stripe Price id")
    base = _public_base_url()
    session_kwargs: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": f"{base}/home?billing=success",
        "cancel_url": f"{base}/home/settings?billing=canceled",
        "client_reference_id": uid,
        "metadata": {"firebaseUid": uid},
        "subscription_data": {"metadata": {"firebaseUid": uid}},
    }
    existing_customer = _stripe_customer_id_from_firestore(db, uid)
    if existing_customer:
        session_kwargs["customer"] = existing_customer
    else:
        checkout_email = _firebase_email_for_uid(uid)
        if checkout_email:
            session_kwargs["customer_email"] = checkout_email

    session = stripe.checkout.Session.create(**session_kwargs)
    url = getattr(session, "url", None)
    if not url:
        raise HTTPException(status_code=500, detail="Stripe Checkout did not return a URL")
    return {"status": "ok", "sessionId": session.id, "url": url}


def create_b2c_portal_session(db: firestore.Client, uid: str, return_path: str) -> dict[str, Any]:
    _configure_stripe()
    snap = db.collection("users").document(uid).collection("billing").document("summary").get()
    if not snap.exists:
        raise HTTPException(status_code=400, detail="No billing profile found; subscribe first")
    customer_id = (snap.to_dict() or {}).get("stripeCustomerId")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer on file; subscribe first")
    base = _public_base_url()
    path = return_path if return_path.startswith("/") else f"/{return_path}"
    session = stripe.billing_portal.Session.create(
        customer=str(customer_id),
        return_url=f"{base}{path}",
    )
    url = getattr(session, "url", None)
    if not url:
        raise HTTPException(status_code=500, detail="Stripe Portal did not return a URL")
    return {"status": "ok", "url": url}


def process_stripe_webhook(payload: bytes, sig_header: str | None) -> dict[str, Any]:
    if not settings.STRIPE_WEBHOOK_SIGNING_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook signing secret not configured")
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="STRIPE_SECRET_KEY not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SIGNING_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}") from e
    except Exception as e:
        if type(e).__name__ == "SignatureVerificationError":
            raise HTTPException(status_code=400, detail=f"Invalid signature: {e}") from e
        raise

    etype = event["type"]
    data_object = event["data"]["object"]
    db = firestore.Client()

    if etype == "checkout.session.completed":
        session = stripe.checkout.Session.retrieve(
            data_object["id"],
            expand=["subscription"],
        )
        uid = _uid_from_checkout_session(session)
        sub = getattr(session, "subscription", None)
        if sub is None:
            logger.warning("checkout.session.completed without subscription: %s", data_object.get("id"))
            return {"received": True, "type": etype, "handled": False}
        if isinstance(sub, str):
            sub = stripe.Subscription.retrieve(sub)
        if not uid:
            uid = _uid_from_subscription(sub)
        if not uid:
            logger.error("checkout.session.completed: could not resolve firebase uid for session %s", session.id)
            return {"received": True, "type": etype, "handled": False}
        cust_id = getattr(session, "customer", None) or data_object.get("customer")
        sync_subscription_to_firestore(
            db,
            uid,
            stripe_customer_id=str(cust_id) if cust_id else None,
            stripe_subscription_id=str(sub.id),
            subscription_status=getattr(sub, "status", None),
            price_id=_primary_price_id(sub),
        )
        return {"received": True, "type": etype, "handled": True}

    if etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        if not isinstance(data_object, dict):
            return {"received": True, "type": etype, "handled": False}
        uid = (data_object.get("metadata") or {}).get("firebaseUid")
        if not uid:
            logger.warning(
                "subscription event %s without firebaseUid metadata: %s",
                etype,
                data_object.get("id"),
            )
            return {"received": True, "type": etype, "handled": False}
        cust_id = data_object.get("customer")
        sync_subscription_to_firestore(
            db,
            str(uid),
            stripe_customer_id=str(cust_id) if cust_id else None,
            stripe_subscription_id=str(data_object.get("id") or ""),
            subscription_status=data_object.get("status"),
            price_id=_price_id_from_subscription_dict(data_object),
        )
        return {"received": True, "type": etype, "handled": True}

    return {"received": True, "type": etype, "handled": False}
