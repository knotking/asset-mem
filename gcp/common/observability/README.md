# Shared Observability Module

This module provides unified observability capabilities (metrics, logs, traces) across all features of the AssetMem platform. It supports both platform-wide analysis and feature-specific reporting.

## Logging context vs ADK agents

Request-scoped `auth_uid` / `correlation_id` for **proxy and workers** live in `common/observability/logging_context.py`. Vertex ADK agents use the parallel module in `gcp/agent_framework/observability/logging_context.py` (deployed with Agent Engine). Keep behavior in sync when changing either.

## Structure

```
common/observability/
├── __init__.py              # Public API exports
├── constants.py             # Event types, metric names, feature identifiers
├── base.py                  # Base OpenTelemetry initialization (traces, metrics)
├── logging_helper.py        # Structured logging helpers
├── metrics_helper.py        # Metrics recording helpers
├── feature_helpers.py       # Feature-specific convenience functions
└── README.md               # This file
```

## Features

### 1. **Feature-Based Organization**

All metrics and logs are organized by feature prefix:

- `checkpoint.*` - Checkpoint analysis feature
- `agent.*` - AI agent system
- `document.*` - Document analysis
- `rag.*` - RAG document processing
- `service_broker.*` - Service broker integration
- `telegram.*` - Telegram bot
- `platform.*` - Platform-wide metrics

This enables:

- ✅ Easy filtering by feature in BigQuery/Cloud Monitoring
- ✅ Feature-specific dashboards
- ✅ Cost tracking per feature
- ✅ Performance analysis per feature

### 2. **Unified Base Infrastructure**

All features share the same OpenTelemetry infrastructure:

- Cloud Trace for distributed tracing
- Cloud Monitoring for metrics
- Cloud Logging for structured logs

### 3. **Feature-Specific Helpers**

Each feature has a helper class with convenient methods:

- `CheckpointObservability` - Checkpoint-specific helpers
- `AgentObservability` - Agent-specific helpers
- `DocumentObservability` - Document-specific helpers
- `RAGObservability` - RAG-specific helpers
- `PlatformObservability` - Platform-wide helpers

## Usage

### Basic Setup

```python
from common.observability import initialize_observability

# Initialize once at application startup
initialize_observability(enable_tracing=True, enable_metrics=True)
```

### Feature-Specific Usage

#### Checkpoint Feature

```python
from common.observability import checkpoint
from common.observability.constants import FEATURE_CHECKPOINT

# Log analysis completion
checkpoint.log_analysis_completed(
    checkpoint_id="checkpoint123",
    user_id="user456",
    property_id="prop789",
    duration_ms=2450,
    detected_room="Kitchen",
    asset_category="property",
    condition_scores={"overall": 85, "roof": 90},
    issues_count=2
)

# Record metrics
checkpoint.record_condition_score("roof", 90.0, {"user_id": "user456"})
checkpoint.record_damage_score("water", 10.0, {"user_id": "user456"})
checkpoint.record_cost_estimate("repairs_immediate", 500.0, {"user_id": "user456"})
checkpoint.record_issue_count("critical", 1, {"user_id": "user456"})
```

#### Agent Feature

```python
from common.observability import agent

# Log query completion
agent.log_query_completed(
    user_id="user456",
    session_id="session789",
    duration_ms=3500,
    token_count=2500,
    cost_usd=0.025,
    subagents_invoked=["triage", "coverage", "diy"]
)

# Record sub-agent metrics
agent.record_subagent_invocation(
    subagent_name="triage",
    duration_ms=1200,
    success=True,
    attributes={"user_id": "user456"}
)
```

#### Document Feature

```python
from common.observability import document

# Log analysis completion
document.log_analysis_completed(
    user_id="user456",
    document_url="gs://bucket/doc.pdf",
    document_type="warranty",
    duration_ms=1800,
    pages_processed=3,
    entities_extracted=["product_name", "expiration_date"]
)

# Record document type
document.record_document_type("warranty", {"user_id": "user456"})
```

#### RAG Feature

```python
from common.observability import rag

# Log import completion
rag.log_import_completed(
    user_id="user456",
    files_imported=5,
    duration_ms=8500,
    total_tokens=45000,
    corpus_id="corpus123"
)

# Record corpus size
rag.record_corpus_size("user456", documents=25, tokens=125000)
```

### Platform-Wide Usage

```python
from common.observability import platform

# Record feature usage
platform.record_feature_usage("checkpoint", "user456")

# Record cost
platform.record_cost("agent", 0.025, user_id="user456")
```

### Low-Level Usage

For custom scenarios, use the base helpers directly:

```python
from common.observability.logging_helper import log_event
from common.observability.metrics_helper import record_histogram, record_counter
from common.observability.constants import EVENT_CHECKPOINT_ANALYSIS_COMPLETED

# Custom log event
log_event(
    EVENT_CHECKPOINT_ANALYSIS_COMPLETED,
    {
        "checkpoint_id": "checkpoint123",
        "user_id": "user456",
        "duration_ms": 2450
    },
    severity="INFO"
)

# Custom metrics
record_histogram(
    "checkpoint.analysis.duration_ms",
    value=2450,
    attributes={"user_id": "user456", "property_id": "prop789"},
    unit="ms"
)

record_counter(
    "checkpoint.issues.critical",
    value=1,
    attributes={"user_id": "user456"}
)
```

### Tracing

```python
from common.observability.base import get_tracer

tracer = get_tracer(__name__)

with tracer.start_as_current_span("analyze_checkpoint") as span:
    span.set_attribute("checkpoint_id", "checkpoint123")
    span.set_attribute("user_id", "user456")
    # ... your code ...
```

