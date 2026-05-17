"""Opt-in gates for live ADK user-simulation evals."""

from __future__ import annotations

import os

import pytest
from dotenv import load_dotenv

load_dotenv()

requires_simulation_eval = pytest.mark.skipif(
    os.environ.get("RUN_ADK_SIMULATION_TESTS", "").strip() != "1",
    reason=(
        "Set RUN_ADK_SIMULATION_TESTS=1 to run live user-simulation evals "
        "(Vertex + simulated user LLM)."
    ),
)

requires_gcp_project = pytest.mark.skipif(
    not (
        os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()
        or os.environ.get("GCP_PROJECT_ID", "").strip()
    ),
    reason="GOOGLE_CLOUD_PROJECT (or GCP_PROJECT_ID) required for simulation evals.",
)
