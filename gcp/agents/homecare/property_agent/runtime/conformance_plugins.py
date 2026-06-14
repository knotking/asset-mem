"""Register ADK conformance plugins for local record/replay."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from google.adk.plugins.base_plugin import BasePlugin

_VALID_MODES = frozenset({"record", "replay", "both"})


def conformance_plugin_mode() -> str | None:
    """Return ``record``, ``replay``, ``both``, or None when plugins are off."""
    raw = (os.getenv("HOMEAPP_ADK_CONFORMANCE_PLUGINS") or "").strip().lower()
    if not raw or raw in {"0", "false", "off", "no"}:
        return None
    if raw not in _VALID_MODES:
        raise ValueError(
            "HOMEAPP_ADK_CONFORMANCE_PLUGINS must be one of "
            f"{sorted(_VALID_MODES)}; got {raw!r}"
        )
    return raw


def load_conformance_plugins() -> list[BasePlugin]:
    """Instantiate Recordings/Replay plugins when ``HOMEAPP_ADK_CONFORMANCE_PLUGINS`` is set."""
    mode = conformance_plugin_mode()
    if mode is None:
        return []

    plugins: list[BasePlugin] = []
    if mode in {"record", "both"}:
        from google.adk.cli.plugins.recordings_plugin import RecordingsPlugin

        plugins.append(RecordingsPlugin())
    if mode in {"replay", "both"}:
        from google.adk.cli.plugins.replay_plugin import ReplayPlugin

        plugins.append(ReplayPlugin())
    return plugins
