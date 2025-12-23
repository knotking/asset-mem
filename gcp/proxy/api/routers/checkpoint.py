from fastapi import APIRouter, HTTPException
import logging
from schemas.checkpoint import (
    AnalyzeCheckpointRequest,
    CompareCheckpointsRequest
)
from services.checkpoint_service import publish_checkpoint_analysis, compare_checkpoints

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/analyze-checkpoint")
async def analyze_checkpoint_endpoint(request_data: AnalyzeCheckpointRequest):
    """
    Analyze a property checkpoint image using Gemini AI.
    
    This endpoint publishes the analysis request to Pub/Sub for async processing.
    Returns immediately (202 Accepted). The worker function will process the
    analysis and update Firestore directly. Frontend should listen to Firestore
    changes to see when analysis completes.
    
    Requires: checkpointId, userId, propertyId for Firestore update.
    """
    logger.info("Checkpoint analysis endpoint received a request.")
    try:
        # Validate required fields for Firestore update
        if not request_data.checkpointId or not request_data.userId or not request_data.propertyId:
            raise HTTPException(
                status_code=400,
                detail="checkpointId, userId, and propertyId are required for async processing"
            )

        logger.info(f"Publishing checkpoint analysis request: checkpointId={request_data.checkpointId}")

        # Publish to Pub/Sub topic for async processing
        message_id = publish_checkpoint_analysis(request_data)

        logger.info(f"Checkpoint analysis published to Pub/Sub: {message_id}")

        return {
            "status": "accepted",
            "message": "Analysis queued for processing",
            "checkpointId": request_data.checkpointId
        }

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error publishing checkpoint analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compare-checkpoints")
async def compare_checkpoints_endpoint(request_data: CompareCheckpointsRequest):
    """
    Compare two checkpoint images (previous vs current) using Gemini AI.
    Returns structured comparison data including similarity score, semantic changes, and specific regions of interest.
    """
    try:
        result = compare_checkpoints(
            image1_url=request_data.image1Url,
            image2_url=request_data.image2Url,
            content_type1=request_data.contentType1,
            content_type2=request_data.contentType2,
            location=request_data.location
        )
        logger.info("Comparison complete")
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error comparing checkpoints: {e}")
        raise HTTPException(status_code=500, detail=str(e))
