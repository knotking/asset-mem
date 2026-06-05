"""ADK root_agent entrypoint for the property plugin."""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_root_agent: Any = None
_adk_web_runner_patched = False


def _patch_adk_web_runner_for_checkpoint_progress() -> None:
    """Use ``HomecareRunner`` in local ``adk web`` so branch progress streams to chat."""
    global _adk_web_runner_patched
    if _adk_web_runner_patched:
        return
    if (os.getenv("HOMEAPP_CHECKPOINT_PROGRESS_RUNNER") or "1").strip().lower() in (
        "0",
        "false",
        "no",
        "off",
    ):
        return
    try:
        from google.adk.cli import adk_web_server
    except ImportError:
        return

    def _create_runner(self, agentic_app):  # type: ignore[no-untyped-def]
        from property_agent.runtime.homecare_runner import create_homecare_runner

        return create_homecare_runner(
            app=agentic_app,
            artifact_service=self.artifact_service,
            session_service=self.session_service,
            memory_service=self.memory_service,
            credential_service=self.credential_service,
            auto_create_session=self.auto_create_session,
        )

    adk_web_server.AdkWebServer._create_runner = _create_runner  # type: ignore[method-assign]
    _adk_web_runner_patched = True
    logger.info("ADK web: using HomecareRunner for checkpoint progress streaming")


def get_root_agent():
    """Lazy singleton for the property root ADK agent."""
    global _root_agent
    if _root_agent is None:
        _patch_adk_web_runner_for_checkpoint_progress()
        from property_agent.runtime.root_agent_plugin import build_property_root_agent

        _root_agent = build_property_root_agent()
    return _root_agent


def __getattr__(name: str) -> Any:
    if name == "root_agent":
        return get_root_agent()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
