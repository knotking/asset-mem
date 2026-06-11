"""Shared pytest fixtures for homecare agent unit tests."""

from __future__ import annotations

import os

import pytest


@pytest.fixture(autouse=True)
def _executor_only_flag_off(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep tests independent of the developer's ``.env``.

    Several modules call ``load_dotenv()`` at import time, so a local
    ``HOMEAPP_EXECUTOR_ONLY_ROUTING=1`` (e.g. set for an ``adk web`` session)
    would leak into the suite and flip legacy resolve-path tests. Tests that
    exercise the flag set it explicitly via ``patch.dict``.
    """
    if "HOMEAPP_EXECUTOR_ONLY_ROUTING" in os.environ:
        monkeypatch.delenv("HOMEAPP_EXECUTOR_ONLY_ROUTING")
