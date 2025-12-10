from fastapi import APIRouter
import logging
from schemas.agent import AgentRequest
from schemas.document import ExtractDocInfoRequest
from services.agent_service import handle_firebase_file_upload
from services.document_service import extract_doc_info

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/rag-file-upload")
async def firebase_webhook_file_upload(request_data: AgentRequest):
    logger.info(f"Firebase webhook file upload data: {request_data.model_dump_json()}")
    try:
        return handle_firebase_file_upload(request_data)
    except Exception as e:
        logger.error(f"Error processing Firebase webhook: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/extract-doc-info")
async def extract_document_info_endpoint(request_data: ExtractDocInfoRequest):
    logger.info(f"Analyzing document: {request_data.docUrl}")
    try:
        result = extract_doc_info(request_data)
        logger.info(f"Analysis complete: {result.documentType.value}")
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error processing document analysis: {e}")
        return {"status": "error", "message": str(e)}
