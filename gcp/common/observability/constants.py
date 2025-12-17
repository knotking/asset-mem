"""
Observability Constants

Defines all event types, metric names, and feature identifiers used across the platform.
All names follow a consistent pattern: `feature.operation.metric` or `feature.operation.event`.

This structure enables:
1. Easy filtering by feature in queries/reports
2. Consistent naming across services
3. Platform-wide or feature-specific analysis
"""

# Feature Identifiers
FEATURE_CHECKPOINT = "checkpoint"
FEATURE_AGENT = "agent"
FEATURE_DOCUMENT = "document"
FEATURE_RAG = "rag"
FEATURE_SERVICE_BROKER = "service_broker"
FEATURE_TELEGRAM = "telegram"
FEATURE_PLATFORM = "platform"  # Cross-feature metrics

# ============================================================================
# CHECKPOINT FEATURE
# ============================================================================

# Checkpoint Event Types
EVENT_CHECKPOINT_ANALYSIS_COMPLETED = "checkpoint.analysis.completed"
EVENT_CHECKPOINT_ANALYSIS_FAILED = "checkpoint.analysis.failed"
EVENT_CHECKPOINT_COMPARISON_COMPLETED = "checkpoint.comparison.completed"
EVENT_CHECKPOINT_COMPARISON_SKIPPED = "checkpoint.comparison.skipped"

# Checkpoint Metric Names
METRIC_CHECKPOINT_ANALYSIS_DURATION = "checkpoint.analysis.duration_ms"
METRIC_CHECKPOINT_COMPARISON_DURATION = "checkpoint.comparison.duration_ms"
METRIC_CHECKPOINT_CONDITION_SCORE = "checkpoint.condition.{component}"  # e.g., checkpoint.condition.roof
METRIC_CHECKPOINT_DAMAGE_SCORE = "checkpoint.damage.{type}"  # e.g., checkpoint.damage.water
METRIC_CHECKPOINT_COST_ESTIMATE = "checkpoint.cost.{type}"  # e.g., checkpoint.cost.repairs_immediate
METRIC_CHECKPOINT_ISSUE_COUNT = "checkpoint.issues.{severity}"  # e.g., checkpoint.issues.critical
METRIC_CHECKPOINT_DETERIORATION_RATE = "checkpoint.deterioration.rate"

# ============================================================================
# AGENT FEATURE
# ============================================================================

# Agent Event Types
EVENT_AGENT_QUERY_COMPLETED = "agent.query.completed"
EVENT_AGENT_QUERY_FAILED = "agent.query.failed"
EVENT_AGENT_SESSION_CREATED = "agent.session.created"
EVENT_AGENT_SESSION_DELETED = "agent.session.deleted"
EVENT_AGENT_STREAM_STARTED = "agent.stream.started"
EVENT_AGENT_STREAM_COMPLETED = "agent.stream.completed"
EVENT_AGENT_STREAM_FAILED = "agent.stream.failed"

# Agent Metric Names
METRIC_AGENT_QUERY_DURATION = "agent.query.duration_ms"
METRIC_AGENT_TOKEN_COUNT = "agent.query.token_count"
METRIC_AGENT_COST_USD = "agent.query.cost_usd"
METRIC_AGENT_SESSION_ACTIVE = "agent.session.active"
METRIC_AGENT_SESSION_DURATION = "agent.session.duration_seconds"
METRIC_AGENT_SUBAGENT_INVOCATIONS = "agent.subagent.{name}.invocations"
METRIC_AGENT_SUBAGENT_DURATION = "agent.subagent.{name}.duration_ms"
METRIC_AGENT_SUBAGENT_SUCCESS_RATE = "agent.subagent.{name}.success_rate"
METRIC_AGENT_SUBAGENT_ERROR_COUNT = "agent.subagent.{name}.error_count"
METRIC_AGENT_STREAM_CHUNKS_SENT = "agent.stream.chunks_sent"
METRIC_AGENT_STREAM_CONNECTION_DURATION = "agent.stream.connection_duration_ms"
METRIC_AGENT_STREAM_EARLY_DISCONNECTS = "agent.stream.early_disconnects"

# Agent Sub-Agent Names
SUBAGENT_TRIAGE = "triage"
SUBAGENT_COVERAGE = "coverage"
SUBAGENT_DIY = "diy"
SUBAGENT_SERVICE = "service"
SUBAGENT_SHOPPING = "shopping"
SUBAGENT_COST = "cost"

# ============================================================================
# DOCUMENT FEATURE
# ============================================================================

# Document Event Types
EVENT_DOCUMENT_ANALYSIS_COMPLETED = "document.analysis.completed"
EVENT_DOCUMENT_ANALYSIS_FAILED = "document.analysis.failed"
EVENT_DOCUMENT_ENTITY_EXTRACTED = "document.entity.extracted"

# Document Metric Names
METRIC_DOCUMENT_ANALYSIS_DURATION = "document.analysis.duration_ms"
METRIC_DOCUMENT_ANALYSIS_SUCCESS_RATE = "document.analysis.success_rate"
METRIC_DOCUMENT_FILE_SIZE_BYTES = "document.analysis.file_size_bytes"
METRIC_DOCUMENT_PAGES_PROCESSED = "document.analysis.pages_processed"
METRIC_DOCUMENT_TYPE_DETECTED = "document.type.{type}.detected"
METRIC_DOCUMENT_ENTITIES_EXTRACTED = "document.entities.{type}.extracted"

