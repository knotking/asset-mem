"""Tools for analyzing inspection reports using Gemini multimodal capabilities."""

import os
import logging
import json
from typing import Optional, Dict, Any, List
import google.generativeai as genai
from google.cloud import storage
from vertexai.generative_models import GenerativeModel, Part
import vertexai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def analyze_report_pdf(
    report_uri: str,
    content_type: str = "application/pdf",
    analysis_type: str = "full"
) -> Dict[str, Any]:
    """
    Analyze an inspection report PDF using Gemini 2.5 Flash multimodal capabilities.
    
    Args:
        report_uri: GCS URI of the report (gs://bucket/path)
        content_type: MIME type of the report file
        analysis_type: Type of analysis - "metadata", "issues", "recommendations", or "full"
    
    Returns:
        Dictionary with analysis results based on analysis_type
    """
    try:
        # Initialize Vertex AI
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        vertexai.init(project=project_id, location=location)
        
        # Create the file part from GCS URI
        file_part = Part.from_uri(report_uri, mime_type=content_type)
        
        # Select prompt based on analysis type
        if analysis_type == "metadata":
            prompt = """
            Analyze this inspection report and extract the following metadata:
            
            1. Inspector Information:
               - Name
               - Company/Organization
               - License number
               - Inspection date
            
            2. Property Information:
               - Address
               - Property type
               - Year built
               - Square footage
            
            3. Report Metadata:
               - Report type (HOME_INSPECTION, PRE_PURCHASE, ANNUAL, SPECIALIZED, or OTHER)
               - Report reference number
               - Executive summary
            
            Return the information as a JSON object. Use null for any missing fields.
            """
        
        elif analysis_type == "issues":
            prompt = """
            Analyze this inspection report and identify ALL issues, defects, and concerns.
            
            For each issue, provide:
            - id: Unique identifier (use format "issue_NNN")
            - category: Structural, Electrical, Plumbing, HVAC, Roofing, Exterior, Interior, or Other
            - title: Brief description (max 100 chars)
            - description: Detailed description
            - severity: critical, major, moderate, or minor
              * critical: Immediate safety hazard or major system failure
              * major: Significant defect requiring prompt attention
              * moderate: Should be addressed soon
              * minor: Maintenance item or cosmetic issue
            - location: Location within property
            - priority: 1-10 (10 = most urgent)
            - estimated_cost: Cost estimate in dollars (if mentioned, otherwise null)
            - page_number: Page number where issue is mentioned (if identifiable)
            - confidence: 0.0-1.0 confidence in this assessment
            
            Return as JSON array of issues. Be thorough but only include issues actually mentioned in the report.
            """
        
        elif analysis_type == "recommendations":
            prompt = """
            Based on the issues found in this inspection report, provide actionable recommendations.
            
            For each recommendation, provide:
            - id: Unique identifier (use format "rec_NNN")
            - issue: Description of the issue being addressed
            - recommendation: Clear, actionable recommendation
            - timeframe: immediate, short_term, long_term, or monitoring
              * immediate: Within 24-48 hours (safety critical)
              * short_term: Within 1-3 months
              * long_term: Within 1-2 years
              * monitoring: Regular inspection, no immediate action
            - estimated_cost: Estimated cost in dollars (if available)
            - diy_feasible: true if homeowner can reasonably do this, false if professional needed
            
            Return as JSON array of recommendations, ordered by priority (most urgent first).
            """
        
        else:  # full analysis
            prompt = """
            Provide a comprehensive analysis of this inspection report including:
            
            1. METADATA:
               - Inspector name, company, license, date
               - Property address, type, year built, square footage
               - Report type and reference number
               - Executive summary (2-3 sentences)
            
            2. OVERALL ASSESSMENT:
               - summary: Overall condition summary (3-4 sentences)
               - overall_condition: excellent, good, fair, poor, or critical
               - key_findings: List of 3-5 most important findings
            
            3. ISSUES: Array of all issues found (same format as issues analysis above)
            
            4. RECOMMENDATIONS: Array of recommendations (same format as recommendations above)
            
            5. COST ESTIMATES:
               - immediate: Total cost for immediate repairs
               - short_term: Total cost for short-term repairs
               - long_term: Total cost for long-term repairs
            
            Return as a single JSON object with all these fields.
            Ensure the JSON is valid and parseable.
            """
        
        # Initialize the model
        model = GenerativeModel("gemini-2.0-flash-exp")
        
        # Generate content
        response = model.generate_content(
            [file_part, prompt],
            generation_config={
                "temperature": 0.1,  # Low temperature for factual extraction
                "max_output_tokens": 8192,
            }
        )
        
        # Parse the response
        response_text = response.text.strip()
        
        # Try to extract JSON from the response
        # Gemini might wrap JSON in markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        # Parse JSON
        result = json.loads(response_text)
        
        logger.info(f"Successfully analyzed report with analysis_type={analysis_type}")
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from Gemini response: {e}")
        logger.error(f"Response text: {response_text}")
        return {
            "error": "Failed to parse analysis results",
            "raw_response": response_text[:500]
        }
    except Exception as e:
        logger.error(f"Error analyzing report: {e}", exc_info=True)
        return {
            "error": str(e)
        }


def retrieve_report_context(
    report_id: str,
    user_id: str,
    property_id: str
) -> Optional[Dict[str, Any]]:
    """
    Retrieve stored report analysis from Firestore.
    
    Args:
        report_id: ID of the report
        user_id: User ID
        property_id: Property ID
    
    Returns:
        Report analysis data or None if not found
    """
    try:
        from google.cloud import firestore
        
        db = firestore.Client()
        
        # Get report document
        report_ref = db.collection("users").document(user_id)\
            .collection("properties").document(property_id)\
            .collection("reports").document(report_id)
        
        report_doc = report_ref.get()
        
        if not report_doc.exists:
            logger.warning(f"Report {report_id} not found")
            return None
        
        report_data = report_doc.to_dict()
        
        # Return the aiAnalysis field which contains all the analysis data
        return report_data.get("aiAnalysis")
        
    except Exception as e:
        logger.error(f"Error retrieving report context: {e}", exc_info=True)
        return None


def generate_report_embedding(report_data: Dict[str, Any]) -> Optional[List[float]]:
    """
    Generate embedding for a report using text-embedding-004.
    
    Args:
        report_data: Full report analysis data
    
    Returns:
        768-dimensional embedding vector or None if failed
    """
    try:
        from vertexai.language_models import TextEmbeddingModel
        
        # Extract text content for embedding
        text_parts = []
        
        # Add summary
        if "summary" in report_data:
            text_parts.append(report_data["summary"])
        
        # Add key findings
        if "key_findings" in report_data:
            text_parts.extend(report_data["key_findings"])
        
        # Add issue descriptions
        if "issues" in report_data:
            for issue in report_data["issues"]:
                if isinstance(issue, dict):
                    text_parts.append(f"{issue.get('title', '')}: {issue.get('description', '')}")
        
        # Combine all text
        combined_text = " ".join(text_parts)
        
        # Truncate if too long (embedding model has limits)
        if len(combined_text) > 5000:
            combined_text = combined_text[:5000]
        
        # Generate embedding
        model = TextEmbeddingModel.from_pretrained("text-embedding-004")
        embeddings = model.get_embeddings([combined_text])
        
        if embeddings and len(embeddings) > 0:
            return embeddings[0].values
        
        return None
        
    except Exception as e:
        logger.error(f"Error generating report embedding: {e}", exc_info=True)
        return None

