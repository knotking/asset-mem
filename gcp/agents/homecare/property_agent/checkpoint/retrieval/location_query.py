"""Parse area/room/location phrases in checkpoint queries."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Optional

# Intent label → tokens that may appear in Firestore ``location`` / ``detectedAsset``.
# Avoid shared loose tokens (e.g. "exterior") that collide across intents.
_INTENT_LOCATION_TOKENS: dict[str, tuple[str, ...]] = {
    "kitchen": ("kitchen",),
    "garage": ("garage",),
    "vehicle": ("vehicle", "car", "automobile"),
    "bathroom": ("bathroom", "bath"),
    "bedroom": ("bedroom",),
    "living room": ("living room", "living-room", "family room"),
    "roof": ("roof", "roofing"),
    "attic": ("attic",),
    "basement": ("basement",),
    "hvac": ("hvac", "furnace", "air conditioning", "a/c", "ac unit"),
    "plumbing": ("plumbing", "pipe", "sink", "faucet"),
    "yard": ("yard", "lawn", "garden"),
    "pool": ("pool",),
}

_AREA_INTENT_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("kitchen", re.compile(r"\bkitchen\b", re.IGNORECASE)),
    ("garage", re.compile(r"\bgarage\b", re.IGNORECASE)),
    ("vehicle", re.compile(r"\b(?:vehicle|car|automobile)\b", re.IGNORECASE)),
    ("bathroom", re.compile(r"\bbath(?:room)?\b", re.IGNORECASE)),
    ("bedroom", re.compile(r"\bbed(?:room)?\b", re.IGNORECASE)),
    ("living room", re.compile(r"\b(?:living|family)\s+room\b", re.IGNORECASE)),
    ("roof", re.compile(r"\broof(?:ing)?\b", re.IGNORECASE)),
    ("attic", re.compile(r"\battic\b", re.IGNORECASE)),
    ("basement", re.compile(r"\bbasement\b", re.IGNORECASE)),
    ("hvac", re.compile(r"\b(?:hvac|furnace|air\s+condition(?:ing|er)|a/?c\s+unit)\b", re.IGNORECASE)),
    ("plumbing", re.compile(r"\b(?:plumbing|plumber|pipe|sink|faucet)\b", re.IGNORECASE)),
    ("pool", re.compile(r"\bpool\b", re.IGNORECASE)),
    ("yard", re.compile(r"\b(?:yard|lawn|garden)\b", re.IGNORECASE)),
)

_RELATED_TO_AREA_RE = re.compile(
    r"\b(?:related\s+to|in|for|at|about|around)\s+(?:the\s+)?([a-z][a-z\s/-]{1,30})\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class CheckpointLocationIntent:
    """Normalized area the user asked about."""

    label: str


def _normalize_location_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def query_requests_location_filter(user_query: str) -> bool:
    """True when the user names a property area/room/asset."""
    return parse_checkpoint_location_intent(user_query) is not None


def parse_checkpoint_location_intent(user_query: str) -> Optional[CheckpointLocationIntent]:
    normalized = (user_query or "").strip()
    if not normalized:
        return None
    for label, pattern in _AREA_INTENT_PATTERNS:
        if pattern.search(normalized):
            return CheckpointLocationIntent(label=label)
    related = _RELATED_TO_AREA_RE.search(normalized)
    if related:
        fragment = _normalize_location_text(related.group(1))
        for label in _INTENT_LOCATION_TOKENS:
            if fragment == label or fragment.startswith(label):
                return CheckpointLocationIntent(label=label)
    return None


def _token_matches_location_field(token: str, norm: str) -> bool:
    """Match a token against a normalized location using word boundaries when possible."""
    token = _normalize_location_text(token)
    if not token or not norm:
        return False
    if norm == token:
        return True
    if " " in token:
        return token in norm
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(token)}(?![a-z0-9])", norm))


def resolve_location_field(
    intent: CheckpointLocationIntent | str,
    known_locations: Iterable[str],
) -> Optional[str]:
    """
    Map a parsed intent to an exact Firestore ``location`` value on this property.

    Returns the canonical stored location string when one matches; otherwise ``None``.
    """
    label = intent.label if isinstance(intent, CheckpointLocationIntent) else str(intent)
    tokens = _INTENT_LOCATION_TOKENS.get(label, (label,))
    token_set = {_normalize_location_text(t) for t in tokens if t}
    for raw in known_locations:
        loc = (raw or "").strip()
        if not loc:
            continue
        norm = _normalize_location_text(loc)
        if any(_token_matches_location_field(token, norm) for token in token_set):
            return loc
    return None


def format_location_scope_disclosure(
    *,
    requested: str,
    matched_field: Optional[str],
) -> str:
    if matched_field:
        return (
            f"Location scope: checkpoints for **{matched_field}** "
            f"(requested: {requested})."
        )
    return f"Location scope: no checkpoints found for **{requested}** on this property."


__all__ = [
    "CheckpointLocationIntent",
    "format_location_scope_disclosure",
    "parse_checkpoint_location_intent",
    "query_requests_location_filter",
    "resolve_location_field",
]
