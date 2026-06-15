"""
Monthly UTC creation limits for documents and checkpoints (B2C plans).

Counters live on ``llm_token_usage/{userId}``:
  - ``periodDocumentCreations``
  - ``periodCheckpointCreations``

Limit resolution (per dimension, 0 = unlimited):
  1. Active Stripe ``users/{userId}/billing/summary`` fields
  2. ``users/{userId}/preferences/user`` overrides
  3. ``STRIPE_B2C_PRICE_TOKEN_CAPS_JSON`` → ``free`` plan (or builtin defaults if missing)

Report caps use ``monthlyReportGenerationsLimit`` (legacy ``monthlyReportGenerations`` accepted).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Optional

from google.cloud import firestore

from common.billing_plans import (
    B2CPricePlan,
    free_tier_plan,
    report_generations_limit_from_mapping,
)

from common.token import PERIODS_SUBCOLLECTION, TOKEN_USAGE_COLLECTION, current_quota_period_key

logger = logging.getLogger(__name__)

CreationKind = Literal["document", "checkpoint", "report"]

_PERIOD_DOC_FIELD = "periodDocumentCreations"
_PERIOD_CP_FIELD = "periodCheckpointCreations"
_PERIOD_REPORT_FIELD = "periodReportGenerations"
_LIFETIME_DOC_FIELD = "documentCreations"
_LIFETIME_CP_FIELD = "checkpointCreations"
_LIFETIME_REPORT_FIELD = "reportGenerations"


class PlanLimitExceeded(Exception):
    """Raised when a monthly creation limit would be exceeded."""

    def __init__(
        self,
        *,
        kind: CreationKind,
        used: int,
        limit: int,
        period_key: str,
        requested: int = 1,
    ):
        self.kind = kind
        self.used = used
        self.limit = limit
        self.period_key = period_key
        self.requested = requested
        super().__init__(
            f"{kind} creation limit exceeded for {period_key}: "
            f"{used} + {requested} > {limit}"
        )

    @property
    def error_code(self) -> str:
        if self.kind == "document":
            return "DOCUMENT_QUOTA_EXCEEDED"
        if self.kind == "checkpoint":
            return "CHECKPOINT_QUOTA_EXCEEDED"
        return "REPORT_QUOTA_EXCEEDED"


@dataclass(frozen=True)
class MonthlyCreationLimits:
    document_limit: int
    checkpoint_limit: int
    report_limit: int


def _free_tier_plan() -> B2CPricePlan:
    return free_tier_plan()


def _free_tier_defaults() -> MonthlyCreationLimits:
    plan = _free_tier_plan()
    return MonthlyCreationLimits(
        document_limit=plan.monthly_document_limit,
        checkpoint_limit=plan.monthly_checkpoint_limit,
        report_limit=plan.monthly_report_generations,
    )


def _billing_summary(db: firestore.Client, user_id: str) -> Optional[dict]:
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
        return data
    except Exception as e:
        logger.debug("Could not read billing summary for %s: %s", user_id, e)
        return None


def _preferences(db: firestore.Client, user_id: str) -> dict:
    try:
        snap = (
            db.collection("users")
            .document(user_id)
            .collection("preferences")
            .document("user")
            .get()
        )
        return snap.to_dict() if snap.exists else {}
    except Exception as e:
        logger.debug("Could not read preferences for %s: %s", user_id, e)
        return {}


def _resolve_limit(
    billing_value: Optional[int],
    pref_value: Optional[int],
    free_default: int,
) -> int:
    if billing_value is not None and billing_value > 0:
        return billing_value
    if pref_value is not None and pref_value > 0:
        return pref_value
    return free_default


def resolve_monthly_document_limit(db: firestore.Client, user_id: str) -> int:
    """0 means unlimited."""
    free_limits = _free_tier_defaults()
    billing = _billing_summary(db, user_id)
    prefs = _preferences(db, user_id)
    billing_lim = None
    if billing is not None:
        raw = billing.get("monthlyDocumentLimit")
        if raw is not None:
            try:
                billing_lim = int(raw)
            except (TypeError, ValueError):
                billing_lim = None
    pref_lim = None
    raw_pref = prefs.get("monthlyDocumentLimit")
    if raw_pref is not None:
        try:
            pref_lim = int(raw_pref)
        except (TypeError, ValueError):
            pref_lim = None
    return _resolve_limit(
        billing_lim if billing_lim and billing_lim > 0 else None,
        pref_lim if pref_lim and pref_lim > 0 else None,
        free_limits.document_limit,
    )


def resolve_monthly_report_generations_limit(db: firestore.Client, user_id: str) -> int:
    """0 means unlimited."""
    free_limits = _free_tier_defaults()
    billing = _billing_summary(db, user_id)
    prefs = _preferences(db, user_id)
    billing_lim = None
    if billing is not None:
        billing_lim = report_generations_limit_from_mapping(billing)
    pref_lim = report_generations_limit_from_mapping(prefs)
    return _resolve_limit(
        billing_lim if billing_lim and billing_lim > 0 else None,
        pref_lim if pref_lim and pref_lim > 0 else None,
        free_limits.report_limit,
    )


def resolve_monthly_checkpoint_limit(db: firestore.Client, user_id: str) -> int:
    """0 means unlimited."""
    free_limits = _free_tier_defaults()
    billing = _billing_summary(db, user_id)
    prefs = _preferences(db, user_id)
    billing_lim = None
    if billing is not None:
        raw = billing.get("monthlyCheckpointLimit")
        if raw is not None:
            try:
                billing_lim = int(raw)
            except (TypeError, ValueError):
                billing_lim = None
    pref_lim = None
    raw_pref = prefs.get("monthlyCheckpointLimit")
    if raw_pref is not None:
        try:
            pref_lim = int(raw_pref)
        except (TypeError, ValueError):
            pref_lim = None
    return _resolve_limit(
        billing_lim if billing_lim and billing_lim > 0 else None,
        pref_lim if pref_lim and pref_lim > 0 else None,
        free_limits.checkpoint_limit,
    )


def _effective_period_count(usage_doc: Optional[dict], period_key: str, field: str) -> int:
    if not usage_doc:
        return 0
    if usage_doc.get("quotaPeriodKey") != period_key:
        return 0
    try:
        return int(usage_doc.get(field) or 0)
    except (TypeError, ValueError):
        return 0


def get_plan_limits_status(
    db: firestore.Client,
    user_id: str,
) -> dict:
    period_key = current_quota_period_key()
    doc_limit = resolve_monthly_document_limit(db, user_id)
    cp_limit = resolve_monthly_checkpoint_limit(db, user_id)
    report_limit = resolve_monthly_report_generations_limit(db, user_id)
    snap = db.collection(TOKEN_USAGE_COLLECTION).document(user_id).get()
    data = snap.to_dict() if snap.exists else None
    docs_used = _effective_period_count(data, period_key, _PERIOD_DOC_FIELD)
    cp_used = _effective_period_count(data, period_key, _PERIOD_CP_FIELD)
    reports_used = _effective_period_count(data, period_key, _PERIOD_REPORT_FIELD)
    return {
        "period": period_key,
        "documents": {
            "used": docs_used,
            "limit": doc_limit,
            "unlimited": doc_limit <= 0,
        },
        "checkpoints": {
            "used": cp_used,
            "limit": cp_limit,
            "unlimited": cp_limit <= 0,
        },
        "reports": {
            "used": reports_used,
            "limit": report_limit,
            "unlimited": report_limit <= 0,
        },
    }


def _period_key_archivable(stored_key: object, current_key: str) -> bool:
    if not isinstance(stored_key, str) or stored_key == current_key:
        return False
    if len(stored_key) != 7 or stored_key[4] != "-":
        return False
    return True


def _coerce_int_field(value: object) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def check_monthly_document_creations_allowed(
    db: firestore.Client,
    user_id: str,
    count: int = 1,
) -> None:
    """Read-only quota check (no counter increment). Use when creation was already recorded."""
    if not user_id or count <= 0:
        return
    _assert_creations_allowed(db, user_id, kind="document", count=count)


def check_monthly_checkpoint_creations_allowed(
    db: firestore.Client,
    user_id: str,
    count: int = 1,
) -> None:
    if not user_id or count <= 0:
        return
    _assert_creations_allowed(db, user_id, kind="checkpoint", count=count)


def check_and_record_monthly_document_creations(
    db: firestore.Client,
    user_id: str,
    count: int = 1,
) -> None:
    if not user_id or count <= 0:
        return
    _check_and_record_creations(db, user_id, kind="document", count=count)


def check_and_record_monthly_checkpoint_creations(
    db: firestore.Client,
    user_id: str,
    count: int = 1,
) -> None:
    if not user_id or count <= 0:
        return
    _check_and_record_creations(db, user_id, kind="checkpoint", count=count)


def check_monthly_report_generations_allowed(
    db: firestore.Client,
    user_id: str,
    count: int = 1,
) -> None:
    if not user_id or count <= 0:
        return
    _assert_creations_allowed(db, user_id, kind="report", count=count)


def check_and_record_monthly_report_generations(
    db: firestore.Client,
    user_id: str,
    count: int = 1,
) -> None:
    if not user_id or count <= 0:
        return
    _check_and_record_creations(db, user_id, kind="report", count=count)


def release_monthly_report_generations(
    db: firestore.Client,
    user_id: str,
    count: int = 1,
) -> None:
    """Reverse a prior report quota record when generation fails after recording."""
    if not user_id or count <= 0:
        return
    period_key = current_quota_period_key()
    ref = db.collection(TOKEN_USAGE_COLLECTION).document(user_id)

    @firestore.transactional
    def _tx(transaction, doc_ref, p_period_key: str, p_count: int):
        snap = doc_ref.get(transaction=transaction)
        if not snap.exists:
            return
        data = snap.to_dict() or {}
        if data.get("quotaPeriodKey") != p_period_key:
            return
        period_used = _coerce_int_field(data.get(_PERIOD_REPORT_FIELD))
        if period_used <= 0:
            return
        dec = min(p_count, period_used)
        lifetime_used = _coerce_int_field(data.get(_LIFETIME_REPORT_FIELD))
        lifetime_dec = min(dec, lifetime_used) if lifetime_used > 0 else dec
        transaction.update(
            doc_ref,
            {
                "updatedAt": firestore.SERVER_TIMESTAMP,
                _PERIOD_REPORT_FIELD: firestore.Increment(-dec),
                _LIFETIME_REPORT_FIELD: firestore.Increment(-lifetime_dec),
            },
        )

    _tx(db.transaction(), ref, period_key, count)


def _assert_creations_allowed(
    db: firestore.Client,
    user_id: str,
    *,
    kind: CreationKind,
    count: int,
) -> None:
    period_key = current_quota_period_key()
    if kind == "document":
        limit = resolve_monthly_document_limit(db, user_id)
        period_field = _PERIOD_DOC_FIELD
    elif kind == "checkpoint":
        limit = resolve_monthly_checkpoint_limit(db, user_id)
        period_field = _PERIOD_CP_FIELD
    else:
        limit = resolve_monthly_report_generations_limit(db, user_id)
        period_field = _PERIOD_REPORT_FIELD

    if limit <= 0:
        return

    snap = db.collection(TOKEN_USAGE_COLLECTION).document(user_id).get()
    data = snap.to_dict() if snap.exists else None
    used = _effective_period_count(data, period_key, period_field)
    if used + count > limit:
        raise PlanLimitExceeded(
            kind=kind,
            used=used,
            limit=limit,
            period_key=period_key,
            requested=count,
        )


def _check_and_record_creations(
    db: firestore.Client,
    user_id: str,
    *,
    kind: CreationKind,
    count: int,
) -> None:
    period_key = current_quota_period_key()
    if kind == "document":
        limit = resolve_monthly_document_limit(db, user_id)
        period_field = _PERIOD_DOC_FIELD
        lifetime_field = _LIFETIME_DOC_FIELD
    elif kind == "checkpoint":
        limit = resolve_monthly_checkpoint_limit(db, user_id)
        period_field = _PERIOD_CP_FIELD
        lifetime_field = _LIFETIME_CP_FIELD
    else:
        limit = resolve_monthly_report_generations_limit(db, user_id)
        period_field = _PERIOD_REPORT_FIELD
        lifetime_field = _LIFETIME_REPORT_FIELD

    if limit <= 0:
        _increment_creation_counters(db, user_id, period_key, period_field, lifetime_field, count)
        return

    ref = db.collection(TOKEN_USAGE_COLLECTION).document(user_id)

    @firestore.transactional
    def _tx(transaction, doc_ref, p_period_key: str, p_count: int, p_limit: int):
        snap = doc_ref.get(transaction=transaction)
        data = snap.to_dict() if snap.exists else {}
        stored_key = data.get("quotaPeriodKey")
        new_period = stored_key != p_period_key or not snap.exists
        used = 0 if new_period else _coerce_int_field(data.get(period_field))

        if used + p_count > p_limit:
            raise PlanLimitExceeded(
                kind=kind,
                used=used,
                limit=p_limit,
                period_key=p_period_key,
                requested=p_count,
            )

        if not snap.exists:
            transaction.set(
                doc_ref,
                {
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                    "quotaPeriodKey": p_period_key,
                    period_field: p_count,
                    lifetime_field: p_count,
                },
            )
            return

        updates: dict = {
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "quotaPeriodKey": p_period_key,
            lifetime_field: firestore.Increment(p_count),
        }
        if new_period:
            updates[period_field] = p_count
        else:
            updates[period_field] = firestore.Increment(p_count)

        if new_period and snap.exists and _period_key_archivable(stored_key, p_period_key):
            period_ref = doc_ref.collection(PERIODS_SUBCOLLECTION).document(str(stored_key))
            prior = period_ref.get(transaction=transaction)
            if not prior.exists:
                transaction.set(
                    period_ref,
                    {
                        "quotaPeriodKey": stored_key,
                        "periodDocumentCreations": _coerce_int_field(
                            data.get(_PERIOD_DOC_FIELD)
                        ),
                        "periodCheckpointCreations": _coerce_int_field(
                            data.get(_PERIOD_CP_FIELD)
                        ),
                        "periodReportGenerations": _coerce_int_field(
                            data.get(_PERIOD_REPORT_FIELD)
                        ),
                        "archivedAt": firestore.SERVER_TIMESTAMP,
                    },
                    merge=True,
                )

        transaction.update(doc_ref, updates)

    try:
        _tx(db.transaction(), ref, period_key, count, limit)
    except PlanLimitExceeded:
        logger.info(
            "Plan limit block user=%s kind=%s period=%s count=%s limit=%s",
            user_id,
            kind,
            period_key,
            count,
            limit,
        )
        raise


def _increment_creation_counters(
    db: firestore.Client,
    user_id: str,
    period_key: str,
    period_field: str,
    lifetime_field: str,
    count: int,
) -> None:
    ref = db.collection(TOKEN_USAGE_COLLECTION).document(user_id)

    @firestore.transactional
    def _tx(transaction, doc_ref, p_period_key: str, p_count: int):
        snap = doc_ref.get(transaction=transaction)
        data = snap.to_dict() if snap.exists else {}
        stored_key = data.get("quotaPeriodKey")
        new_period = stored_key != p_period_key or not snap.exists

        if not snap.exists:
            transaction.set(
                doc_ref,
                {
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                    "quotaPeriodKey": p_period_key,
                    period_field: p_count,
                    lifetime_field: p_count,
                },
            )
            return

        updates: dict = {
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "quotaPeriodKey": p_period_key,
            lifetime_field: firestore.Increment(p_count),
        }
        if new_period:
            updates[period_field] = p_count
        else:
            updates[period_field] = firestore.Increment(p_count)
        transaction.update(doc_ref, updates)

    _tx(db.transaction(), ref, period_key, count)
