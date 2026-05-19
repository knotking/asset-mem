"""Checkpoint optional-analysis input schema."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from ...agent_inputs import CheckpointOptionalAgent

class CheckpointAnalysisInput(BaseModel):
    """Input schema for checkpoint analysis agent."""
    checkpoint_results: str = Field(description="The checkpoint retrieval results containing checkpoint data and analysis")
    user_query: str = Field(description="The original user query for context")
    search_query: Optional[str] = Field(
        default=None,
        description=(
            "Short search phrase for YouTube / shopping (from checkpoint retrieval: location + issues). "
            "Optional; when omitted, a compact phrase is derived from checkpoint_results."
        ),
    )
    checkpoint_optional_agents: List[CheckpointOptionalAgent] = Field(
        description="List of optional sub-agents to invoke: coverage, diy, service, cost"
    )
    context_doc_uris: Optional[List[str]] = Field(default=None, description="Context document URIs for coverage checks")
    property_address: Optional[str] = Field(
        default=None, description="Property record address (identity/context only)"
    )
    property_id: Optional[str] = Field(default=None, description="Property ID for reference")
    search_location: Optional[Dict[str, Any]] = Field(
        default=None, description="Unified market/geo for service, cost, DIY"
    )
