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
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource

logger = logging.getLogger(__name__)

# Cloud exporters (conditionally imported)
# NOTE:
# - Modern/maintained Google Cloud exporters are published via:
#   - opentelemetry-exporter-gcp-trace
#   - opentelemetry-exporter-gcp-monitoring
# They expose the same import paths used below.
try:
    from google.api_core import exceptions as google_api_exceptions
    from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
    from opentelemetry.exporter.cloud_monitoring import CloudMonitoringMetricsExporter

    class _ResilientCloudMonitoringMetricsExporter(CloudMonitoringMetricsExporter):
        """Cloud Monitoring rejects points written too close together for a time series.

        On Cloud Functions / short-lived workers, a shutdown flush often runs shortly
        after a periodic export, which triggers InvalidArgument and noisy ERROR logs
        from the upstream exporter. Sampling violations are safe to drop.
        """

        def _batch_write(self, series):  # type: ignore[no-untyped-def]
            try:
                super()._batch_write(series)
            except google_api_exceptions.InvalidArgument as e:
                msg = str(e).lower()
                if (
                    "maximum sampling period" in msg
                    or "doublevalue" in msg
                    or "missing field points" in msg
                ):
                    logger.debug("Skipped Cloud Monitoring batch (benign): %s", e)
                    return
                raise

    CLOUD_EXPORTERS_AVAILABLE = True
except ImportError:
    google_api_exceptions = None  # type: ignore[assignment,misc]
    CLOUD_EXPORTERS_AVAILABLE = False
    _ResilientCloudMonitoringMetricsExporter = None  # type: ignore[misc,assignment]
    logging.warning(
        "Cloud exporters not available. Install opentelemetry-exporter-gcp-trace and "
        "opentelemetry-exporter-gcp-monitoring for Google Cloud integration."
    )

# -----------------------------------------------------------------------------
# Safety wrappers
# -----------------------------------------------------------------------------

class _SafeSpanExporter(SpanExporter):
    """
    Wrap a SpanExporter so exporter bugs/transient runtime failures don't crash the app.

    Some exporters have been observed to raise during export in certain runtime
    environments. Cloud Functions should never fail a request due to telemetry.
    """

    def __init__(self, exporter: SpanExporter):
        self._exporter = exporter

    def export(self, spans):  # type: ignore[override]
        try:
            return self._exporter.export(spans)
        except Exception as e:
            logger.warning(f"Tracing export failed (ignored): {e}", exc_info=True)
            return SpanExportResult.FAILURE

    def shutdown(self):  # type: ignore[override]
        try:
            return self._exporter.shutdown()
        except Exception:
            return None

    def force_flush(self, timeout_millis: int = 30000):  # type: ignore[override]
        try:
            return self._exporter.force_flush(timeout_millis=timeout_millis)
        except Exception:
            return False


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
            exporter = _SafeSpanExporter(CloudTraceSpanExporter(project_id=project_id))
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
            exporter = _ResilientCloudMonitoringMetricsExporter(project_id=project_id)
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

