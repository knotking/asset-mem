"""
Parse STRIPE_B2C_PRICE_TOKEN_CAPS_JSON for B2C plan limits (free + paid tiers).

Shape (recommended — checkout by tier):

  {
    "free": {
      "monthlyTokenLimit": 1000000,
      "monthlyDocumentLimit": 2,
      "monthlyCheckpointLimit": 5,
      "monthlyReportGenerationsLimit": 2
    },
    "plus": {
      "stripePriceId": "price_xxx",
      "monthlyTokenLimit": 10000000,
      "monthlyDocumentLimit": 10,
      "monthlyCheckpointLimit": 30
    },
    "pro": {
      "stripePriceId": "price_yyy",
      "monthlyTokenLimit": 25000000,
      "monthlyDocumentLimit": 30,
      "monthlyCheckpointLimit": 100
    }
  }

Legacy: top-level key is a Stripe Price id (``price_…``) or integer token cap only.

0 for a limit field means unlimited for that dimension.
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

FREE_PLAN_KEY = "free"
_STRIPE_PRICE_KEY_RE = re.compile(r"^price_")
MONTHLY_REPORT_GENERATIONS_LIMIT_KEY = "monthlyReportGenerationsLimit"
_LEGACY_MONTHLY_REPORT_GENERATIONS_KEY = "monthlyReportGenerations"


@dataclass(frozen=True)
class B2CPricePlan:
    """Resolved plan; ``stripe_price_id`` is set for paid tiers (Checkout + webhooks)."""

    monthly_token_limit: int
    monthly_document_limit: int
    monthly_checkpoint_limit: int
    monthly_report_generations: int = 0
    stripe_price_id: Optional[str] = None


def plans_json_from_env() -> str:
    """Read plan limits JSON from env.

    Cloud Run deploy workflows base64-encode the value (no commas/newlines for gcloud).
    Local ``.env`` may use plain JSON starting with ``{``.
    """
    raw = os.environ.get("STRIPE_B2C_PRICE_TOKEN_CAPS_JSON", "").strip()
    if not raw:
        return ""
    if raw.startswith("{") or raw.startswith("["):
        return raw
    try:
        decoded = base64.b64decode(raw, validate=True).decode("utf-8").strip()
    except (binascii.Error, UnicodeDecodeError) as e:
        logger.warning(
            "STRIPE_B2C_PRICE_TOKEN_CAPS_JSON is not JSON or valid base64: %s", e
        )
        return raw
    if decoded.startswith("{") or decoded.startswith("["):
        return decoded
    logger.warning(
        "STRIPE_B2C_PRICE_TOKEN_CAPS_JSON base64 decoded to non-JSON; using raw env value"
    )
    return raw


def _coerce_limit(value: Any, *, field: str, plan_key: str) -> int:
    if value is None:
        return 0
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        logger.warning(
            "Invalid %s for plan key %s: %r; treating as 0 (unlimited)",
            field,
            plan_key,
            value,
        )
        return 0


def _report_generations_limit_from_entry(value: dict[str, Any], *, plan_key: str) -> int:
    """Prefer ``monthlyReportGenerationsLimit``; fall back to legacy ``monthlyReportGenerations``."""
    raw = value.get(MONTHLY_REPORT_GENERATIONS_LIMIT_KEY)
    if raw is not None:
        return _coerce_limit(
            raw,
            field=MONTHLY_REPORT_GENERATIONS_LIMIT_KEY,
            plan_key=plan_key,
        )
    return _coerce_limit(
        value.get(_LEGACY_MONTHLY_REPORT_GENERATIONS_KEY),
        field=_LEGACY_MONTHLY_REPORT_GENERATIONS_KEY,
        plan_key=plan_key,
    )


def report_generations_limit_from_mapping(data: dict[str, Any]) -> Optional[int]:
    """Read report cap from billing summary or preferences (new key, then legacy)."""
    raw = data.get(MONTHLY_REPORT_GENERATIONS_LIMIT_KEY)
    if raw is None:
        raw = data.get(_LEGACY_MONTHLY_REPORT_GENERATIONS_KEY)
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _stripe_price_id_from_entry(plan_key: str, value: dict[str, Any]) -> Optional[str]:
    raw = value.get("stripePriceId") or value.get("stripe_price_id")
    if raw is not None and str(raw).strip():
        return str(raw).strip()
    if _STRIPE_PRICE_KEY_RE.match(plan_key):
        return plan_key
    return None


def parse_stripe_b2c_price_plans_json(raw: str) -> dict[str, B2CPricePlan]:
    """Return plan key (tier or legacy price id) -> limits. Empty dict if raw is empty or invalid."""
    if not (raw or "").strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Invalid STRIPE_B2C_PRICE_TOKEN_CAPS_JSON: %s", e)
        return {}
    if not isinstance(data, dict):
        logger.error("STRIPE_B2C_PRICE_TOKEN_CAPS_JSON must be a JSON object")
        return {}

    out: dict[str, B2CPricePlan] = {}
    for plan_key, value in data.items():
        key = str(plan_key)
        if key == FREE_PLAN_KEY:
            if isinstance(value, dict):
                out[key] = B2CPricePlan(
                    monthly_token_limit=_coerce_limit(
                        value.get("monthlyTokenLimit"),
                        field="monthlyTokenLimit",
                        plan_key=key,
                    ),
                    monthly_document_limit=_coerce_limit(
                        value.get("monthlyDocumentLimit"),
                        field="monthlyDocumentLimit",
                        plan_key=key,
                    ),
                    monthly_checkpoint_limit=_coerce_limit(
                        value.get("monthlyCheckpointLimit"),
                        field="monthlyCheckpointLimit",
                        plan_key=key,
                    ),
                    monthly_report_generations=_report_generations_limit_from_entry(
                        value, plan_key=key
                    ),
                    stripe_price_id=None,
                )
            continue
        if isinstance(value, int):
            out[key] = B2CPricePlan(
                monthly_token_limit=max(0, value),
                monthly_document_limit=0,
                monthly_checkpoint_limit=0,
                monthly_report_generations=0,
                stripe_price_id=key if _STRIPE_PRICE_KEY_RE.match(key) else None,
            )
            continue
        if isinstance(value, dict):
            out[key] = B2CPricePlan(
                monthly_token_limit=_coerce_limit(
                    value.get("monthlyTokenLimit"),
                    field="monthlyTokenLimit",
                    plan_key=key,
                ),
                monthly_document_limit=_coerce_limit(
                    value.get("monthlyDocumentLimit"),
                    field="monthlyDocumentLimit",
                    plan_key=key,
                ),
                monthly_checkpoint_limit=_coerce_limit(
                    value.get("monthlyCheckpointLimit"),
                    field="monthlyCheckpointLimit",
                    plan_key=key,
                ),
                monthly_report_generations=_report_generations_limit_from_entry(
                    value, plan_key=key
                ),
                stripe_price_id=_stripe_price_id_from_entry(key, value),
            )
            continue
        logger.warning("Skipping invalid plan entry for key %s: %r", key, value)
    return out


def free_tier_plan(raw: str | None = None) -> Optional[B2CPricePlan]:
    """Limits for users without an active Stripe subscription."""
    source = plans_json_from_env() if raw is None else (raw or "").strip()
    if not source:
        return None
    return parse_stripe_b2c_price_plans_json(source).get(FREE_PLAN_KEY)


def plan_for_tier(raw: str | None, tier: str | None) -> Optional[B2CPricePlan]:
    """Lookup by tier key (e.g. ``plus``, ``pro``). Does not resolve ``free``."""
    if not tier or tier == FREE_PLAN_KEY:
        return None
    source = plans_json_from_env() if raw is None else (raw or "").strip()
    if not source:
        return None
    return parse_stripe_b2c_price_plans_json(source).get(str(tier).strip().lower())


def plan_for_price(raw: str | None, price_id: str | None) -> Optional[B2CPricePlan]:
    """Stripe Price id lookup (webhooks). Matches legacy price-key entries or ``stripePriceId``."""
    if not price_id or price_id == FREE_PLAN_KEY:
        return None
    source = plans_json_from_env() if raw is None else (raw or "").strip()
    if not source:
        return None
    plans = parse_stripe_b2c_price_plans_json(source)
    pid = str(price_id)
    direct = plans.get(pid)
    if direct is not None:
        return direct
    for plan in plans.values():
        if plan.stripe_price_id == pid:
            return plan
    return None


def stripe_price_id_for_tier(raw: str | None, tier: str) -> Optional[str]:
    """Stripe Price id for Checkout, or None if tier is missing / not billable."""
    plan = plan_for_tier(raw, tier)
    if plan is None or plan.monthly_token_limit <= 0:
        return None
    return plan.stripe_price_id


def is_checkout_tier(tier: str, raw: str | None = None) -> bool:
    """True if tier resolves to a paid plan with a Stripe Price id and positive token cap."""
    return stripe_price_id_for_tier(raw, tier) is not None


def is_stripe_checkout_price_id(price_id: str, raw: str | None = None) -> bool:
    """True if price_id is configured for Checkout (legacy price-id clients)."""
    plan = plan_for_price(raw, price_id)
    return (
        plan is not None
        and plan.monthly_token_limit > 0
        and bool(plan.stripe_price_id)
    )
