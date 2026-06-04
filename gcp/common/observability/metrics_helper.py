"""
Metrics Helper Functions

Provides helper functions for recording OpenTelemetry metrics.
Supports counters, histograms, and gauges with automatic feature tagging.
"""

import logging
import math
from typing import Any, Dict, Optional
from .base import get_metrics

logger = logging.getLogger(__name__)


def coerce_finite_float(value: Any) -> Optional[float]:
    """Return a finite float for metric export, or None if value is not numeric."""
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number

# Cache for metric instruments (to avoid recreating them)
_metric_cache: Dict[str, Any] = {}


def _get_or_create_counter(metric_name: str, description: str, unit: str = "1"):
    """Get or create a counter metric instrument."""
    cache_key = f"counter:{metric_name}"
    if cache_key not in _metric_cache:
        meter = get_metrics()
        _metric_cache[cache_key] = meter.create_counter(
            name=metric_name,
            description=description,
            unit=unit
        )
    return _metric_cache[cache_key]


def _get_or_create_histogram(metric_name: str, description: str, unit: str = "1"):
    """Get or create a histogram metric instrument."""
    cache_key = f"histogram:{metric_name}"
    if cache_key not in _metric_cache:
        meter = get_metrics()
        _metric_cache[cache_key] = meter.create_histogram(
            name=metric_name,
            description=description,
            unit=unit
        )
    return _metric_cache[cache_key]


def _get_or_create_up_down_counter(metric_name: str, description: str, unit: str = "1"):
    """Get or create an up-down counter (gauge) metric instrument."""
    cache_key = f"gauge:{metric_name}"
    if cache_key not in _metric_cache:
        meter = get_metrics()
        _metric_cache[cache_key] = meter.create_up_down_counter(
            name=metric_name,
            description=description,
            unit=unit
        )
    return _metric_cache[cache_key]


def record_counter(
    metric_name: str,
    value: int = 1,
    attributes: Optional[Dict[str, str]] = None,
    description: Optional[str] = None
):
    """
    Record a counter metric (monotonically increasing).
    
    Args:
        metric_name: Full metric name (e.g., "agent.query.token_count")
        value: Value to add (default: 1)
        attributes: Optional key-value attributes for filtering/grouping
        description: Optional description (used only on first creation)
    """
    try:
        counter = _get_or_create_counter(
            metric_name,
            description or f"Counter for {metric_name}",
            unit="1"
        )
        counter.add(value, attributes=attributes or {})
    except Exception as e:
        logger.error(f"Failed to record counter {metric_name}: {e}", exc_info=True)


def record_histogram(
    metric_name: str,
    value: float,
    attributes: Optional[Dict[str, str]] = None,
    description: Optional[str] = None,
    unit: str = "1"
):
    """
    Record a histogram metric (for distributions like durations, sizes).
    
    Args:
        metric_name: Full metric name (e.g., "checkpoint.analysis.duration_ms")
        value: Value to record
        attributes: Optional key-value attributes for filtering/grouping
        description: Optional description (used only on first creation)
        unit: Unit of measurement (e.g., "ms", "bytes", "USD")
    """
    try:
        numeric = coerce_finite_float(value)
        if numeric is None:
            logger.debug("Skipping histogram %s: non-finite value %r", metric_name, value)
            return
        histogram = _get_or_create_histogram(
            metric_name,
            description or f"Histogram for {metric_name}",
            unit=unit
        )
        histogram.record(numeric, attributes=attributes or {})
    except Exception as e:
        logger.error(f"Failed to record histogram {metric_name}: {e}", exc_info=True)


def record_gauge(
    metric_name: str,
    value: float,
    attributes: Optional[Dict[str, str]] = None,
    description: Optional[str] = None,
    unit: str = "1"
):
    """
    Record a gauge metric (can go up or down, represents current state).
    
    Args:
        metric_name: Full metric name (e.g., "agent.session.active")
        value: Current value
        attributes: Optional key-value attributes for filtering/grouping
        description: Optional description (used only on first creation)
        unit: Unit of measurement (e.g., "1", "USD", "seconds")
    """
    try:
        numeric = coerce_finite_float(value)
        if numeric is None:
            logger.debug("Skipping gauge %s: non-finite value %r", metric_name, value)
            return
        gauge = _get_or_create_up_down_counter(
            metric_name,
            description or f"Gauge for {metric_name}",
            unit=unit
        )
        # For gauges, we need to track the previous value or use set()
        # UpDownCounter doesn't have set(), so we record the delta
        # In practice, you might want to maintain state externally
        gauge.add(numeric, attributes=attributes or {})
    except Exception as e:
        logger.error(f"Failed to record gauge {metric_name}: {e}", exc_info=True)


def record_metric(
    metric_name: str,
    value: float,
    metric_type: str = "histogram",
    attributes: Optional[Dict[str, str]] = None,
    description: Optional[str] = None,
    unit: str = "1"
):
    """
    Generic function to record a metric (wrapper around specific record functions).
    
    Args:
        metric_name: Full metric name
        value: Value to record
        metric_type: Type of metric ("counter", "histogram", or "gauge")
        attributes: Optional key-value attributes
        description: Optional description
        unit: Unit of measurement
    """
    if metric_type == "counter":
        record_counter(metric_name, int(value), attributes, description)
    elif metric_type == "histogram":
        record_histogram(metric_name, value, attributes, description, unit)
    elif metric_type == "gauge":
        record_gauge(metric_name, value, attributes, description, unit)
    else:
        logger.warning(f"Unknown metric type: {metric_type}. Using histogram.")
        record_histogram(metric_name, value, attributes, description, unit)

