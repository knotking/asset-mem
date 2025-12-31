"""Report Agent - Main orchestrator for inspection report analysis and chat."""

import os
import logging
from google.adk.agents import Agent
from google.adk.tools import ToolContext
from dotenv import load_dotenv
from .prompts import (
    report_agent_instruction,
    extraction_agent_instruction,
    issues_analysis_agent_instruction,
    recommendations_agent_instruction,
    report_chat_agent_instruction
)
from .schemas import (
    ReportAnalysisInput,
    ReportChatInput,
    ReportMetadata,
    ReportIssue,
    ReportRecommendation,
    ReportAnalysisOutput
)
from .tools import (
    analyze_report_pdf,
    retrieve_report_context,
    generate_report_embedding
)
from typing import Dict, Any, List, Optional
import json

load_dotenv()

logger = logging.getLogger(__name__)


# Tool functions for sub-agents

def extract_report_metadata(
    report_uri: str,
    content_type: str = "application/pdf",
    tool_context: ToolContext = None
) -> Dict[str, Any]:
    """
    Extract metadata from inspection report.
    
    Args:
        report_uri: GCS URI of the report
        content_type: MIME type of the report
        tool_context: ADK tool context
    
    Returns:
        Dictionary with extracted metadata
    """
    logger.info(f"Extracting metadata from report: {report_uri}")
    
    try:
        result = analyze_report_pdf(
            report_uri=report_uri,
            content_type=content_type,
            analysis_type="metadata"
        )
        
        return result
    except Exception as e:
        logger.error(f"Error extracting metadata: {e}", exc_info=True)
        return {"error": str(e)}


def analyze_report_issues(
    report_uri: str,
    content_type: str = "application/pdf",
    tool_context: ToolContext = None
) -> Dict[str, Any]:
    """
    Analyze and extract issues from inspection report.
    
    Args:
        report_uri: GCS URI of the report
        content_type: MIME type of the report
        tool_context: ADK tool context
    
    Returns:
        Dictionary with list of issues
    """
    logger.info(f"Analyzing issues from report: {report_uri}")
    
    try:
        result = analyze_report_pdf(
            report_uri=report_uri,
            content_type=content_type,
            analysis_type="issues"
        )
        
        return result
    except Exception as e:
        logger.error(f"Error analyzing issues: {e}", exc_info=True)
        return {"error": str(e)}


def generate_recommendations(
    report_uri: str,
    content_type: str = "application/pdf",
    tool_context: ToolContext = None
) -> Dict[str, Any]:
    """
    Generate recommendations based on report issues.
    
    Args:
        report_uri: GCS URI of the report
        content_type: MIME type of the report
        tool_context: ADK tool context
    
    Returns:
        Dictionary with list of recommendations
    """
    logger.info(f"Generating recommendations from report: {report_uri}")
    
    try:
        result = analyze_report_pdf(
            report_uri=report_uri,
            content_type=content_type,
            analysis_type="recommendations"
        )
        
        return result
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}", exc_info=True)
        return {"error": str(e)}


def answer_report_question(
    user_query: str,
    report_id: str,
    user_id: str,
    property_id: str,
    report_context: Optional[Dict[str, Any]] = None,
    tool_context: ToolContext = None
) -> str:
    """
    Answer questions about a previously analyzed report.
    
    Args:
        user_query: User's question
        report_id: ID of the report
        user_id: User ID
        property_id: Property ID
        report_context: Pre-loaded report analysis data (optional)
        tool_context: ADK tool context
    
    Returns:
        Answer to the user's question
    """
    logger.info(f"Answering question about report {report_id}: {user_query}")
    
    try:
        # Retrieve report context if not provided
        if not report_context:
            report_context = retrieve_report_context(
                report_id=report_id,
                user_id=user_id,
                property_id=property_id
            )
        
        if not report_context:
            return "Unable to retrieve report information. Please ensure the report has been analyzed."
        
        # Use Gemini to answer the question based on the context
        from vertexai.generative_models import GenerativeModel
        
        model = GenerativeModel("gemini-2.0-flash-exp")
        
        # Format context for the model
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
        logger.error(f"Error answering question: {e}", exc_info=True)
        return f"Error processing your question: {str(e)}"


# Define sub-agents

extraction_agent = Agent(
    model='gemini-2.0-flash-exp',
    name='extraction_agent',
    description="Extracts metadata and key information from inspection reports",
    instruction=extraction_agent_instruction(),
    tools=[extract_report_metadata],
    disallow_transfer_to_parent=True
)

issues_analysis_agent = Agent(
    model='gemini-2.0-flash-exp',
    name='issues_analysis_agent',
    description="Identifies and categorizes issues from inspection reports",
    instruction=issues_analysis_agent_instruction(),
    tools=[analyze_report_issues],
    disallow_transfer_to_parent=True
)

recommendations_agent = Agent(
    model='gemini-2.0-flash-exp',
    name='recommendations_agent',
    description="Generates actionable recommendations based on report issues",
    instruction=recommendations_agent_instruction(),
    tools=[generate_recommendations],
    disallow_transfer_to_parent=True
)

report_chat_agent = Agent(
    model='gemini-2.0-flash-exp',
    name='report_chat_agent',
    description="Answers questions about previously analyzed inspection reports",
    instruction=report_chat_agent_instruction(),
    input_schema=ReportChatInput,
    tools=[answer_report_question],
    disallow_transfer_to_parent=True
)


# Main report agent orchestrator

report_agent = Agent(
    model='gemini-2.0-flash-exp',
    name='report_agent',
    description="Analyzes property inspection reports and answers questions about them",
    instruction=report_agent_instruction(),
    sub_agents=[
        extraction_agent,
        issues_analysis_agent,
        recommendations_agent,
        report_chat_agent
    ]
)


__all__ = [
    "report_agent",
    "extraction_agent",
    "issues_analysis_agent",
    "recommendations_agent",
    "report_chat_agent"
]

