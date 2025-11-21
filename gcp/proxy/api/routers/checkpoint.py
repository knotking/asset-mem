from fastapi import APIRouter
import logging
from schemas.checkpoint import AnalyzeCheckpointRequest
from checkpoint_analysis import analyze_checkpoint

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

