from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore
import logging
import time

from common.plan_limits import PlanLimitExceeded, check_and_record_monthly_checkpoint_creations
from common.token import (
    TokenQuotaExceeded,
    check_token_quota_or_raise,
    new_llm_usage_sink,
    persist_firestore_token_totals,
)
from core.auth_deps import RATE_BUCKET_CHECKPOINT, authenticated_user
from utils.plan_limit_http import plan_limit_exceeded_response
from utils.token_quota_http import token_quota_exceeded_response
from core.firebase_auth import apply_uid_to_camel_user_id
from schemas.checkpoint import (
    AnalyzeCheckpointRequest,
    CompareCheckpointsRequest
)
from services.checkpoint_service import (
    compare_checkpoints,
    load_checkpoint_analysis_enqueue_context,
    publish_checkpoint_analysis,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/analyze-checkpoint")
async def analyze_checkpoint_endpoint(
    request_data: AnalyzeCheckpointRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_CHECKPOINT))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    """
    Analyze a property checkpoint image using Gemini AI.
    
    This endpoint publishes the analysis request to Pub/Sub for async processing.
    Returns immediately (202 Accepted). The worker function will process the
    analysis and update Firestore directly. Frontend should listen to Firestore
    changes to see when analysis completes.
    
    Requires: checkpointId, userId, propertyId for Firestore update.
    """
    logger.info("Checkpoint analyze-checkpoint enqueue checkpointId=%s", request_data.checkpointId)
    logger.debug(
        "Checkpoint analyze-checkpoint request content_type=%s imageUrl_len=%s location_set=%s",
        request_data.contentType,
        len(request_data.imageUrl or ""),
        bool((request_data.location or "").strip()),
    )
    try:
        # Validate required fields for Firestore update
        if not request_data.checkpointId or not request_data.userId or not request_data.propertyId:
            raise HTTPException(
                status_code=400,
                detail="checkpointId, userId, and propertyId are required for async processing"
            )

        db = firestore.Client()
        try:
            check_and_record_monthly_checkpoint_creations(db, request_data.userId, 1)
        except PlanLimitExceeded as e:
            return plan_limit_exceeded_response(e)

        enqueue_context = load_checkpoint_analysis_enqueue_context(db, request_data.userId)
        message_id = publish_checkpoint_analysis(
            request_data,
            enqueue_context=enqueue_context,
        )

        logger.info(
            "Checkpoint analysis published message_id=%s checkpointId=%s",
            message_id,
            request_data.checkpointId,
        )

        return {
            "status": "accepted",
            "message": "Analysis queued for processing",
            "checkpointId": request_data.checkpointId
        }

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning("Checkpoint analyze client validation: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Error publishing checkpoint analysis: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compare-checkpoints")
async def compare_checkpoints_endpoint(
    request_data: CompareCheckpointsRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_CHECKPOINT))],
):
    """
    Compare two checkpoint images (previous vs current) using Gemini AI.
    Returns structured comparison data including similarity score, semantic changes, and specific regions of interest.
    """
    db = firestore.Client()
    try:
        check_token_quota_or_raise(db, uid)
    except TokenQuotaExceeded as e:
        return token_quota_exceeded_response(e)

    usage_sink = new_llm_usage_sink()
    try:
        t0 = time.monotonic()
        result = compare_checkpoints(
            image1_url=request_data.image1Url,
            image2_url=request_data.image2Url,
            content_type1=request_data.contentType1,
            content_type2=request_data.contentType2,
            location=request_data.location,
            usage_sink=usage_sink,
        )
        logger.info(
            "compare-checkpoints done duration_ms=%d similarity=%.4f regions=%d semantic_changes=%d",
            int((time.monotonic() - t0) * 1000),
            result.similarityScore,
            len(result.regions),
            len(result.semanticChanges),
        )
        logger.debug(
            "compare-checkpoints image1_len=%d image2_len=%d location_set=%s",
            len(request_data.image1Url or ""),
            len(request_data.image2Url or ""),
            bool((request_data.location or "").strip()),
        )
        return result.model_dump()
    except Exception as e:
        logger.exception("Error comparing checkpoints: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        persist_firestore_token_totals(
            uid,
            usage_sink,
            worker_llm_call_increment=usage_sink.get("gemini_calls", 0),
        )
