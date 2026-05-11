"""
Shared Gemini document field extraction for the proxy and document-analysis worker.

Returns a plain dict compatible with Firestore and ExtractDocInfoResponse.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional, Tuple

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def _get_client() -> genai.Client | None:
    global _client
    if _client is not None:
        return _client
    project_id = os.environ.get("GCP_PROJECT_ID")
    if not project_id:
        logger.error("GCP_PROJECT_ID not set; cannot initialize Gemini client for document extraction")
        return None
    try:
        _client = genai.Client(vertexai=True, project=project_id, location="global")
        logger.info("Google Gen AI SDK initialized for document extraction (vertex, global)")
    except Exception as e:
        logger.error("Failed to initialize Google Gen AI SDK: %s", e, exc_info=True)
        _client = None
    return _client


def extract_document_fields(doc_url: str, content_type: str) -> Tuple[dict[str, Any], Optional[Any]]:
    """
    Call Gemini to extract documentType, propertyAddress, keyEntities, summary.

    Returns (fields_dict, raw_generate_content_response_or_none).
    On hard failure fields_dict is a safe fallback; raw response is None.
    """
    client = _get_client()
    if not client:
        return _fallback_result("Google Gen AI SDK not initialized"), None

    prompt = """You are an expert real estate document analyst. Your task is to extract key information from the provided property document and return it in a structured format.

Analyze the document and provide the following:
1. Classify the documentType into one of: DEED, INSURANCE_POLICY, UTILITY_BILL, INSPECTION_REPORT, MORTGAGE_STATEMENT, OTHER
2. Extract the full propertyAddress. IMPORTANT: Normalize the address to a standard format. For example, convert "St" to "Street" and "Ave" to "Avenue". If not found, return "N/A".
3. Identify 2-3 of the most important keyEntities (like a policy number, a loan amount, or an inspection date).
4. Provide a single-sentence summary of the document.

Return your response as a JSON object with this exact structure:
{
  "documentType": "DEED|INSURANCE_POLICY|UTILITY_BILL|INSPECTION_REPORT|MORTGAGE_STATEMENT|OTHER",
  "propertyAddress": "123 Main Street, Anytown, CA 12345",
  "keyEntities": [
    {"name": "Entity Name", "value": "Entity Value"}
  ],
  "summary": "One sentence summary of the document"
}

Document:"""

    response_schema = {
        "type": "object",
        "properties": {
            "documentType": {
                "type": "string",
                "enum": [
                    "DEED",
                    "INSURANCE_POLICY",
                    "UTILITY_BILL",
                    "INSPECTION_REPORT",
                    "MORTGAGE_STATEMENT",
                    "OTHER",
                ],
            },
            "propertyAddress": {
                "type": "string",
                "description": "Full normalized address or N/A",
            },
            "keyEntities": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "value": {"type": "string"},
                    },
                    "required": ["name", "value"],
                },
            },
            "summary": {
                "type": "string",
                "description": "One sentence summary",
            },
        },
        "required": ["documentType", "propertyAddress", "keyEntities", "summary"],
    }

    try:
        file_part = types.Part.from_uri(file_uri=doc_url, mime_type=content_type)
        contents = [prompt, file_part]
        logger.info("Sending document to Gemini for analysis...")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config={
                "temperature": 0.1,
                "top_p": 0.95,
                "max_output_tokens": 2048,
                "response_mime_type": "application/json",
                "response_schema": response_schema,
            },
        )
        result_json = json.loads(response.text)
        fields = {
            "documentType": result_json["documentType"],
            "propertyAddress": result_json["propertyAddress"],
            "keyEntities": result_json["keyEntities"],
            "summary": result_json["summary"],
        }
        return fields, response
    except Exception as e:
        logger.error("Document analysis failed: %s", e, exc_info=True)
        return _fallback_result(str(e)), None


def _fallback_result(message: str) -> dict[str, Any]:
    return {
        "documentType": "OTHER",
        "propertyAddress": "N/A",
        "keyEntities": [],
        "summary": f"Analysis failed: {message}",
        "_raw_response": None,
    }
