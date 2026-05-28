"""Configurable log redaction policy for tool args."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LogRedactionPolicy:
    sensitive_keys: frozenset[str] = frozenset()
    address_keys: frozenset[str] = frozenset()
    list_summary_keys: frozenset[str] = frozenset()
    uri_list_keys: frozenset[str] = frozenset()
    redact_search_location: bool = False


DEFAULT_LOG_REDACTION_POLICY = LogRedactionPolicy(
    sensitive_keys=frozenset(
        {"user_query", "search_query", "request", "query", "text"}
    ),
)
