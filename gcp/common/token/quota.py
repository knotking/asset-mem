"""
Per-user token quota (calendar month, UTC) enforced before LLM / Reasoning Engine calls.

Limit resolution:
  1. users/{userId}/preferences/user.monthlyTokenLimit (positive int) if set
  2. else TOKEN_QUOTA_PERIOD_MAX_TOKENS env (positive int)
  3. else unlimited (0)

Usage for the current period is read from llm_token_usage.periodTotalTokens when
quotaPeriodKey matches the current YYYY-MM; otherwise treated as 0.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from google.cloud import firestore

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


def _env_period_max_tokens() -> int:
    raw = os.environ.get("TOKEN_QUOTA_PERIOD_MAX_TOKENS", "").strip()
    if not raw:
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        logger.warning("Invalid TOKEN_QUOTA_PERIOD_MAX_TOKENS=%r; treating as 0", raw)
        return 0


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
    override = _preferences_monthly_limit(db, user_id)
    if override is not None:
        return override
    return _env_period_max_tokens()


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
