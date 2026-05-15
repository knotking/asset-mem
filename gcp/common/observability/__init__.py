"""
Shared Observability Module

Heavy dependencies (OpenTelemetry) are loaded lazily so workers that only need
``logging_context`` do not require ``opentelemetry`` in their requirements.txt.
"""

from __future__ import annotations

import importlib
from typing import Any, Final

from . import constants as _constants
from .constants import *  # noqa: F403

# Submodules allowed via ``from common.observability import <name>`` (tests, tooling).
_SUBMODULE_NAMES: Final[frozenset[str]] = frozenset(
    {
        "base",
        "constants",
        "feature_helpers",
        "logging_context",
        "logging_helper",
        "metrics_helper",
    }
)

# Map public names -> (submodule under this package, attribute name).
_LAZY_EXPORTS: Final[dict[str, tuple[str, str]]] = {
    # base
    "initialize_observability": ("base", "initialize_observability"),
    "get_tracer": ("base", "get_tracer"),
    "get_logger": ("base", "get_logger"),
    "get_metrics": ("base", "get_metrics"),
    # logging_helper
    "log_event": ("logging_helper", "log_event"),
    "log_analysis_completed": ("logging_helper", "log_analysis_completed"),
    "log_analysis_failed": ("logging_helper", "log_analysis_failed"),
    # metrics_helper
    "record_metric": ("metrics_helper", "record_metric"),
    "record_counter": ("metrics_helper", "record_counter"),
    "record_histogram": ("metrics_helper", "record_histogram"),
    "record_gauge": ("metrics_helper", "record_gauge"),
    # feature_helpers (classes + singletons)
    "checkpoint": ("feature_helpers", "checkpoint"),
    "agent": ("feature_helpers", "agent"),
    "document": ("feature_helpers", "document"),
    "rag": ("feature_helpers", "rag"),
    "platform": ("feature_helpers", "platform"),
    "CheckpointObservability": ("feature_helpers", "CheckpointObservability"),
    "AgentObservability": ("feature_helpers", "AgentObservability"),
    "DocumentObservability": ("feature_helpers", "DocumentObservability"),
    "RAGObservability": ("feature_helpers", "RAGObservability"),
    "PlatformObservability": ("feature_helpers", "PlatformObservability"),
}


def __getattr__(name: str) -> Any:
    if name in _SUBMODULE_NAMES:
        return importlib.import_module(f"{__name__}.{name}")
    if name in _LAZY_EXPORTS:
        submod, attr = _LAZY_EXPORTS[name]
        module = importlib.import_module(f"{__name__}.{submod}")
        return getattr(module, attr)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    constant_names = [n for n in dir(_constants) if not n.startswith("_")]
    extra = set(_LAZY_EXPORTS) | _SUBMODULE_NAMES
    return sorted(set(constant_names) | extra | set(globals()))


_PUBLIC_CONSTANT_NAMES = [n for n in dir(_constants) if not n.startswith("_")]
__all__ = sorted(
    set(_PUBLIC_CONSTANT_NAMES) | set(_LAZY_EXPORTS) | set(_SUBMODULE_NAMES)
)
