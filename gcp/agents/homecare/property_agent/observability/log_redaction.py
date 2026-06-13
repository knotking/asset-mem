"""Homecare log redaction bindings."""

from __future__ import annotations

from typing import Any, Dict

from agent_platform.core.observability.log_redaction import (
    redact_tool_args_for_log as _platform_redact_tool_args_for_log,
)
from agent_platform.core.observability.redaction_policy import LogRedactionPolicy

HOMECARE_LOG_REDACTION_POLICY = LogRedactionPolicy(
    sensitive_keys=frozenset(
        {
            "user_query",
            "search_query",
            "request",
            "checkpoint_results",
            "diagnosis",
            "diagnosis_uris",
            "query",
            "text",
        }
    ),
    address_keys=frozenset({"property_address", "location", "market_location"}),
    list_summary_keys=frozenset({"checkpoint_ids"}),
    uri_list_keys=frozenset({"context_doc_uris"}),
    redact_search_location=True,
)


def redact_tool_args_for_log(args: Any) -> Dict[str, Any]:
    return _platform_redact_tool_args_for_log(
        args, policy=HOMECARE_LOG_REDACTION_POLICY
    )
