"""Service module for calling the report agent to analyze inspection reports."""

import logging
import os
from typing import Dict, Any, Optional
import sys

# Add the agents directory to the Python path
agents_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../agents/homecare"))
if agents_path not in sys.path:
    sys.path.insert(0, agents_path)

logger = logging.getLogger(__name__)


def analyze_inspection_report(
    report_uri: str,
    content_type: str,
    user_id: str,
    property_id: str
) -> Dict[str, Any]:
    """
    Analyze an inspection report using the report agent.
    
    Args:
        report_uri: GCS URI of the report (gs://bucket/path)
        content_type: MIME type of the report
        user_id: User ID who owns the report
        property_id: Property ID the report belongs to
    
    Returns:
        Dictionary with complete analysis results
    """
    logger.info(f"Starting report analysis for user {user_id}, property {property_id}")
    
    try:
        # Import report agent tools directly
        from report_agent.tools import analyze_report_pdf
        
        # Perform full analysis
        result = analyze_report_pdf(
            report_uri=report_uri,
            content_type=content_type,
            analysis_type="full"
        )
        
        if "error" in result:
            logger.error(f"Error in report analysis: {result['error']}")
            raise Exception(result["error"])
        
        logger.info("Report analysis completed successfully")
        return result
        
    except ImportError as e:
        logger.error(f"Failed to import report agent: {e}", exc_info=True)
        raise Exception(f"Failed to initialize report agent: {str(e)}")
    except Exception as e:
        logger.error(f"Error analyzing inspection report: {e}", exc_info=True)
        raise


def chat_with_report(
    user_query: str,
    report_id: str,
    user_id: str,
    property_id: str,
    report_context: Optional[Dict[str, Any]] = None
) -> str:
    """
    Answer a question about an inspection report.
    
    Args:
        user_query: User's question
        report_id: ID of the report
        user_id: User ID
        property_id: Property ID
        report_context: Pre-loaded report analysis (optional)
    
    Returns:
        Answer string
    """
    logger.info(f"Processing chat query for report {report_id}: {user_query}")
    
    try:
        from report_agent.tools import retrieve_report_context
        from vertexai.generative_models import GenerativeModel
        import json
        
        # Retrieve report context if not provided
        if not report_context:
            report_context = retrieve_report_context(
                report_id=report_id,
                user_id=user_id,
                property_id=property_id
            )
        
        if not report_context:
            return "Unable to retrieve report information. Please ensure the report has been analyzed."
        
        # Use Gemini to answer the question
        model = GenerativeModel("gemini-2.0-flash-exp")
        
        context_str = json.dumps(report_context, indent=2)
        
        prompt = f"""You are answering a question about an inspection report.

Report Analysis Data:
{context_str}

User Question: {user_query}

Provide a clear, accurate answer based on the report data above. Include:
- Specific details from the report
- Relevant page numbers if available
- Cost estimates if applicable
- Severity levels if discussing issues
- Recommendations if appropriate

If the question cannot be answered from the report data, say so clearly."""

        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.2,
                "max_output_tokens": 2048,
            }
        )
        
        return response.text
        
    except Exception as e:
        logger.error(f"Error in chat service: {e}", exc_info=True)
        return f"Error processing your question: {str(e)}"

