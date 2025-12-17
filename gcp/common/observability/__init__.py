"""
Shared Observability Module

Provides unified observability capabilities (metrics, logs, traces) across all features
of the HomeApp platform. Supports both platform-wide and feature-specific analysis.
"""

from .constants import *
from .base import (
    initialize_observability,
    get_tracer,
    get_logger,
    get_metrics,
)
from .logging_helper import (
    log_event,
    log_analysis_completed,
    log_analysis_failed,
)
from .metrics_helper import (
    record_metric,
    record_counter,
    record_histogram,
    record_gauge,
)
from .feature_helpers import (
    checkpoint,
    agent,
    document,
    rag,
    platform,
    # Also export classes for inheritance/extending
    CheckpointObservability,
    AgentObservability,
    DocumentObservability,
    RAGObservability,
    PlatformObservability,
)

__all__ = [
    # Constants
    "FEATURE_CHECKPOINT",
    "FEATURE_AGENT",
    "FEATURE_DOCUMENT",
    "FEATURE_RAG",
    "FEATURE_SERVICE_BROKER",
    "FEATURE_TELEGRAM",
    # Base initialization
    "initialize_observability",
    "get_tracer",
    "get_logger",
    "get_metrics",
    # Logging helpers
    "log_event",
    "log_analysis_completed",
    "log_analysis_failed",
    # Metrics helpers
    "record_metric",
    "record_counter",
    "record_histogram",
    "record_gauge",
    # Feature helpers (instances)
    "checkpoint",
    "agent",
    "document",
    "rag",
    "platform",
    # Feature helper classes (for extending)
    "CheckpointObservability",
    "AgentObservability",
    "DocumentObservability",
    "RAGObservability",
    "PlatformObservability",
]
