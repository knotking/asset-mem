"""Deprecated compatibility package — import agent_platform.core / agent_platform.adk instead."""

from __future__ import annotations

import warnings

warnings.warn(
    "agent_framework is deprecated; use agent_platform.core and agent_platform.adk",
    DeprecationWarning,
    stacklevel=2,
)
