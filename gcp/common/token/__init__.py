"""
LLM token usage (Firestore) and per-user monthly quotas.

Import from this package only, e.g. ``from common.token import persist_firestore_token_totals``.
"""

from .constants import PERIODS_SUBCOLLECTION, TOKEN_USAGE_COLLECTION
from .genai import (
    accumulate_google_genai_embed_response,
    accumulate_google_genai_generate_response,
    new_llm_usage_sink,
)
from .persist import persist_firestore_token_totals
from .quota import (
    TokenQuotaExceeded,
    check_token_quota_or_raise,
    current_quota_period_key,
    effective_period_token_usage,
    get_token_quota_status,
    resolve_token_quota_limit,
)

__all__ = [
    "PERIODS_SUBCOLLECTION",
    "TOKEN_USAGE_COLLECTION",
    "TokenQuotaExceeded",
    "accumulate_google_genai_embed_response",
    "accumulate_google_genai_generate_response",
    "check_token_quota_or_raise",
    "current_quota_period_key",
    "effective_period_token_usage",
    "get_token_quota_status",
    "new_llm_usage_sink",
    "persist_firestore_token_totals",
    "resolve_token_quota_limit",
]
