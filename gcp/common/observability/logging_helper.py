"""
Structured Logging Helpers

Provides helper functions for structured logging in OpenTelemetry format.
All logs are structured as JSON and include trace correlation IDs when available.
"""

import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from opentelemetry import trace

from .logging_context import get_firebase_uid

logger = logging.getLogger(__name__)


def log_event(
    event_type: str,
    body: Dict[str, Any],
    severity: str = "INFO",
    logger_instance: Optional[logging.Logger] = None
):
    """
    Log a structured event in OpenTelemetry format.
    
    Args:
        event_type: Event type identifier (e.g., "checkpoint.analysis.completed")
        body: Event body with all relevant data. If ``firebase_uid`` is omitted and
            :func:`logging_context.get_firebase_uid` is set, ``firebase_uid`` is added
            for log sinks / BigQuery queries.
        severity: Log severity (INFO, WARNING, ERROR)
        logger_instance: Optional logger instance (defaults to module logger)
    """
    if logger_instance is None:
        logger_instance = logger
    
    # Get trace context if available
    span = trace.get_current_span()
    trace_context = {}
    if span and span.get_span_context().is_valid:
        span_context = span.get_span_context()
        trace_context = {
            "trace_id": format(span_context.trace_id, "032x"),
            "span_id": format(span_context.span_id, "016x"),
        }

    merged_body = dict(body)
    ctx_uid = get_firebase_uid()
    if ctx_uid is not None and "firebase_uid" not in merged_body:
        merged_body["firebase_uid"] = ctx_uid

    # Build log structure
    log_entry = {
        "severity": severity,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "trace": trace_context,
        "body": {
            "event_type": event_type,
            "event_version": "1.0",
            **merged_body,
        },
    }
    
    # Log as JSON string for structured logging
    log_message = json.dumps(log_entry)
    
    if severity == "ERROR":
        logger_instance.error(log_message)
    elif severity == "WARNING":
        logger_instance.warning(log_message)
    else:
        logger_instance.info(log_message)


def log_analysis_completed(
    feature: str,
    duration_ms: float,
    user_id: str,
    additional_data: Optional[Dict[str, Any]] = None,
    logger_instance: Optional[logging.Logger] = None
):
    """
    Log a completed analysis event (generic for any feature).
    
    Args:
        feature: Feature name (checkpoint, document, agent, etc.)
        duration_ms: Analysis duration in milliseconds
        user_id: User ID
        additional_data: Additional event-specific data
        logger_instance: Optional logger instance
    """
    body = {
        "user_id": user_id,
        "duration_ms": duration_ms,
    }
    
    if additional_data:
        body.update(additional_data)
    
    event_type = f"{feature}.analysis.completed"
    log_event(event_type, body, severity="INFO", logger_instance=logger_instance)


def log_analysis_failed(
    feature: str,
    user_id: str,
    error_message: str,
    error_code: Optional[str] = None,
    stack_trace: Optional[str] = None,
    additional_data: Optional[Dict[str, Any]] = None,
    logger_instance: Optional[logging.Logger] = None
):
    """
    Log a failed analysis event (generic for any feature).
    
    Args:
        feature: Feature name (checkpoint, document, agent, etc.)
        user_id: User ID
        error_message: Error message
        error_code: Optional error code
        stack_trace: Optional stack trace
        additional_data: Additional event-specific data
        logger_instance: Optional logger instance
    """
    body = {
        "user_id": user_id,
        "error": {
            "message": error_message,
        }
    }
    
    if error_code:
        body["error"]["code"] = error_code
    
    if stack_trace:
        body["error"]["stack_trace"] = stack_trace
    
    if additional_data:
        body.update(additional_data)
    
    event_type = f"{feature}.analysis.failed"
    log_event(event_type, body, severity="ERROR", logger_instance=logger_instance)


def log_exception(
    feature: str,
    user_id: str,
    exception: Exception,
    error_code: Optional[str] = None,
    additional_data: Optional[Dict[str, Any]] = None,
    logger_instance: Optional[logging.Logger] = None
):
    """
    Log an exception as a failed event.
    
    Args:
        feature: Feature name
        user_id: User ID
        exception: Exception instance
        error_code: Optional error code
        additional_data: Additional event-specific data
        logger_instance: Optional logger instance
    """
    stack_trace = traceback.format_exc()
    log_analysis_failed(
        feature=feature,
        user_id=user_id,
        error_message=str(exception),
        error_code=error_code,
        stack_trace=stack_trace,
        additional_data=additional_data,
        logger_instance=logger_instance
    )

