# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Shared utilities for route handlers."""

import logging
from fastapi import Request
from schemas import AgentRequest
from optional_agents import normalize_analysis_optional_agents

logger: logging.Logger = logging.getLogger(__name__)


async def extract_firebase_request_data(request: Request) -> AgentRequest:
    """Extract and validate Firebase request data from request body."""
    data = await request.json()
    user_id = data.get("user_id", "")
    if not user_id:
        logger.error("User ID is required")
        raise ValueError("User ID is required")

    session_id = data.get("session_id", "")
    user_query = data.get("user_query", "Analyse")
    context_doc_uris = data.get("context_doc_uris", [])
    diagnosis_uris = data.get("diagnosis_uris", [])
    property_address = data.get("property_address", "")
    analysis_optional_agents = normalize_analysis_optional_agents(data.get("analysis_optional_agents"))
    
    # Extract location data
    location_type = data.get("location_type")
    location_coordinates = data.get("location_coordinates")
    location_radius = data.get("location_radius")
    
    return AgentRequest(
        user_id=user_id,
        user_query=user_query,
        context_doc_uris=context_doc_uris,
        diagnosis_uris=diagnosis_uris,
        session_id=session_id,
        property_address=property_address,
        analysis_optional_agents=analysis_optional_agents,
        location_type=location_type,
        location_coordinates=location_coordinates,
        location_radius=location_radius,
    )
