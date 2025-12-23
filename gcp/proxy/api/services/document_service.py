"""
Document Analysis Module

Uses Google Gen AI SDK (Vertex AI) to extract key information from property documents:
- Document type classification
- Property address extraction and normalization
- Key entities identification
- Document summary generation
"""

import os
import logging
import json
from typing import Dict, Any
from google import genai
from google.genai import types

from schemas.document import ExtractDocInfoRequest, ExtractDocInfoResponse, DocumentType, KeyEntity

logger = logging.getLogger(__name__)

# Initialize Google Gen AI Client with Vertex AI
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")

try:
    client = genai.Client(
        vertexai=True,
        project=PROJECT_ID,
        location=LOCATION
    )
    logger.info(f"Google Gen AI SDK initialized for project {PROJECT_ID} in {LOCATION}")
except Exception as e:
    logger.error(f"Failed to initialize Google Gen AI SDK: {e}")
    client = None


def extract_doc_info(request: ExtractDocInfoRequest) -> ExtractDocInfoResponse:
    """
    Extract structured information from a property document using Gemini.

    This function:
    1. Creates a file part from the document URL (no download needed!)
    2. Sends it to Gemini 2.0 Flash with a structured prompt
    3. Extracts: document type, property address, key entities, and summary
    4. Returns structured response matching ExtractDocInfoResponse schema

    Args:
        request: ExtractDocInfoRequest containing docUrl and contentType

    Returns:
        ExtractDocInfoResponse with extracted information

    Raises:
        Exception: If document analysis fails
    """
    try:
        if not client:
            raise Exception("Google Gen AI SDK not initialized")

        logger.info(f"Starting document analysis for {request.docUrl}")

        # Define the prompt - matches the TypeScript implementation
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

        # Define response schema
        response_schema = {
            "type": "object",
            "properties": {
                "documentType": {
                    "type": "string",
                    "enum": ["DEED", "INSURANCE_POLICY", "UTILITY_BILL", "INSPECTION_REPORT", "MORTGAGE_STATEMENT", "OTHER"]
                },
                "propertyAddress": {
                    "type": "string",
                    "description": "Full normalized address or N/A"
                },
                "keyEntities": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "value": {"type": "string"}
                        },
                        "required": ["name", "value"]
                    }
                },
                "summary": {
                    "type": "string",
                    "description": "One sentence summary"
                }
            },
            "required": ["documentType", "propertyAddress", "keyEntities", "summary"]
        }

        # Create file part directly from URL (no download needed!)
        # The SDK supports both gs:// URIs and public https:// URLs
        file_part = types.Part.from_uri(
            file_uri=request.docUrl,
            mime_type=request.contentType
        )

        # Create contents with prompt and file
        contents = [prompt, file_part]

        # Generate analysis using new SDK
        logger.info("Sending document to Gemini for analysis...")
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=contents,
            config={
                "temperature": 0.1,  # Low temperature for consistent extraction
                "top_p": 0.95,
                "max_output_tokens": 2048,
                "response_mime_type": "application/json",
                "response_schema": response_schema
            }
        )

        # Parse JSON response
        result_json = json.loads(response.text)
        logger.info(f"Analysis complete: {result_json.get('documentType')}")

        # Convert to response model
        return ExtractDocInfoResponse(
            documentType=DocumentType(result_json["documentType"]),
            propertyAddress=result_json["propertyAddress"],
            keyEntities=[
                KeyEntity(name=entity["name"], value=entity["value"])
                for entity in result_json["keyEntities"]
            ],
            summary=result_json["summary"]
        )

    except Exception as e:
        logger.error(f"Document analysis failed: {e}", exc_info=True)
        # Return fallback response instead of raising
        return ExtractDocInfoResponse(
            documentType=DocumentType.OTHER,
            propertyAddress="N/A",
            keyEntities=[],
            summary=f"Analysis failed: {str(e)}"
        )

