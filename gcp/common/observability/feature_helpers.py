"""
Feature-Specific Observability Helpers

Provides feature-specific helper functions that extend the base observability
capabilities. Each feature module provides convenient wrappers for common operations.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from .constants import *
from .logging_helper import log_event, log_analysis_completed, log_analysis_failed, log_exception
from .metrics_helper import record_counter, record_histogram, record_gauge
from .base import get_tracer

logger = logging.getLogger(__name__)


# ============================================================================
# CHECKPOINT FEATURE HELPERS
# ============================================================================

class CheckpointObservability:
    """Helper class for checkpoint feature observability."""
    
    @staticmethod
    def log_analysis_completed(
        checkpoint_id: str,
        user_id: str,
        property_id: str,
        duration_ms: float,
        detected_asset: Optional[str] = None,
        asset_category: Optional[str] = None,
        condition_scores: Optional[Dict[str, float]] = None,
        damage_scores: Optional[Dict[str, float]] = None,
        issues_count: int = 0,
        **kwargs
    ):
        """Log checkpoint analysis completion."""
        body = {
            "checkpoint_id": checkpoint_id,
            "user_id": user_id,
            "property_id": property_id,
            "duration_ms": duration_ms,
            "detected_asset": detected_asset,
            "asset_category": asset_category,
            "issues_count": issues_count,
            **kwargs
        }
        
        if condition_scores:
            body["condition_scores"] = condition_scores
        if damage_scores:
            body["damage_scores"] = damage_scores
        
        log_event(EVENT_CHECKPOINT_ANALYSIS_COMPLETED, body, severity="INFO")
    
    @staticmethod
    def log_comparison_completed(
        checkpoint_id: str,
        user_id: str,
        property_id: str,
        compared_with_checkpoint_id: str,
        duration_ms: float,
        similarity_score: float,
        semantic_changes_count: int,
        **kwargs
    ):
        """Log checkpoint comparison completion."""
        body = {
            "checkpoint_id": checkpoint_id,
            "user_id": user_id,
            "property_id": property_id,
            "compared_with_checkpoint_id": compared_with_checkpoint_id,
            "duration_ms": duration_ms,
            "similarity_score": similarity_score,
            "semantic_changes_count": semantic_changes_count,
            **kwargs
        }
        log_event(EVENT_CHECKPOINT_COMPARISON_COMPLETED, body, severity="INFO")
    
    @staticmethod
    def record_condition_score(component: str, score: float, attributes: Optional[Dict[str, str]] = None):
        """Record a condition score metric."""
        metric_name = format_metric_name(METRIC_CHECKPOINT_CONDITION_SCORE, component=component)
        record_gauge(metric_name, score, attributes, description=f"Condition score for {component} (0-100)")
    
    @staticmethod
    def record_damage_score(damage_type: str, score: float, attributes: Optional[Dict[str, str]] = None):
        """Record a damage indicator metric."""
        metric_name = format_metric_name(METRIC_CHECKPOINT_DAMAGE_SCORE, type=damage_type)
        record_gauge(metric_name, score, attributes, description=f"Damage severity for {damage_type} (0-100)")
    
    @staticmethod
    def record_cost_estimate(cost_type: str, amount_usd: float, attributes: Optional[Dict[str, str]] = None):
        """Record a cost estimate metric."""
        metric_name = format_metric_name(METRIC_CHECKPOINT_COST_ESTIMATE, type=cost_type)
        record_gauge(metric_name, amount_usd, attributes, description=f"Cost estimate for {cost_type} in USD", unit="USD")
    
    @staticmethod
    def record_issue_count(severity: str, count: int, attributes: Optional[Dict[str, str]] = None):
        """Record an issue count metric."""
        metric_name = format_metric_name(METRIC_CHECKPOINT_ISSUE_COUNT, severity=severity)
        record_counter(metric_name, count, attributes, description=f"Count of {severity} issues")


# ============================================================================
# AGENT FEATURE HELPERS
# ============================================================================

class AgentObservability:
    """Helper class for agent feature observability."""
    
    @staticmethod
    def log_query_completed(
        user_id: str,
        session_id: str,
        duration_ms: float,
        token_count: int,
        cost_usd: float,
        subagents_invoked: list,
        **kwargs
    ):
        """Log agent query completion."""
        body = {
            "user_id": user_id,
            "session_id": session_id,
            "duration_ms": duration_ms,
            "token_count": token_count,
            "cost_usd": cost_usd,
            "subagents_invoked": subagents_invoked,
            **kwargs
        }
        log_event(EVENT_AGENT_QUERY_COMPLETED, body, severity="INFO")
    
    @staticmethod
    def record_subagent_invocation(subagent_name: str, duration_ms: float, success: bool, attributes: Optional[Dict[str, str]] = None):
        """Record sub-agent invocation metrics."""
        invocations_name = format_metric_name(METRIC_AGENT_SUBAGENT_INVOCATIONS, name=subagent_name)
        duration_name = format_metric_name(METRIC_AGENT_SUBAGENT_DURATION, name=subagent_name)
        error_name = format_metric_name(METRIC_AGENT_SUBAGENT_ERROR_COUNT, name=subagent_name)
        
        record_counter(invocations_name, 1, attributes)
        record_histogram(duration_name, duration_ms, attributes, unit="ms")
        if not success:
            record_counter(error_name, 1, attributes)


# ============================================================================
# DOCUMENT FEATURE HELPERS
# ============================================================================

class DocumentObservability:
    """Helper class for document feature observability."""
    
    @staticmethod
    def log_analysis_completed(
        user_id: str,
        document_url: str,
        document_type: str,
        duration_ms: float,
        pages_processed: int,
        entities_extracted: Optional[list] = None,
        **kwargs
    ):
        """Log document analysis completion."""
        body = {
            "user_id": user_id,
            "document_url": document_url,
            "document_type": document_type,
            "duration_ms": duration_ms,
            "pages_processed": pages_processed,
            **kwargs
        }
        if entities_extracted:
            body["entities_extracted"] = entities_extracted
        
        log_event(EVENT_DOCUMENT_ANALYSIS_COMPLETED, body, severity="INFO")
    
    @staticmethod
    def record_document_type(document_type: str, attributes: Optional[Dict[str, str]] = None):
        """Record document type detection."""
        metric_name = format_metric_name(METRIC_DOCUMENT_TYPE_DETECTED, type=document_type)
        record_counter(metric_name, 1, attributes)


# ============================================================================
# RAG FEATURE HELPERS
# ============================================================================

class RAGObservability:
    """Helper class for RAG feature observability."""
    
    @staticmethod
    def log_import_completed(
        user_id: str,
        files_imported: int,
        duration_ms: float,
        total_tokens: int,
        corpus_id: Optional[str] = None,
        **kwargs
    ):
        """Log RAG import completion."""
        body = {
            "user_id": user_id,
            "files_imported": files_imported,
            "duration_ms": duration_ms,
            "total_tokens": total_tokens,
            **kwargs
        }
        if corpus_id:
            body["corpus_id"] = corpus_id
        
        log_event(EVENT_RAG_IMPORT_COMPLETED, body, severity="INFO")
    
    @staticmethod
    def record_corpus_size(user_id: str, documents: int, tokens: int):
        """Record corpus size metrics."""
        attributes = {"user_id": user_id}
        record_gauge(METRIC_RAG_CORPUS_SIZE_DOCUMENTS, documents, attributes)
        record_gauge(METRIC_RAG_CORPUS_SIZE_TOKENS, tokens, attributes)


# ============================================================================
# PLATFORM-WIDE HELPERS
# ============================================================================

class PlatformObservability:
    """Helper class for platform-wide observability."""
    
    @staticmethod
    def record_feature_usage(feature: str, user_id: str):
        """Record feature usage for a user."""
        attributes = {
            "feature": feature,
            "user_id": user_id
        }
        record_counter(METRIC_USER_FEATURES_USED, 1, attributes)
    
    @staticmethod
    def record_cost(feature: str, cost_usd: float, user_id: Optional[str] = None):
        """Record cost by feature."""
        attributes = {"feature": feature}
        if user_id:
            attributes["user_id"] = user_id
        
        # Record both total and per-feature
        record_gauge(METRIC_PLATFORM_COST_TOTAL_USD, cost_usd, {}, unit="USD")
        metric_name = format_metric_name(METRIC_PLATFORM_COST_BY_FEATURE, feature=feature)
        record_gauge(metric_name, cost_usd, attributes, unit="USD")


# Export feature helper classes as singleton instances
# These provide standard observability patterns.
# Features can extend these classes in their own modules when custom logic is needed.
#
# To extend: Import the class from common.observability and inherit/override methods
# Example: class MyCheckpointObservability(CheckpointObservability): ...
checkpoint = CheckpointObservability()
agent = AgentObservability()
document = DocumentObservability()
rag = RAGObservability()
platform = PlatformObservability()

