"""
Per-user token quota (calendar month, UTC) enforced before LLM / Reasoning Engine calls.

Limit resolution:
  1. B2C Stripe: users/{userId}/billing/summary when subscriptionStatus is active/trialing
     and monthlyTokenLimit is a positive int (set by proxy webhooks from Stripe Price id map)
  2. users/{userId}/preferences/user.monthlyTokenLimit (positive int) if set
  3. else STRIPE_B2C_PRICE_TOKEN_CAPS_JSON → ``free`` plan (or builtin defaults if missing)
  4. else unlimited (0)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from google.cloud import firestore

from common.billing_plans import free_tier_plan

from .constants import TOKEN_USAGE_COLLECTION

logger = logging.getLogger(__name__)


class TokenQuotaExceeded(Exception):
    """Raised when the user's period token usage is at or over their limit."""

    def __init__(self, used: int, limit: int, period_key: str):
        self.used = used
        self.limit = limit
        self.period_key = period_key
        super().__init__(
            f"Token quota exceeded for {period_key}: {used} >= {limit}"
        )


def current_quota_period_key(now: Optional[datetime] = None) -> str:
    dt = now or datetime.now(timezone.utc)
    return f"{dt.year:04d}-{dt.month:02d}"


def _free_tier_token_limit() -> int:
    cap = free_tier_plan().monthly_token_limit
    return cap if cap > 0 else 0


def _b2c_billing_monthly_limit(db: firestore.Client, user_id: str) -> Optional[int]:
    """Stripe-backed individual cap from Firestore (written by proxy webhooks only)."""
    try:
        snap = (
            db.collection("users")
            .document(user_id)
            .collection("billing")
            .document("summary")
            .get()
        )
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        status = str(data.get("subscriptionStatus") or "").lower()
        if status not in ("active", "trialing"):
            return None
        raw = data.get("monthlyTokenLimit")
        if raw is None:
            return None
        n = int(raw)
        return n if n > 0 else None
    except Exception as e:
        logger.debug("Could not read billing summary for %s: %s", user_id, e)
        return None


def _preferences_monthly_limit(db: firestore.Client, user_id: str) -> Optional[int]:
    try:
        pref = (
            db.collection("users")
            .document(user_id)
            .collection("preferences")
            .document("user")
            .get()
        )
        if not pref.exists:
            return None
        raw = (pref.to_dict() or {}).get("monthlyTokenLimit")
        if raw is None:
            return None
        n = int(raw)
        return n if n > 0 else None
    except Exception as e:
        logger.debug("Could not read monthlyTokenLimit for %s: %s", user_id, e)
        return None


def resolve_token_quota_limit(db: firestore.Client, user_id: str) -> int:
    """0 means unlimited."""
    stripe_cap = _b2c_billing_monthly_limit(db, user_id)
    if stripe_cap is not None:
        return stripe_cap
    override = _preferences_monthly_limit(db, user_id)
    if override is not None:
        return override
    return _free_tier_token_limit()


def effective_period_token_usage(
    usage_doc: Optional[dict],
    period_key: str,
) -> int:
    if not usage_doc:
        return 0
    if usage_doc.get("quotaPeriodKey") != period_key:
        return 0
    try:
        return int(usage_doc.get("periodTotalTokens") or 0)
    except (TypeError, ValueError):
        return 0


def get_token_quota_status(
    db: firestore.Client,
    user_id: str,
) -> tuple[int, int, str]:
    """
    Returns (used_this_period, limit, period_key).
    limit 0 => unlimited (used check always passes).
    """
    period_key = current_quota_period_key()
    limit = resolve_token_quota_limit(db, user_id)
    snap = db.collection(TOKEN_USAGE_COLLECTION).document(user_id).get()
    data = snap.to_dict() if snap.exists else None
    used = effective_period_token_usage(data, period_key)
    return used, limit, period_key


def check_token_quota_or_raise(db: firestore.Client, user_id: str) -> None:
    if not user_id:
        return
    used, limit, period_key = get_token_quota_status(db, user_id)
    if limit <= 0:
        return
    if used >= limit:
        logger.info(
            "Token quota block user=%s period=%s used=%s limit=%s",
            user_id,
            period_key,
            used,
            limit,
        )
        raise TokenQuotaExceeded(used=used, limit=limit, period_key=period_key)
