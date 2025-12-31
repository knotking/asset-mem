"""Service for generating embeddings for inspection reports using text-embedding-004."""

import logging
from typing import Dict, Any, List, Optional
from vertexai.language_models import TextEmbeddingModel

logger = logging.getLogger(__name__)


def generate_report_embedding(report_data: Dict[str, Any]) -> Optional[List[float]]:
    """
    Generate a 768-dimensional embedding vector for an inspection report.
    
    This embedding can be used for:
    - Semantic search across reports
    - Finding similar issues across properties
    - Clustering reports by content
    
    Args:
        report_data: Full report analysis data containing summary, issues, recommendations
    
    Returns:
        768-dimensional embedding vector or None if generation fails
    """
    try:
        # Extract text content for embedding
        text_parts = []
        
        # Add overall summary
        if "summary" in report_data:
            text_parts.append(f"Summary: {report_data['summary']}")
        
        # Add overall condition
        if "overall_condition" in report_data:
            text_parts.append(f"Overall condition: {report_data['overall_condition']}")
        
        # Add key findings
        if "key_findings" in report_data and isinstance(report_data["key_findings"], list):
            text_parts.append("Key findings: " + ". ".join(report_data["key_findings"]))
        
        # Add issue summaries
        if "issues" in report_data and isinstance(report_data["issues"], list):
            for issue in report_data["issues"][:10]:  # Limit to top 10 issues to avoid too long text
                if isinstance(issue, dict):
                    issue_text = f"{issue.get('severity', 'unknown')} {issue.get('category', 'issue')}: {issue.get('title', '')} - {issue.get('description', '')[:100]}"
                    text_parts.append(issue_text)
        
        # Add recommendation summaries
        if "recommendations" in report_data and isinstance(report_data["recommendations"], list):
            for rec in report_data["recommendations"][:5]:  # Limit to top 5 recommendations
                if isinstance(rec, dict):
                    rec_text = f"{rec.get('timeframe', 'unknown')} action: {rec.get('recommendation', '')[:100]}"
                    text_parts.append(rec_text)
        
        # Combine all text
        combined_text = " ".join(text_parts)
        
        # Truncate if too long (embedding model has limits)
        max_length = 5000
        if len(combined_text) > max_length:
            combined_text = combined_text[:max_length]
            logger.info(f"Truncated text to {max_length} characters for embedding")
        
        if not combined_text.strip():
            logger.warning("No text content found for embedding generation")
            return None
        
        # Generate embedding using text-embedding-004
        model = TextEmbeddingModel.from_pretrained("text-embedding-004")
        embeddings = model.get_embeddings([combined_text])
        
        if embeddings and len(embeddings) > 0:
            embedding_vector = embeddings[0].values
            logger.info(f"Generated embedding with {len(embedding_vector)} dimensions")
            return embedding_vector
        
        logger.warning("Empty embedding result from model")
        return None
        
    except Exception as e:
        logger.error(f"Error generating report embedding: {e}", exc_info=True)
        return None

