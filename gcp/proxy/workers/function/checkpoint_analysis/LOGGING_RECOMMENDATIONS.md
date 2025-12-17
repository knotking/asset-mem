# OpenTelemetry Logging and Metrics Recommendations for Checkpoint Analysis

## Overview

This document outlines recommendations for:

1. **Structured Logging** in OpenTelemetry format for event tracking and BigQuery analytics
2. **OpenTelemetry Metrics** for time-series data and real-time monitoring

Both logs and metrics are complementary: logs capture detailed events with context, while metrics provide aggregatable numeric data for dashboards and alerting.

## Shared Observability Module

**⚠️ IMPORTANT: This feature now uses the shared observability module.**

All observability functionality (logging, metrics, tracing) is now provided by the shared module at `gcp/common/observability/`. This ensures consistency across all features and enables platform-wide analysis.

**Key Benefits:**

- ✅ Consistent naming and structure across all features
- ✅ Feature-specific helpers (`checkpoint`, `agent`, `document`, etc.)
- ✅ Easy filtering by feature in queries/reports
- ✅ Unified base infrastructure (Cloud Trace, Cloud Monitoring, Cloud Logging)

**See:** [`gcp/common/observability/README.md`](../../../../common/observability/README.md) for complete documentation.

### Quick Start with Shared Module

```python
# Initialize once at startup (in main.py)
from common.observability import initialize_observability
initialize_observability(enable_tracing=True, enable_metrics=True)

# Use checkpoint-specific helpers
from common.observability import checkpoint

# Log analysis completion
checkpoint.log_analysis_completed(
    checkpoint_id="checkpoint123",
    user_id="user456",
    property_id="prop789",
    duration_ms=2450,
    detected_room="Kitchen",
    asset_category="property"
)

# Record metrics
checkpoint.record_condition_score("roof", 90.0, {"user_id": "user456"})
checkpoint.record_damage_score("water", 10.0, {"user_id": "user456"})
```

**The implementation details below describe what to log/measure, but use the shared module for how to implement it.**

## Recommended Observability Architecture (Google Cloud Native)

This section outlines the recommended observability stack for the checkpoint analysis system using Google Cloud Platform native services.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    HomeApp Observability Stack                  │
└─────────────────────────────────────────────────────────────────┘

Application Layer:
├─ Cloud Functions (checkpoint-analysis-worker)
│  ├─ OpenTelemetry SDK
│  ├─ Metrics → CloudMonitoringMetricsExporter
│  ├─ Traces → CloudTraceSpanExporter
│  └─ Logs → Cloud Logging (automatic)
│

Metrics Layer:
├─ Cloud Monitoring
│  ├─ Custom metrics (property.condition.*, property.damage.*)
│  ├─ System metrics (function invocations, errors, latency)
│  ├─ Dashboards (operational monitoring)
│  └─ Alerting policies
│

Tracing Layer:
├─ Cloud Trace
│  ├─ Distributed tracing across services
│  ├─ Latency analysis
│  └─ Service dependency maps
│

Logging Layer:
├─ Cloud Logging (Primary)
│  ├─ Structured logs (OpenTelemetry format)
│  ├─ Log-based metrics
│  └─ Log sinks
│      │
│      ├─► Cloud Storage (Audit Trail)
│      │   └─ Long-term retention, compliance
│      │
│      └─► BigQuery (Analytics)
│          └─ Business intelligence
│              └─► Looker Studio (Dashboards)
│

Analytics Layer:
├─ BigQuery
│  ├─ Structured logs from Cloud Logging
│  ├─ Metrics exported as logs (option B)
│  └─ Custom SQL queries
│
└─ Looker Studio
   └─ Business dashboards, reports
```

### Tool Mappings: External Tools vs. Google Cloud Native

| External Tool   | Google Cloud Native Alternative                                                        | Recommendation                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prometheus**  | **Cloud Monitoring** (or Managed Service for Prometheus)                               | ✅ Use Cloud Monitoring directly. No infrastructure to manage, built-in integration with Cloud Functions. Only use Managed Service for Prometheus if you need PromQL compatibility. |
| **Grafana**     | **Cloud Monitoring Dashboards** (operational) + **Looker Studio** (business analytics) | ✅ Use Cloud Monitoring Dashboards for operational monitoring. Use Looker Studio connected to BigQuery for business intelligence and executive reports.                             |
| **Jaeger**      | **Cloud Trace**                                                                        | ✅ Use Cloud Trace. Automatic instrumentation for Cloud Functions, integrated with Cloud Logging for trace correlation.                                                             |
| **File Export** | **Cloud Logging → Log Sinks → Cloud Storage**                                          | ✅ Use Cloud Logging with log sinks. Automatic export to Cloud Storage for audit trails, and BigQuery for analytics.                                                                |

### When to Consider External Tools

Consider external tools (Prometheus/Grafana/Jaeger) if:

1. **Multi-Cloud Architecture**: Services span GCP, AWS, Azure
2. **Existing Tooling**: Already invested in Prometheus/Grafana infrastructure
3. **Advanced Grafana Features**: Need visualization features not available in Cloud Monitoring
4. **On-Premise Components**: Need to monitor on-premise infrastructure
5. **Cost Optimization**: Very high volume where managed services become expensive

**For this use case (Cloud Functions + Firestore + Pub/Sub):**
✅ **Recommended**: Use Google Cloud native services for simplicity, integration, and lower operational overhead.

### Implementation Components

#### 1. Metrics: Cloud Monitoring

**Export Path:**

```
OpenTelemetry Metrics SDK → CloudMonitoringMetricsExporter → Cloud Monitoring
```

**Benefits:**

- Automatic metric collection for Cloud Functions
- Built-in dashboards and alerting
- No infrastructure management
- Integrated with other GCP services

**See Section:** "OpenTelemetry Metrics (Additional to Logs)" for implementation details.

#### 2. Tracing: Cloud Trace

**Export Path:**

```
OpenTelemetry Tracing SDK → CloudTraceSpanExporter → Cloud Trace
```

**Benefits:**

- Automatic instrumentation for Cloud Functions
- Latency breakdown across services
- Service dependency graphs
- Trace correlation with logs

**Implementation:**

```python
# Add to requirements.txt
opentelemetry-exporter-cloud-trace>=1.20.0

