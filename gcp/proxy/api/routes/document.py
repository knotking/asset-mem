from fastapi import APIRouter, HTTPException
from document_analysis import extract_doc_info
from models import ExtractDocInfoRequest, ExtractDocInfoResponse

router = APIRouter()

@router.post("/document/analyze", response_model=ExtractDocInfoResponse)
async def analyze_document(request: ExtractDocInfoRequest):
    """
    Analyze a document using Vertex AI.
    """
    try:
        return extract_doc_info(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