# ============================================================================
# RAG FEATURE
# ============================================================================

# RAG Event Types
EVENT_RAG_IMPORT_COMPLETED = "rag.import.completed"
EVENT_RAG_IMPORT_FAILED = "rag.import.failed"
EVENT_RAG_QUERY_COMPLETED = "rag.query.completed"
EVENT_RAG_QUERY_FAILED = "rag.query.failed"

# RAG Metric Names
METRIC_RAG_IMPORT_DURATION = "rag.import.duration_ms"
METRIC_RAG_IMPORT_FILES_PROCESSED = "rag.import.files_processed"
METRIC_RAG_IMPORT_SUCCESS_RATE = "rag.import.success_rate"
METRIC_RAG_CORPUS_SIZE_DOCUMENTS = "rag.corpus.size_documents"
METRIC_RAG_CORPUS_SIZE_TOKENS = "rag.corpus.size_tokens"
METRIC_RAG_QUERY_DURATION = "rag.query.duration_ms"
METRIC_RAG_QUERY_DOCUMENTS_RETRIEVED = "rag.query.documents_retrieved"
METRIC_RAG_QUERY_RELEVANCE_SCORE = "rag.query.relevance_score"

# ============================================================================
# SERVICE BROKER FEATURE
# ============================================================================

# Service Broker Event Types
EVENT_SERVICE_BROKER_REQUEST_COMPLETED = "service_broker.request.completed"
EVENT_SERVICE_BROKER_REQUEST_FAILED = "service_broker.request.failed"

# Service Broker Metric Names
METRIC_SERVICE_BROKER_REQUESTS_COUNT = "service_broker.requests.count"
METRIC_SERVICE_BROKER_REQUESTS_DURATION = "service_broker.requests.duration_ms"
METRIC_SERVICE_BROKER_EXTERNAL_API_DURATION = "service_broker.external_api.duration_ms"
METRIC_SERVICE_BROKER_EXTERNAL_API_ERRORS = "service_broker.external_api.errors"

# ============================================================================
# TELEGRAM FEATURE
# ============================================================================

# Telegram Event Types
EVENT_TELEGRAM_COMMAND_EXECUTED = "telegram.command.executed"
EVENT_TELEGRAM_MESSAGE_PROCESSED = "telegram.message.processed"

# Telegram Metric Names
METRIC_TELEGRAM_COMMANDS_EXECUTED = "telegram.commands.{command}.executed"
METRIC_TELEGRAM_MESSAGES_PROCESSED = "telegram.messages.processed"
METRIC_TELEGRAM_COMMANDS_DURATION = "telegram.commands.duration_ms"
METRIC_TELEGRAM_USERS_ACTIVE = "telegram.users.active"

# ============================================================================
# PLATFORM-WIDE METRICS
# ============================================================================

# Platform Event Types
EVENT_PLATFORM_REQUEST_COMPLETED = "platform.request.completed"
EVENT_PLATFORM_REQUEST_FAILED = "platform.request.failed"

# Platform Metric Names
METRIC_PLATFORM_REQUESTS_TOTAL = "platform.requests.total"
METRIC_PLATFORM_REQUESTS_DURATION = "platform.requests.duration_ms"
METRIC_PLATFORM_ERROR_RATE = "platform.error_rate"
METRIC_PLATFORM_COST_TOTAL_USD = "platform.cost.total_usd"
METRIC_PLATFORM_COST_BY_FEATURE = "platform.cost.{feature}.usd"
METRIC_PLATFORM_ACTIVE_USERS = "platform.users.active"

# User Engagement Metrics
METRIC_USER_FEATURES_USED = "platform.user.features.used"
METRIC_USER_SESSIONS_TOTAL = "platform.user.sessions.total"
METRIC_USER_PROPERTIES_COUNT = "platform.user.properties.count"

# Feature Adoption Metrics
METRIC_FEATURE_ADOPTION_RATE = "platform.feature.{feature}.adoption_rate"
METRIC_FEATURE_USAGE_FREQUENCY = "platform.feature.{feature}.usage_frequency"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_feature_from_event(event_type: str) -> str:
    """Extract feature name from event type (e.g., 'checkpoint.analysis.completed' -> 'checkpoint')."""
    return event_type.split(".")[0] if "." in event_type else "unknown"


def get_feature_from_metric(metric_name: str) -> str:
    """Extract feature name from metric name (e.g., 'agent.query.duration_ms' -> 'agent')."""
    return metric_name.split(".")[0] if "." in metric_name else "unknown"


def format_metric_name(base_name: str, **kwargs) -> str:
    """
    Format metric name with placeholders.
    
    Example:
        format_metric_name(METRIC_AGENT_SUBAGENT_INVOCATIONS, name="triage")
        -> "agent.subagent.triage.invocations"
    """
    result = base_name
    for key, value in kwargs.items():
        result = result.replace(f"{{{key}}}", str(value))
    return result

