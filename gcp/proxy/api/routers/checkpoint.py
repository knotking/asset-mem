from fastapi import APIRouter
import logging
from schemas.checkpoint import (
    AnalyzeCheckpointRequest,
    CompareCheckpointsRequest
)
from checkpoint_analysis import analyze_checkpoint
from checkpoint_comparison import compare_checkpoints

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/analyze-checkpoint")
async def analyze_checkpoint_endpoint(request_data: AnalyzeCheckpointRequest):
    """
    Analyze a property checkpoint image using Gemini AI.
    """
    logger.info("Checkpoint analysis endpoint received a request.")
    try:
        logger.info(f"Analyzing checkpoint image: {request_data.imageUrl}")

        result = analyze_checkpoint(request_data)

        logger.info("Analysis complete")
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error processing checkpoint analysis: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/compare-checkpoints")
async def compare_checkpoints_endpoint(request_data: CompareCheckpointsRequest):
    """
    Compare two property checkpoint images using Gemini AI.
    """
    logger.info("Checkpoint comparison endpoint received a request.")
    try:
        logger.info(f"Comparing checkpoints: {request_data.image1Url} vs {request_data.image2Url}")

        result = compare_checkpoints(
            image1_url=request_data.image1Url,
            image2_url=request_data.image2Url,
            content_type1=request_data.contentType1,
            content_type2=request_data.contentType2,
            location=request_data.location
        )

        logger.info("Comparison complete")
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error processing checkpoint comparison: {e}")
        return {"status": "error", "message": str(e)}