# In main.py or checkpoint_service.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter

# Initialize tracer
provider = TracerProvider()
processor = BatchSpanProcessor(CloudTraceSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer(__name__)

# Use in code
with tracer.start_as_current_span("analyze_checkpoint_image") as span:
    span.set_attribute("checkpoint_id", checkpoint_id)
    span.set_attribute("user_id", user_id)
    span.set_attribute("property_id", property_id)
    # ... analysis code ...
```

#### 3. Logging: Cloud Logging → BigQuery + Cloud Storage

**Export Path:**

```
Cloud Functions → Cloud Logging (automatic)
                   ├─► Log Sink → BigQuery (analytics)
                   └─► Log Sink → Cloud Storage (audit trail)
```

**Benefits:**

- Centralized log management
- Automatic export via log sinks
- Long-term retention in Cloud Storage
- Structured querying in BigQuery

**Setup Log Sinks:**

1. **BigQuery Sink (for analytics):**

```bash
gcloud logging sinks create checkpoint-logs-bigquery \
  bigquery.googleapis.com/projects/PROJECT_ID/datasets/checkpoint_logs \
  --log-filter='resource.type="cloud_function"
                AND resource.labels.function_name="pubsub-checkpoint-analysis"'
```

2. **Cloud Storage Sink (for audit trail):**

```bash
gcloud logging sinks create checkpoint-logs-storage \
  storage.googleapis.com/checkpoint-logs-audit \
  --log-filter='resource.type="cloud_function"
                AND resource.labels.function_name="pubsub-checkpoint-analysis"'
```

#### 4. Visualization: Cloud Monitoring Dashboards + Looker Studio

**Cloud Monitoring Dashboards** (Operational):

- Real-time metrics (condition scores, damage indicators)
- Function performance (latency, errors, invocations)
- Alert policies (e.g., critical issues detected)
- Custom dashboards for checkpoint-specific metrics

**Looker Studio** (Business Analytics):

- Connect to BigQuery dataset
- Property condition trends over time
- Cost estimates and projections
- User engagement and usage patterns
- Executive reports and summaries

### Implementation Priority

#### Phase 1: Immediate (Already Planned)

- ✅ Structured logging → Cloud Logging → BigQuery
- ✅ OpenTelemetry Metrics → Cloud Monitoring

#### Phase 2: Next Steps

- ⏳ Cloud Trace integration for distributed tracing
- ⏳ Cloud Monitoring dashboards for custom metrics
- ⏳ Log sink → Cloud Storage for audit trail
- ⏳ Alerting policies in Cloud Monitoring

#### Phase 3: Optional (Future Enhancements)

- ⏳ Looker Studio dashboards connected to BigQuery
- ⏳ Advanced alerting and notification channels
- ⏳ Custom metric exporters for specialized use cases

### Integration Benefits

Using Google Cloud native services provides:

1. **Seamless Integration**: Automatic instrumentation for Cloud Functions
2. **Unified Platform**: All observability data in one ecosystem
3. **Lower Operational Overhead**: Fully managed services, no infrastructure to maintain
4. **Cost Efficiency**: Pay only for what you use, integrated billing
5. **Security**: Built-in IAM, encryption, and compliance features
6. **Scalability**: Automatically scales with your application
7. **Correlation**: Easy correlation between logs, metrics, and traces using trace IDs

### Trace Correlation Example

All three signals (logs, metrics, traces) can be correlated using trace IDs:

```
1. Request arrives at FastAPI endpoint
   └─ Trace ID: 4bf92f3577b34da6a3ce929d0e0e4736

2. Pub/Sub message published
   └─ Log: {"trace_id": "4bf92f...", "message": "Published to Pub/Sub"}

3. Cloud Function processes message
   └─ Trace Span: analyze_checkpoint_image
   └─ Metrics: analysis_duration_ms, issues_count
   └─ Log: {"trace_id": "4bf92f...", "event": "analysis.completed"}

4. In Cloud Console, you can:
   - View trace timeline in Cloud Trace
   - See related logs filtered by trace_id
   - View metrics for the same time window
```

## Log Event Types

### 1. Analysis Completion Event

**When:** After successful checkpoint analysis completes

### 2. Analysis Failure Event

**When:** When checkpoint analysis fails

### 3. Comparison Completion Event

**When:** After successful checkpoint comparison completes

### 4. Comparison Skipped Event

**When:** Comparison is skipped (no previous checkpoint, low confidence, user preference, etc.)

## OpenTelemetry Log Structure

### Base Structure

```python
{
    "severity": "INFO" | "WARNING" | "ERROR",
    "timestamp": "2024-01-15T10:30:00.123Z",  # RFC3339 format
    "trace": {
        "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",  # 32 hex chars
        "span_id": "00f067aa0ba902b7"  # 16 hex chars
    },
    "resource": {
        "cloud.provider": "gcp",
        "cloud.platform": "gcp_cloud_functions",
        "cloud.region": "us-central1",
        "faas.name": "pubsub-checkpoint-analysis",
        "faas.version": "1.0.0"
    },
    "body": {
        "event_type": "checkpoint.analysis.completed" | "checkpoint.analysis.failed" | "checkpoint.comparison.completed" | "checkpoint.comparison.skipped",
        "event_version": "1.0",

        # User/Property Context
        "user_id": "user123",
        "property_id": "prop456",
        "checkpoint_id": "checkpoint789",

        # Asset Information
        "asset_category": "property" | "vehicle" | "appliance" | "generic",
        "detected_room": "Kitchen" | "Car" | "Refrigerator" | null,
        "detected_room_confidence": 0.95,  # 0.0-1.0
        "location": "Kitchen",  # Final location used (user-provided or detected)
        "media_type": "image" | "video",
        "content_type": "image/jpeg" | "video/mp4",

        # Analysis Results
        "analysis": {
            "summary": "Kitchen in good condition with modern appliances",
            "conditions_count": 3,
            "conditions": ["good", "clean", "well-maintained"],
            "detected_items_count": 5,
            "issues_count": 0,
            "issues_severity": "none" | "minor" | "moderate" | "major" | "critical",
            "ai_confidence": 0.9,  # Overall confidence score
            "duration_ms": 2450  # Analysis duration in milliseconds
        },

        # Comparison Results (only for comparison events)
        "comparison": {
            "previous_checkpoint_id": "checkpoint456",
            "similarity_score": 0.85,  # 0.0-1.0
            "semantic_changes_count": 2,
            "change_regions_count": 3,
            "change_severity_max": "minor" | "moderate" | "major" | "critical",
            "duration_ms": 3120
        },

        # Performance Metrics
        "performance": {
            "total_duration_ms": 5570,  # Total processing time
            "analysis_duration_ms": 2450,
            "comparison_duration_ms": 3120,  # 0 if no comparison
            "firestore_operations": 3,  # Number of Firestore operations
            "gemini_api_calls": 2  # Number of Gemini API calls
        },

        # Error Information (only for failure events)
        "error": {
            "code": "ANALYSIS_FAILED" | "GEMINI_ERROR" | "FIRESTORE_ERROR" | "COMPARISON_FAILED",
            "message": "Gemini API returned error: Rate limit exceeded",
            "stack_trace": "..."  # Optional, for debugging
        },

        # User Preferences Context
        "preferences": {
            "comparison_enabled": true,
            "max_age_days": 180,
            "min_room_confidence": 0.3
        },

        # Skip Reason (only for comparison.skipped events)
        "skip_reason": "no_previous_checkpoint" | "low_confidence" | "user_disabled" | "preferences_disabled" | "checkpoint_flag"
    }
}
```

## Implementation Recommendations

### 1. Use Shared Observability Module

**✅ Recommended Approach:** Use the shared observability module instead of creating local implementations.

The shared module (`gcp/common/observability/`) provides:

- Checkpoint-specific helpers via `checkpoint` object
- Consistent event types and metric names
- Automatic trace correlation
- Cloud Trace, Cloud Monitoring, and Cloud Logging integration

**Hybrid Approach:** The common module provides standard helpers, but you can extend them with custom logic in your feature directory if needed. See the observability module README for details on extending helpers.

**Example Implementation (Standard Helpers):**

```python
# In gcp/proxy/workers/function/checkpoint_analysis/main.py

from common.observability import initialize_observability, checkpoint
from common.observability.constants import FEATURE_CHECKPOINT
import time

# Initialize once (at module level or startup)
initialize_observability(enable_tracing=True, enable_metrics=True)

def pubsub_checkpoint_analysis(request, context):
    start_time = time.time()

    # ... existing code to parse payload ...

    try:
        analysis_start = time.time()
        analysis_result = analyze_checkpoint_image(image_url, content_type, location)
        analysis_duration_ms = (time.time() - analysis_start) * 1000

        # ... update Firestore ...

        # Log analysis completion using shared module
        checkpoint.log_analysis_completed(
            checkpoint_id=checkpoint_id,
            user_id=user_id,
            property_id=property_id,
            duration_ms=analysis_duration_ms,
            detected_room=analysis_result.get("detectedRoom"),
            asset_category=asset_category,
            condition_scores=condition_scores,  # If available from analysis_result
            damage_scores=damage_scores,  # If available
            issues_count=len(analysis_result.get("issues", []))
        )

        # Record metrics using shared module
        if condition_scores:
            for component, score in condition_scores.items():
                checkpoint.record_condition_score(
                    component,
                    score,
                    attributes={"user_id": user_id, "property_id": property_id}
                )

        # ... comparison logic ...

    except Exception as e:
        total_duration_ms = (time.time() - start_time) * 1000
        # Log failure using shared module
        from common.observability.logging_helper import log_exception
        log_exception(
            feature=FEATURE_CHECKPOINT,
            user_id=user_id,
            exception=e,
            error_code="ANALYSIS_FAILED",
            additional_data={
                "checkpoint_id": checkpoint_id,
                "property_id": property_id
            }
        )
```

**Legacy Implementation (for reference):**

<details>
<summary>Click to expand legacy implementation details</summary>

The following shows how logging was previously implemented. This is now replaced by the shared module.

```python
# gcp/proxy/workers/function/checkpoint_analysis/logging_helper.py (LEGACY - DO NOT USE)

import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import google.cloud.logging
from google.cloud.logging_v2.resource import Resource

logger = logging.getLogger(__name__)

# Initialize Cloud Logging client
_client = None

def get_logging_client():
    """Get or create Cloud Logging client."""
    global _client
    if _client is None:
        _client = google.cloud.logging.Client()
    return _client

def format_trace_id(trace_id: str) -> str:
    """Format trace ID for OpenTelemetry (32 hex chars)."""
    # Remove dashes if present, pad to 32 chars
    trace_id = trace_id.replace('-', '')
    return trace_id[:32].zfill(32)

def format_span_id(span_id: str) -> str:
    """Format span ID for OpenTelemetry (16 hex chars)."""
    span_id = str(span_id).replace('-', '')
    return span_id[:16].zfill(16)

def log_analysis_completed(
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    asset_category: str,
    detected_room: Optional[str],
    detected_room_confidence: float,
    location: str,
    media_type: str,
    content_type: str,
    analysis_result: Dict[str, Any],
    duration_ms: float,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None
):
    """Log checkpoint analysis completion event."""
    issues = analysis_result.get("issues", [])
    issues_severity = "none"
    if issues:
        # Determine max severity (you'd need to parse issues or have severity in results)
        issues_severity = "minor"  # Default, would need enhancement

    log_body = {
        "event_type": "checkpoint.analysis.completed",
        "event_version": "1.0",
        "user_id": user_id,
        "property_id": property_id,
        "checkpoint_id": checkpoint_id,
        "asset_category": asset_category,
        "detected_room": detected_room,
        "detected_room_confidence": detected_room_confidence,
        "location": location,
        "media_type": media_type,
        "content_type": content_type,
        "analysis": {
            "summary": analysis_result.get("summary", ""),
            "conditions_count": len(analysis_result.get("conditions", [])),
            "conditions": analysis_result.get("conditions", []),
            "detected_items_count": len(analysis_result.get("detectedItems", [])),
            "issues_count": len(issues),
            "issues_severity": issues_severity,
            "ai_confidence": analysis_result.get("aiConfidence", 0.9),
            "duration_ms": duration_ms
        },
        "performance": {
            "total_duration_ms": duration_ms,
            "analysis_duration_ms": duration_ms,
            "comparison_duration_ms": 0,
            "firestore_operations": 1,
            "gemini_api_calls": 1
        }
    }

    _log_structured(log_body, "INFO", trace_id, span_id)

def log_comparison_completed(
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    previous_checkpoint_id: str,
    location: str,
    comparison_result: Dict[str, Any],
    duration_ms: float,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None
):
    """Log checkpoint comparison completion event."""
    regions = comparison_result.get("regions", [])
    max_severity = "none"
    if regions:
        severities = [r.get("severity", "minor") for r in regions]
        severity_levels = {"none": 0, "minor": 1, "moderate": 2, "major": 3, "critical": 4}
        max_severity = max(severities, key=lambda s: severity_levels.get(s, 0))

    log_body = {
        "event_type": "checkpoint.comparison.completed",
        "event_version": "1.0",
        "user_id": user_id,
        "property_id": property_id,
        "checkpoint_id": checkpoint_id,
        "location": location,
        "comparison": {
            "previous_checkpoint_id": previous_checkpoint_id,
            "similarity_score": comparison_result.get("similarityScore", 1.0),
            "semantic_changes_count": len(comparison_result.get("semanticChanges", [])),
            "change_regions_count": len(regions),
            "change_severity_max": max_severity,
            "duration_ms": duration_ms
        },
        "performance": {
            "comparison_duration_ms": duration_ms,
            "gemini_api_calls": 1
        }
    }

    _log_structured(log_body, "INFO", trace_id, span_id)

def log_comparison_skipped(
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    skip_reason: str,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None
):
    """Log checkpoint comparison skipped event."""
    log_body = {
        "event_type": "checkpoint.comparison.skipped",
        "event_version": "1.0",
        "user_id": user_id,
        "property_id": property_id,
        "checkpoint_id": checkpoint_id,
        "skip_reason": skip_reason
    }

    _log_structured(log_body, "INFO", trace_id, span_id)

def log_analysis_failed(
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    error_code: str,
    error_message: str,
    duration_ms: float,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None
):
    """Log checkpoint analysis failure event."""
    log_body = {
        "event_type": "checkpoint.analysis.failed",
        "event_version": "1.0",
        "user_id": user_id,
        "property_id": property_id,
        "checkpoint_id": checkpoint_id,
        "error": {
            "code": error_code,
            "message": error_message
        },
        "performance": {
            "total_duration_ms": duration_ms
        }
    }

    _log_structured(log_body, "ERROR", trace_id, span_id)

def _log_structured(
    body: Dict[str, Any],
    severity: str,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None
):
    """Write structured log entry to Cloud Logging."""
    try:
        client = get_logging_client()

        # Build log entry with OpenTelemetry structure
        log_entry_data = {
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "body": body
        }

        # Add trace context if available
        if trace_id and span_id:
            log_entry_data["trace"] = {
                "trace_id": format_trace_id(trace_id),
                "span_id": format_span_id(span_id)
            }

        # Add resource information
        log_entry_data["resource"] = {
            "type": "cloud_function",
            "labels": {
                "function_name": "pubsub-checkpoint-analysis",
                "region": "us-central1"  # Should come from env
            }
        }

        # Use Cloud Logging structured logging
        logger.info(
            "Checkpoint analysis event",
            extra={
                "json_fields": log_entry_data
            }
        )

    except Exception as e:
        # Fallback to standard logging if Cloud Logging fails
        logger.error(f"Failed to write structured log: {e}", exc_info=True)
        logger.info(f"Event: {body.get('event_type')} - {body}")
```

</details>

### 2. Usage in Main Worker (Using Shared Module)

```python
# In gcp/proxy/workers/function/checkpoint_analysis/main.py

from common.observability import initialize_observability, checkpoint
from common.observability.constants import (
    FEATURE_CHECKPOINT,
    EVENT_CHECKPOINT_COMPARISON_COMPLETED,
    EVENT_CHECKPOINT_COMPARISON_SKIPPED
)
from common.observability.logging_helper import log_event, log_exception
from common.observability.base import get_tracer
import time

# Initialize observability infrastructure
initialize_observability(enable_tracing=True, enable_metrics=True)

def pubsub_checkpoint_analysis(request, context):
    start_time = time.time()

    # Get tracer for distributed tracing
    tracer = get_tracer(__name__)

    with tracer.start_as_current_span("pubsub_checkpoint_analysis") as span:
        span.set_attribute("checkpoint_id", checkpoint_id)
        span.set_attribute("user_id", user_id)
        span.set_attribute("property_id", property_id)

        # ... existing code to parse payload ...

        try:
            analysis_start = time.time()
            analysis_result = analyze_checkpoint_image(image_url, content_type, location)
            analysis_duration_ms = (time.time() - analysis_start) * 1000

            # Determine asset category
            asset_category = get_asset_category(
                analysis_result.get("detectedRoom"),
                analysis_result.get("roomFeatures", [])
            )

            # Extract condition/damage scores if available (from enhanced Gemini response)
            condition_scores = analysis_result.get("condition_scores", {})
            damage_scores = analysis_result.get("damage_scores", {})

            # ... update Firestore ...

            # Log analysis completion using shared module
            checkpoint.log_analysis_completed(
                checkpoint_id=checkpoint_id,
                user_id=user_id,
                property_id=property_id,
                duration_ms=analysis_duration_ms,
                detected_room=analysis_result.get("detectedRoom"),
                asset_category=asset_category,
                condition_scores=condition_scores,
                damage_scores=damage_scores,
                issues_count=len(analysis_result.get("issues", []))
            )

            # Record metrics using shared module
            attributes = {"user_id": user_id, "property_id": property_id}
            if condition_scores:
                for component, score in condition_scores.items():
                    checkpoint.record_condition_score(component, score, attributes)
            if damage_scores:
                for damage_type, score in damage_scores.items():
                    checkpoint.record_damage_score(damage_type, score, attributes)

            # Record issue counts
            issues = analysis_result.get("issues", [])
            # Parse issues by severity (would need enhanced issue format from Gemini)
            # For now, count all as minor
            if issues:
                checkpoint.record_issue_count("minor", len(issues), attributes)

            # ... comparison logic ...

            if should_compare:
                comparison_start = time.time()
                comparison_result = compare_checkpoints(...)
                comparison_duration_ms = (time.time() - comparison_start) * 1000

                # Log comparison completion
                checkpoint.log_comparison_completed(
                    checkpoint_id=checkpoint_id,
                    user_id=user_id,
                    property_id=property_id,
                    compared_with_checkpoint_id=previous_checkpoint.get("id"),
                    duration_ms=comparison_duration_ms,
                    similarity_score=comparison_result.get("similarityScore", 1.0),
                    semantic_changes_count=len(comparison_result.get("semanticChanges", []))
                )
            else:
                # Log comparison skipped
                log_event(
                    EVENT_CHECKPOINT_COMPARISON_SKIPPED,
                    {
                        "checkpoint_id": checkpoint_id,
                        "user_id": user_id,
                        "property_id": property_id,
                        "skip_reason": "no_previous_checkpoint"  # Determine from context
                    },
                    severity="INFO"
                )

        except Exception as e:
            total_duration_ms = (time.time() - start_time) * 1000
            log_exception(
                feature=FEATURE_CHECKPOINT,
                user_id=user_id,
                exception=e,
                error_code="ANALYSIS_FAILED",
                additional_data={
                    "checkpoint_id": checkpoint_id,
                    "property_id": property_id,
                    "duration_ms": total_duration_ms
                }
            )
            raise
```

## BigQuery Export Setup

### 1. Create Log Sink

```bash
gcloud logging sinks create checkpoint-analysis-sink \
    bigquery.googleapis.com/projects/YOUR_PROJECT/datasets/checkpoint_logs \
    --log-filter='
        resource.type="cloud_function"
        resource.labels.function_name="pubsub-checkpoint-analysis"
        jsonPayload.body.event_type=~"checkpoint\\.(analysis|comparison)\\..*"
    ' \
    --use-partitioned-tables
```

### 2. BigQuery Schema (Auto-created from logs)

The schema will be automatically inferred, but you can create a view for easier querying:

```sql
-- Create view for analysis events
CREATE OR REPLACE VIEW `project.checkpoint_logs.analysis_events` AS
SELECT
    TIMESTAMP(timestamp) as event_timestamp,
    body.event_type as event_type,
    body.user_id as user_id,
    body.property_id as property_id,
    body.checkpoint_id as checkpoint_id,
    body.asset_category as asset_category,
    body.detected_room as detected_room,
    body.detected_room_confidence as detected_room_confidence,
    body.location as location,
    body.media_type as media_type,
    body.analysis.conditions_count as conditions_count,
    body.analysis.issues_count as issues_count,
    body.analysis.issues_severity as issues_severity,
    body.analysis.ai_confidence as ai_confidence,
    body.performance.total_duration_ms as total_duration_ms,
    body.error.code as error_code,
    body.error.message as error_message
FROM
    `project.checkpoint_logs.cloud_function_*`
WHERE
    body.event_type LIKE 'checkpoint.analysis.%'

-- Create view for comparison events
CREATE OR REPLACE VIEW `project.checkpoint_logs.comparison_events` AS
SELECT
    TIMESTAMP(timestamp) as event_timestamp,
    body.event_type as event_type,
    body.user_id as user_id,
    body.property_id as property_id,
    body.checkpoint_id as checkpoint_id,
    body.comparison.previous_checkpoint_id as previous_checkpoint_id,
    body.comparison.similarity_score as similarity_score,
    body.comparison.semantic_changes_count as semantic_changes_count,
    body.comparison.change_regions_count as change_regions_count,
    body.comparison.change_severity_max as change_severity_max,
    body.comparison.duration_ms as comparison_duration_ms,
    body.skip_reason as skip_reason
FROM
    `project.checkpoint_logs.cloud_function_*`
WHERE
    body.event_type LIKE 'checkpoint.comparison.%'
```

## Example Analytics Queries

### 1. Analysis Success Rate by Asset Category

```sql
SELECT
    asset_category,
    COUNT(*) as total_analyses,
    SUM(CASE WHEN event_type = 'checkpoint.analysis.completed' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN event_type = 'checkpoint.analysis.failed' THEN 1 ELSE 0 END) as failed,
    ROUND(
        SUM(CASE WHEN event_type = 'checkpoint.analysis.completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
        2
    ) as success_rate_percent
FROM
    `project.checkpoint_logs.analysis_events`
WHERE
    TIMESTAMP(timestamp) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY
    asset_category
ORDER BY
    total_analyses DESC
```

### 2. Average Analysis Duration by Media Type

```sql
SELECT
    media_type,
    COUNT(*) as count,
    ROUND(AVG(total_duration_ms), 2) as avg_duration_ms,
    ROUND(MIN(total_duration_ms), 2) as min_duration_ms,
    ROUND(MAX(total_duration_ms), 2) as max_duration_ms,
    ROUND(APPROX_QUANTILES(total_duration_ms, 100)[OFFSET(50)], 2) as p50_duration_ms,
    ROUND(APPROX_QUANTILES(total_duration_ms, 100)[OFFSET(95)], 2) as p95_duration_ms
FROM
    `project.checkpoint_logs.analysis_events`
WHERE
    event_type = 'checkpoint.analysis.completed'
    AND TIMESTAMP(timestamp) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY
    media_type
```

### 3. Issues Detected Trend

```sql
SELECT
    DATE(timestamp) as date,
    COUNT(*) as checkpoints_analyzed,
    SUM(issues_count) as total_issues,
    SUM(CASE WHEN issues_severity = 'critical' THEN 1 ELSE 0 END) as critical_issues,
    SUM(CASE WHEN issues_severity = 'major' THEN 1 ELSE 0 END) as major_issues,
    ROUND(AVG(issues_count), 2) as avg_issues_per_checkpoint
FROM
    `project.checkpoint_logs.analysis_events`
WHERE
    event_type = 'checkpoint.analysis.completed'
    AND TIMESTAMP(timestamp) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY
    date
ORDER BY
    date DESC
```

### 4. Comparison Statistics

```sql
SELECT
    change_severity_max,
    COUNT(*) as comparison_count,
    ROUND(AVG(similarity_score), 3) as avg_similarity,
    ROUND(AVG(semantic_changes_count), 2) as avg_changes,
    ROUND(AVG(comparison_duration_ms), 2) as avg_duration_ms
FROM
    `project.checkpoint_logs.comparison_events`
WHERE
    event_type = 'checkpoint.comparison.completed'
    AND TIMESTAMP(event_timestamp) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY
    change_severity_max
ORDER BY
    comparison_count DESC
```

### 5. Top Detected Rooms/Areas

```sql
SELECT
    detected_room,
    asset_category,
    COUNT(*) as checkpoint_count,
    ROUND(AVG(detected_room_confidence), 3) as avg_confidence,
    SUM(issues_count) as total_issues
FROM
    `project.checkpoint_logs.analysis_events`
WHERE
    event_type = 'checkpoint.analysis.completed'
    AND detected_room IS NOT NULL
    AND TIMESTAMP(timestamp) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY
    detected_room,
    asset_category
ORDER BY
    checkpoint_count DESC
LIMIT 20
```

## OpenTelemetry Metrics (Additional to Logs)

In addition to structured logging, you should also export **OpenTelemetry Metrics** for time-series analytics. Metrics complement logs by providing aggregatable numeric data that can be efficiently queried over time.

### Required Metrics

All metrics should follow OpenTelemetry standard naming conventions and be instrumented with appropriate metric types:

#### 1. Condition Metrics (Gauges 0-100)

Property condition scores for different components:

- `property.condition.roof` - Roof condition score (0-100)
- `property.condition.wall` - Wall condition score (0-100)
- `property.condition.foundation` - Foundation integrity score (0-100)
- `property.condition.overall` - Overall property condition score (0-100)
- `property.condition.windows` - Windows condition score (0-100)
- `property.condition.doors` - Doors condition score (0-100)
- `property.condition.paint` - Paint condition score (0-100)
- `property.condition.flooring` - Flooring condition score (0-100)
- `property.condition.ceiling` - Ceiling condition score (0-100)
- `property.condition.plumbing` - Plumbing condition score (0-100)
- `property.condition.electrical` - Electrical system condition score (0-100)
- `property.condition.hvac` - HVAC system condition score (0-100)

#### 2. Damage Indicators (Gauges 0-100)

Damage severity scores:

- `property.damage.water` - Water damage severity (0-100)
- `property.damage.mold` - Mold presence level (0-100)
- `property.damage.pest` - Pest damage score (0-100)
- `property.damage.cracks` - Structural crack severity (0-100)

#### 3. Cost Metrics (Gauges in USD)

Estimated costs:

- `property.cost.repairs_immediate` - Immediate repair cost estimate (USD)
- `property.cost.maintenance_annual` - Annual maintenance projection (USD)

#### 4. Issue Counters

Count of issues by severity:

- `property.issues.critical` - Count of critical issues (Counter)
- `property.issues.moderate` - Count of moderate issues (Counter)
- `property.issues.minor` - Count of minor issues (Counter)

#### 5. Deterioration Rate (Histogram)

Rate of condition decline:

- `property.deterioration.rate` - Rate of condition decline per time period (Histogram, unit: condition_points/day)

### Implementation: Using Shared Observability Module

**✅ Use the shared module instead of creating local metrics helpers.**

The shared observability module (`gcp/proxy/common/observability/`) provides all metrics recording functionality through the `checkpoint` helper object.

**Example Usage:**

```python
# In gcp/proxy/workers/function/checkpoint_analysis/main.py

from common.observability import initialize_observability, checkpoint
from common.observability.metrics_helper import record_histogram

# Initialize observability (once at startup)
initialize_observability(enable_tracing=True, enable_metrics=True)

def pubsub_checkpoint_analysis(request, context):
    # ... analysis code ...

    # Extract metrics from analysis result
    condition_scores = analysis_result.get("condition_scores", {})
    damage_scores = analysis_result.get("damage_scores", {})
    cost_estimates = analysis_result.get("cost_estimates", {})
    issues_by_severity = analysis_result.get("issues_by_severity", {})

    # Record metrics using shared module helpers
    attributes = {
        "user_id": user_id,
        "property_id": property_id,
        "checkpoint_id": checkpoint_id
    }

    # Condition scores (gauges)
    for component, score in condition_scores.items():
        checkpoint.record_condition_score(component, score, attributes)

    # Damage indicators (gauges)
    for damage_type, score in damage_scores.items():
        checkpoint.record_damage_score(damage_type, score, attributes)

    # Cost estimates (gauges)
    if cost_estimates.get("repairs_immediate"):
        checkpoint.record_cost_estimate(
            "repairs_immediate",
            cost_estimates["repairs_immediate"],
            attributes
        )
    if cost_estimates.get("maintenance_annual"):
        checkpoint.record_cost_estimate(
            "maintenance_annual",
            cost_estimates["maintenance_annual"],
            attributes
        )

    # Issue counts (counters)
    for severity, count in issues_by_severity.items():
        checkpoint.record_issue_count(severity, count, attributes)

    # Deterioration rate (histogram) - if comparison available
    if comparison_result and previous_checkpoint:
        # Calculate rate based on condition score change
        previous_score = previous_checkpoint.get("aiAnalysis", {}).get("condition_scores", {}).get("overall")
        current_score = condition_scores.get("overall")
        if previous_score and current_score:
            days_diff = (current_time - previous_time).days
            if days_diff > 0:
                rate = (previous_score - current_score) / days_diff
                record_histogram(
                    "checkpoint.deterioration.rate",
                    value=rate,
                    attributes=attributes,
                    unit="1/day"
                )
```

**See:** [`gcp/common/observability/README.md`](../../../../common/observability/README.md) for complete metrics API documentation.

### Enhanced Gemini Prompts for Metrics

To extract these metrics, you'll need to enhance the Gemini analysis prompts to return structured data:

```python
# Enhanced prompt in checkpoint_service.py

prompt = f"""
    Analyze this {media_type} of a property checkpoint.
    Location: {location or 'Unknown'}

    Provide a structured analysis in JSON format with the following fields:
    - summary: A brief summary of what is seen.
    - conditions: A list of conditions (e.g., "good", "damaged", "wear and tear", "clean", "cluttered").
    - detectedItems: A list of objects or items identified.
    - issues: A list of potential issues or damage detected, each with severity.

    Additionally, provide structured condition and damage scores:
    - condition_scores: An object with component names as keys and scores (0-100) as values:
        * roof: 0-100 (100 = perfect, 0 = completely damaged)
        * wall: 0-100
        * foundation: 0-100
        * overall: 0-100 (weighted average of all components)
        * windows: 0-100 (if visible)
        * doors: 0-100 (if visible)
        * paint: 0-100 (if visible)
        * flooring: 0-100 (if visible)
        * ceiling: 0-100 (if visible)
        * plumbing: 0-100 (if visible/apparent)
        * electrical: 0-100 (if visible/apparent)
        * hvac: 0-100 (if visible/apparent)

    - damage_scores: An object with damage types as keys and severity (0-100) as values:
        * water: 0-100 (0 = none, 100 = severe)
        * mold: 0-100
        * pest: 0-100
        * cracks: 0-100

    - cost_estimates: An object with cost estimates:
        * repairs_immediate: Estimated immediate repair cost in USD (0 if none needed)
        * maintenance_annual: Estimated annual maintenance cost in USD

    - issues_by_severity: An object with counts by severity:
        * critical: count of critical issues
        * moderate: count of moderate issues
        * minor: count of minor issues
"""
```

### Integration in Main Worker (Using Shared Module)

**See the "Usage in Main Worker" section above for complete integration example.**

The shared module provides all the functionality needed. Key points:

1. **Initialize once**: Call `initialize_observability()` at startup
2. **Use checkpoint helpers**: Use `checkpoint.log_analysis_completed()`, `checkpoint.record_condition_score()`, etc.
3. **Automatic trace correlation**: Traces are automatically correlated with logs via trace IDs
4. **Feature filtering**: All metrics/logs use `checkpoint.*` prefix for easy filtering

**Example metrics recording:**

```python
from common.observability import checkpoint
from common.observability.metrics_helper import record_histogram
from datetime import datetime, timezone

# After analysis
condition_scores = analysis_result.get("condition_scores", {})
for component, score in condition_scores.items():
    checkpoint.record_condition_score(
        component,
        score,
        {"user_id": user_id, "property_id": property_id}
    )

# After comparison (calculate deterioration rate)
if comparison_result and previous_checkpoint:
    previous_overall = previous_checkpoint.get("condition_scores", {}).get("overall")
    current_overall = condition_scores.get("overall")
    if previous_overall and current_overall:
        days_diff = (datetime.now(timezone.utc) - previous_time).days
        if days_diff > 0:
            rate = (previous_overall - current_overall) / days_diff
            record_histogram(
                "checkpoint.deterioration.rate",
                rate,
                {"user_id": user_id, "property_id": property_id},
                unit="1/day"
            )
```

### Metrics Export Options

#### Option A: Cloud Monitoring (Recommended for Real-time Dashboards)

Metrics exported via OpenTelemetry Metrics SDK automatically appear in Cloud Monitoring and can be:

- Viewed in Cloud Console dashboards
- Used for alerting
- Queried via Cloud Monitoring API
- Exported to BigQuery via log sink (if metrics are also logged)

#### Option B: Structured Logs (Recommended for BigQuery Analytics)

Alternatively, include metrics in structured logs for BigQuery analysis:

```python
# Add to log_analysis_completed function

log_body = {
    # ... existing fields ...
    "metrics": {
        "condition_scores": condition_scores,  # From analysis_result
        "damage_scores": damage_scores,
        "cost_estimates": cost_estimates,
        "issues_by_severity": issues_by_severity,
    }
}
```

### BigQuery Queries for Metrics

If metrics are included in logs, you can query them in BigQuery:

```sql
-- Average condition scores by component over time
SELECT
    DATE(timestamp) as date,
    JSON_EXTRACT_SCALAR(metrics.condition_scores, '$.roof') as roof_score,
    JSON_EXTRACT_SCALAR(metrics.condition_scores, '$.wall') as wall_score,
    JSON_EXTRACT_SCALAR(metrics.condition_scores, '$.overall') as overall_score,
    AVG(CAST(JSON_EXTRACT_SCALAR(metrics.condition_scores, '$.overall') AS FLOAT64)) as avg_overall
FROM
    `project.checkpoint_logs.cloud_function_*`
WHERE
    body.event_type = 'checkpoint.analysis.completed'
    AND metrics.condition_scores IS NOT NULL
    AND TIMESTAMP(timestamp) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY
    date, roof_score, wall_score, overall_score
ORDER BY
    date DESC

-- Damage indicator trends
SELECT
    DATE(timestamp) as date,
    AVG(CAST(JSON_EXTRACT_SCALAR(metrics.damage_scores, '$.water') AS FLOAT64)) as avg_water_damage,
    AVG(CAST(JSON_EXTRACT_SCALAR(metrics.damage_scores, '$.mold') AS FLOAT64)) as avg_mold,
    AVG(CAST(JSON_EXTRACT_SCALAR(metrics.damage_scores, '$.cracks') AS FLOAT64)) as avg_cracks
FROM
    `project.checkpoint_logs.cloud_function_*`
WHERE
    body.event_type = 'checkpoint.analysis.completed'
    AND metrics.damage_scores IS NOT NULL
    AND TIMESTAMP(timestamp) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY
    date
ORDER BY
    date DESC

-- Cost estimates analysis
SELECT
    body.property_id,
    AVG(CAST(JSON_EXTRACT_SCALAR(metrics.cost_estimates, '$.repairs_immediate') AS FLOAT64)) as avg_immediate_repairs,
    AVG(CAST(JSON_EXTRACT_SCALAR(metrics.cost_estimates, '$.maintenance_annual') AS FLOAT64)) as avg_annual_maintenance,
    COUNT(*) as checkpoint_count
FROM
    `project.checkpoint_logs.cloud_function_*`
WHERE
    body.event_type = 'checkpoint.analysis.completed'
    AND metrics.cost_estimates IS NOT NULL
    AND TIMESTAMP(timestamp) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
GROUP BY
    body.property_id
ORDER BY
    avg_immediate_repairs DESC
```

### Requirements.txt Addition

**✅ Dependencies are managed by the shared observability module.**

Add these to your `requirements.txt` (if not already present in the shared module's dependencies):

```txt
# OpenTelemetry dependencies (may already be in shared module)
opentelemetry-api>=1.20.0
opentelemetry-sdk>=1.20.0
opentelemetry-exporter-cloud-trace>=1.20.0
opentelemetry-exporter-cloud-monitoring>=1.20.0
```

**Note:** The shared module handles all OpenTelemetry initialization. You just need to ensure these packages are available in your deployment environment.

## Best Practices

1. **Use Shared Module**: ✅ Always use `gcp/proxy/common/observability/` instead of creating local implementations
2. **Feature Prefixes**: All metrics/logs use `checkpoint.*` prefix for easy filtering
3. **Trace Correlation**: Shared module automatically includes trace_id and span_id for correlating logs across services
4. **Structured Fields**: Always use structured fields (not string concatenation) for better querying
5. **Consistent Naming**: Use constants from `common.observability.constants` for event types and metric names
6. **Version Fields**: Event version is automatically included by shared module (currently "1.0")
7. **Performance Metrics**: Log duration and operation counts for performance analysis
8. **Error Context**: Use `log_exception()` helper for automatic error logging with stack traces
9. **User Preferences**: Log user preference context for understanding behavior patterns
10. **Metrics + Logs**: Export both metrics (for time-series) and logs (for detailed events)
11. **Metric Attributes**: Use consistent attributes (user_id, property_id, checkpoint_id) for grouping and filtering
12. **Metric Units**: Always specify correct units (USD for costs, 1 for dimensionless scores)

## Related Documentation

- **[Shared Observability Module](../../../../common/observability/README.md)** - Complete API documentation for the shared observability module
- **[Observability Constants](../../../../common/observability/constants.py)** - All event types, metric names, and feature identifiers
- **[Feature Helpers](../../../../common/observability/feature_helpers.py)** - Feature-specific convenience functions
