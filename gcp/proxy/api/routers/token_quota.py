"""Token quota status for UI (same resolution as enforcement)."""

import logging
from google.cloud import firestore
from fastapi import APIRouter

from common.token import get_token_quota_status
from schemas.token_quota import TokenQuotaStatusRequest

router = APIRouter(tags=["Token quota"])
logger = logging.getLogger(__name__)


@router.post(
    "/token-quota-status",
    summary="Token quota status",
    description=(
        "Returns resolved monthly max tokens (0 = unlimited) and usage for the current UTC month. "
        "Same rules as enforcement: preferences override, then TOKEN_QUOTA_PERIOD_MAX_TOKENS."
    ),
)
async def token_quota_status(request_data: TokenQuotaStatusRequest):
    db = firestore.Client()
    used, cap, period_key = get_token_quota_status(db, request_data.user_id)
    unlimited = cap <= 0
    return {
        "status": "success",
        "period": period_key,
        "used": used,
        "max_tokens": cap,
        "unlimited": unlimited,
    }
