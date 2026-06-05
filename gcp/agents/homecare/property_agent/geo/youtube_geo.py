"""YouTube Data API geo parameters."""

from __future__ import annotations

import logging
import os
from typing import Dict, Optional

from property_agent.shared.inputs import SearchLocation

logger = logging.getLogger(__name__)


# DIY YouTube geo: loose circle (not tied to search_location.radius_miles).
# YouTube search.list caps locationRadius at 1000 km; 2000 km is clamped to that max.
_YOUTUBE_API_MAX_LOCATION_RADIUS_KM = 1000
_DEFAULT_YOUTUBE_LOCATION_RADIUS_KM = 2000


def youtube_location_radius_km() -> int:
    """Radius for YouTube ``locationRadius`` (env ``DIY_YOUTUBE_LOCATION_RADIUS_KM``, default 2000)."""
    raw = os.getenv(
        "DIY_YOUTUBE_LOCATION_RADIUS_KM",
        str(_DEFAULT_YOUTUBE_LOCATION_RADIUS_KM),
    ).strip()
    try:
        preferred = int(raw)
    except ValueError:
        preferred = _DEFAULT_YOUTUBE_LOCATION_RADIUS_KM
    preferred = max(1, preferred)
    if preferred > _YOUTUBE_API_MAX_LOCATION_RADIUS_KM:
        logger.debug(
            "youtube locationRadius: requested %dkm, using YouTube API max %dkm",
            preferred,
            _YOUTUBE_API_MAX_LOCATION_RADIUS_KM,
        )
        return _YOUTUBE_API_MAX_LOCATION_RADIUS_KM
    return preferred


def youtube_geo_params(
    search_location: Optional[SearchLocation],
) -> Dict[str, str]:
    """
    YouTube Data API ``location`` + ``locationRadius`` (loose geo filter).

    Uses a large fixed radius (default 2000 km, clamped to API max 1000 km), not
    ``search_location.radius_miles``, so more geotagged tutorials qualify.
    """
    if search_location is None:
        return {}
    lat = search_location.coordinates.lat
    lng = search_location.coordinates.lng
    radius_km = youtube_location_radius_km()
    return {
        "location": f"{lat},{lng}",
        "locationRadius": f"{radius_km}km",
    }

