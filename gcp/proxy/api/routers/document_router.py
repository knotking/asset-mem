"""
Document Router

Document analysis endpoints (can be used independently or via Firebase router).
"""

import logging
from fastapi import APIRouter, Request, HTTPException, status

from models import ExtractDocInfoRequest
from document_analysis import extract_doc_info
from dependencies import get_request_id, verify_webhook_secret
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/extract-info")
async def extract_document_info(request: Request):
    """
    Extract structured information from property documents using Gemini AI.
    
    This endpoint analyzes documents and extracts:
    - Document type (DEED, INSURANCE_POLICY, etc.)
    - Property address (normalized)
    - Key entities (policy numbers, dates, amounts)
    - Summary
    
    Request body:
    {
        "docUrl": "https://storage.googleapis.com/.../document.pdf",
        "contentType": "application/pdf"
    }
    """
    # Verify webhook secret (optional - can be made public if needed)
    if settings.firebase_webhook_secret:
        if not verify_webhook_secret(request, settings.firebase_webhook_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook secret"
            )
    
    logger.info("Document analysis endpoint received a request.")
    request_id = get_request_id(request)
    
    try:
        data = await request.json()
        doc_request = ExtractDocInfoRequest(**data)
        logger.info(f"Analyzing document: {doc_request.docUrl}", extra={"request_id": request_id})

        result = extract_doc_info(doc_request)

        logger.info(f"Analysis complete: {result.documentType.value}", extra={"request_id": request_id})
        return result.model_dump()

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}", extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing document analysis: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
