"""Token quota status for UI (same resolution as enforcement)."""

import logging
from typing import Annotated

from google.cloud import firestore
from fastapi import APIRouter, Depends

from common.plan_limits import get_plan_limits_status
from common.token import get_token_quota_status
from core.auth_deps import RATE_BUCKET_QUOTA, authenticated_user
from core.firebase_auth import apply_uid_to_agent_request
from schemas.token_quota import TokenQuotaStatusRequest

router = APIRouter(tags=["Token quota"])
logger = logging.getLogger(__name__)


@router.post(
    "/token-quota-status",
    summary="Token quota status",
    description=(
        "Returns resolved monthly max tokens (0 = unlimited), document/checkpoint creation "
        "limits and usage for the current UTC month. Same billing resolution as enforcement."
    ),
)
async def token_quota_status(
    request_data: TokenQuotaStatusRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_QUOTA))],
):
    apply_uid_to_agent_request(request_data, uid)
    db = firestore.Client()
    used, cap, period_key = get_token_quota_status(db, request_data.user_id)
    unlimited = cap <= 0
    plan_limits = get_plan_limits_status(db, request_data.user_id)
    return {
        "status": "success",
        "period": period_key,
        "used": used,
        "max_tokens": cap,
        "unlimited": unlimited,
        "documents": plan_limits["documents"],
        "checkpoints": plan_limits["checkpoints"],
    }
