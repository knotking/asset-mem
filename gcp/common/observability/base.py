"""
Base Observability Infrastructure

Initializes OpenTelemetry metrics, traces, and logging infrastructure.
This module sets up the shared observability components used across all features.
"""

import os
import logging
from typing import Optional
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource

# Cloud exporters (conditionally imported)
try:
    from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
    from opentelemetry.exporter.cloud_monitoring import CloudMonitoringMetricsExporter
    CLOUD_EXPORTERS_AVAILABLE = True
except ImportError:
    CLOUD_EXPORTERS_AVAILABLE = False
    logging.warning("Cloud exporters not available. Install opentelemetry-exporter-cloud-* for GCP integration.")

logger = logging.getLogger(__name__)

# Global instances
_tracer_provider: Optional[TracerProvider] = None
_meter_provider: Optional[MeterProvider] = None
_tracer: Optional[trace.Tracer] = None
_meter: Optional[metrics.Meter] = None

# Resource attributes
_RESOURCE = Resource.create({
    "service.name": "homeapp-proxy",
    "service.namespace": "homeapp",
    "service.version": "1.0.0",
    "cloud.provider": "gcp",
    "cloud.platform": "gcp_cloud_functions",
})


def initialize_observability(enable_tracing: bool = True, enable_metrics: bool = True):
    """
    Initialize OpenTelemetry observability infrastructure.
    
    Args:
        enable_tracing: If True, initialize distributed tracing
        enable_metrics: If True, initialize metrics collection
    """
    global _tracer_provider, _meter_provider, _tracer, _meter
    
    project_id = os.environ.get("GCP_PROJECT_ID")
    location = os.environ.get("GCP_LOCATION", "us-central1")
    
    if enable_tracing:
        _initialize_tracing(project_id)
    
    if enable_metrics:
        _initialize_metrics(project_id)
    
    logger.info("Observability infrastructure initialized")


def _initialize_tracing(project_id: Optional[str]):
    """Initialize distributed tracing with Cloud Trace."""
    global _tracer_provider, _tracer
    
    if not CLOUD_EXPORTERS_AVAILABLE:
        logger.warning("Cloud Trace exporter not available. Tracing will use no-op.")
        trace.set_tracer_provider(TracerProvider(resource=_RESOURCE))
        _tracer = trace.get_tracer(__name__)
        return
    
    try:
        _tracer_provider = TracerProvider(resource=_RESOURCE)
        
        if project_id:
            exporter = CloudTraceSpanExporter(project_id=project_id)
            processor = BatchSpanProcessor(exporter)
            _tracer_provider.add_span_processor(processor)
            logger.info(f"Cloud Trace exporter initialized for project {project_id}")
        else:
            logger.warning("GCP_PROJECT_ID not set. Tracing will use no-op exporter.")
        
        trace.set_tracer_provider(_tracer_provider)
        _tracer = trace.get_tracer(__name__)
    except Exception as e:
        logger.error(f"Failed to initialize tracing: {e}", exc_info=True)
        # Fallback to no-op
        trace.set_tracer_provider(TracerProvider(resource=_RESOURCE))
        _tracer = trace.get_tracer(__name__)


def _initialize_metrics(project_id: Optional[str]):
    """Initialize metrics with Cloud Monitoring."""
    global _meter_provider, _meter
    
    if not CLOUD_EXPORTERS_AVAILABLE:
        logger.warning("Cloud Monitoring exporter not available. Metrics will use no-op.")
        metrics.set_meter_provider(MeterProvider(resource=_RESOURCE))
        _meter = metrics.get_meter(__name__)
        return
    
    try:
        if project_id:
            exporter = CloudMonitoringMetricsExporter(project_id=project_id)
            reader = PeriodicExportingMetricReader(exporter, export_interval_millis=60000)
            _meter_provider = MeterProvider(resource=_RESOURCE, metric_readers=[reader])
            logger.info(f"Cloud Monitoring exporter initialized for project {project_id}")
        else:
            logger.warning("GCP_PROJECT_ID not set. Metrics will use no-op exporter.")
            _meter_provider = MeterProvider(resource=_RESOURCE)
        
        metrics.set_meter_provider(_meter_provider)
        _meter = metrics.get_meter(__name__)
    except Exception as e:
        logger.error(f"Failed to initialize metrics: {e}", exc_info=True)
        # Fallback to no-op
        metrics.set_meter_provider(MeterProvider(resource=_RESOURCE))
        _meter = metrics.get_meter(__name__)


def get_tracer(name: str = __name__) -> trace.Tracer:
    """
    Get an OpenTelemetry tracer instance.
    
    Args:
        name: Name for the tracer (typically __name__ of the calling module)
        
    Returns:
        Tracer instance
    """
    global _tracer
    if _tracer is None:
        # Auto-initialize if not already initialized
        initialize_observability(enable_tracing=True, enable_metrics=False)
    return trace.get_tracer(name)


def get_metrics(name: str = __name__) -> metrics.Meter:
    """
    Get an OpenTelemetry metrics meter instance.
    
    Args:
        name: Name for the meter (typically __name__ of the calling module)
        
    Returns:
        Meter instance
    """
    global _meter
    if _meter is None:
        # Auto-initialize if not already initialized
        initialize_observability(enable_tracing=False, enable_metrics=True)
    return metrics.get_meter(name)


def get_logger(name: str = __name__) -> logging.Logger:
    """
    Get a logger instance (standard Python logging, not OpenTelemetry).
    
    Args:
        name: Name for the logger (typically __name__ of the calling module)
        
    Returns:
        Logger instance
    """
    return logging.getLogger(name)

