"""Tests for OTel context detach log suppression."""

from __future__ import annotations

import logging

from agent_framework.observability.logging_context import suppress_otel_context_detach_noise


def test_suppress_otel_context_detach_noise_sets_critical(monkeypatch) -> None:
    monkeypatch.delenv("HOMEAPP_OTEL_CONTEXT_LOGS", raising=False)
    otel_logger = logging.getLogger("opentelemetry.context")
    otel_logger.setLevel(logging.NOTSET)

    suppress_otel_context_detach_noise()

    assert otel_logger.level == logging.CRITICAL


def test_suppress_otel_context_detach_noise_can_be_disabled(monkeypatch) -> None:
    monkeypatch.setenv("HOMEAPP_OTEL_CONTEXT_LOGS", "1")
    otel_logger = logging.getLogger("opentelemetry.context")
    otel_logger.setLevel(logging.NOTSET)

    suppress_otel_context_detach_noise()

    assert otel_logger.level == logging.NOTSET
