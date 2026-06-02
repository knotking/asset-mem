"""Minimal US address parsing for SerpAPI city-level geo fallback."""

from __future__ import annotations

import re
from typing import Dict, Optional, Tuple

_US_STATE_FULL: Dict[str, str] = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "DC": "District of Columbia",
}

_COORD_PAIR_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$")


def looks_like_coordinate_pair(text: str) -> bool:
    return bool(_COORD_PAIR_RE.match((text or "").strip()))


def is_street_address(text: str) -> bool:
    first = ((text or "").split(",")[0] or "").strip()
    return bool(first and re.match(r"^\d", first))


def _parse_state_zip(segment: str) -> Tuple[Optional[str], Optional[str]]:
    seg = (segment or "").strip()
    state_match = re.match(r"^([A-Z]{2})\b", seg)
    if not state_match:
        return None, None
    state = state_match.group(1)
    zip_match = re.search(r"\b(\d{5})(?:-\d{4})?\b", seg)
    return state, zip_match.group(1) if zip_match else None


def city_state_from_us_address(address: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract city and state abbreviation from a US address string."""
    addr = (address or "").strip()
    if not addr or looks_like_coordinate_pair(addr):
        return None, None
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    if len(parts) >= 3 and is_street_address(addr):
        return parts[-2], _parse_state_zip(parts[-1])[0]
    if len(parts) == 2:
        return parts[0], _parse_state_zip(parts[1])[0]
    return None, None


def serpapi_locations_query(city: str, state_abbr: str) -> str:
    state_full = _US_STATE_FULL.get(state_abbr.upper(), state_abbr)
    return f"{city.strip()},{state_full}"


def state_full_name(state_abbr: str) -> str:
    return _US_STATE_FULL.get(state_abbr.upper(), state_abbr)