## Querying and Analysis

### Filtering by Feature in BigQuery

```sql
-- All checkpoint events
SELECT * FROM `project.logs.cloud_function_*`
WHERE JSON_EXTRACT_SCALAR(body, '$.event_type') LIKE 'checkpoint.%'

-- All agent events
SELECT * FROM `project.logs.cloud_function_*`
WHERE JSON_EXTRACT_SCALAR(body, '$.event_type') LIKE 'agent.%'

-- Feature-specific metrics
SELECT * FROM `project.monitoring.metrics_*`
WHERE metric_name LIKE 'checkpoint.%'
```

### Feature-Specific Reports

Use the feature prefix to filter:

```sql
-- Checkpoint analysis performance
SELECT
    AVG(CAST(JSON_EXTRACT_SCALAR(body, '$.duration_ms') AS FLOAT64)) as avg_duration,
    COUNT(*) as total_analyses
FROM `project.logs.cloud_function_*`
WHERE JSON_EXTRACT_SCALAR(body, '$.event_type') = 'checkpoint.analysis.completed'
AND TIMESTAMP(timestamp) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)

-- Agent cost by feature
SELECT
    feature,
    SUM(cost_usd) as total_cost
FROM `project.monitoring.metrics_*`
WHERE metric_name = 'platform.cost.{feature}.usd'
GROUP BY feature
```

## Integration Points

### API Services

```python
# In gcp/proxy/api/services/checkpoint_service.py
from common.observability import checkpoint

def analyze_checkpoint(...):
    start_time = time.time()
    try:
        result = ...
        checkpoint.log_analysis_completed(...)
        return result
    except Exception as e:
        checkpoint.log_analysis_failed(...)
        raise
```

### Worker Functions

```python
# In gcp/proxy/workers/function/checkpoint_analysis/main.py
from common.observability import initialize_observability, checkpoint

# Initialize at module level
initialize_observability()

def pubsub_checkpoint_analysis(request, context):
    # ... use checkpoint helpers ...
```

## Extending Observability Helpers (Hybrid Approach)

The common module provides standard observability helpers, but features can extend them with custom functionality when needed.

### Standard Approach: Use Common Helpers

For most cases, use the helpers provided in `common.observability`:

```python
from common.observability import checkpoint

# Use standard helpers
checkpoint.log_analysis_completed(...)
checkpoint.record_condition_score(...)
```

### Extended Approach: Feature-Specific Custom Helpers

If a feature needs custom observability logic beyond the standard helpers, create a feature-specific module:

```python
# In gcp/proxy/workers/function/checkpoint_analysis/observability.py
from common.observability import checkpoint as base_checkpoint
from common.observability.constants import EVENT_CHECKPOINT_ANALYSIS_COMPLETED
from common.observability.logging_helper import log_event
from common.observability.metrics_helper import record_histogram

class CheckpointObservability(base_checkpoint.__class__):
    """Extended checkpoint observability with custom methods."""

    @staticmethod
    def log_custom_event(checkpoint_id: str, custom_data: dict):
        """Custom logging specific to checkpoint analysis."""
        log_event(
            EVENT_CHECKPOINT_ANALYSIS_COMPLETED,
            {
                "checkpoint_id": checkpoint_id,
                "custom_field": custom_data,
                # ... additional custom fields
            }
        )

    @staticmethod
    def record_custom_metric(value: float, attributes: dict):
        """Custom metric recording for checkpoint feature."""
        record_histogram(
            "checkpoint.custom.metric",
            value,
            attributes,
            description="Custom checkpoint metric"
        )

# Create instance for use in feature code
checkpoint = CheckpointObservability()
```

Then in your feature code:

```python
# In gcp/proxy/workers/function/checkpoint_analysis/main.py
from common.observability import initialize_observability
from .observability import checkpoint  # Use extended helper

initialize_observability()

def pubsub_checkpoint_analysis(request, context):
    # Use standard methods (inherited)
    checkpoint.log_analysis_completed(...)

    # Use custom methods
    checkpoint.log_custom_event(...)
    checkpoint.record_custom_metric(...)
```

### When to Extend vs. Use Standard Helpers

**Use standard helpers when:**

- Standard logging/metrics patterns are sufficient
- You want consistency across features
- Simplicity is preferred

**Create feature-specific extensions when:**

- You need custom metrics specific to the feature
- Complex domain-specific observability logic is required
- Feature needs to log additional context not covered by standard helpers
- You want to encapsulate feature-specific observability patterns

## Best Practices

1. **Always include user_id** in attributes for user-level analysis
2. **Use feature helpers** when available for consistency
3. **Record durations** for performance monitoring
4. **Log both success and failure** events
5. **Use structured attributes** for filtering/grouping
6. **Initialize observability** once at application startup

## Constants Reference

See `constants.py` for the complete list of:

- Event types (e.g., `EVENT_CHECKPOINT_ANALYSIS_COMPLETED`)
- Metric names (e.g., `METRIC_CHECKPOINT_ANALYSIS_DURATION`)
- Feature identifiers (e.g., `FEATURE_CHECKPOINT`)

## Requirements

Add to `requirements.txt`:

```txt
opentelemetry-api>=1.20.0
opentelemetry-sdk>=1.20.0
opentelemetry-exporter-gcp-trace
opentelemetry-exporter-gcp-monitoring
```

## Deployment Notes

- Cloud Functions automatically collect basic metrics
- Cloud Trace works automatically for Cloud Functions
- Structured logs go to Cloud Logging automatically
- No additional configuration needed for basic setup
- Custom metrics require explicit initialization (done by this module)
