"""Plan checkpoint retrieval mode and carry prior scope into follow-up turns."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, Optional

from property_agent.checkpoint.constants import (
    CHECKPOINT_LOCATION_META_STATE_KEY,
    CHECKPOINT_TEMPORAL_META_STATE_KEY,
)
from property_agent.checkpoint.retrieval.inventory_query import (
    query_requests_checkpoint_inventory,
)
from property_agent.checkpoint.retrieval.location_query import (
    CheckpointLocationIntent,
    parse_checkpoint_location_intent,
    query_requests_location_filter,
)
from property_agent.checkpoint.retrieval.temporal_query import (
    CheckpointDateRange,
    parse_checkpoint_date_range,
    parse_reference_date_utc,
    query_requests_temporal_filter,
)


@dataclass(frozen=True)
class CheckpointRetrievalPlan:
    """Resolved retrieval path for a single checkpoint query."""

    mode: str
    date_range: Optional[CheckpointDateRange]
    explicit_location: Optional[str]
    location_intent: Optional[CheckpointLocationIntent]
    inventory_query: bool
    carried_over: bool


def query_defines_retrieval_scope(user_query: str) -> bool:
    """True when the user turn names a new temporal, location, or inventory scope."""
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    return (
        query_requests_temporal_filter(normalized)
        or query_requests_location_filter(normalized)
        or query_requests_checkpoint_inventory(normalized)
    )


def date_range_from_temporal_meta(meta: Mapping[str, Any]) -> Optional[CheckpointDateRange]:
    """Rebuild a date range from persisted ``checkpoint_temporal_meta`` state."""
    label = str(meta.get("label") or "").strip()
    start_raw = str(meta.get("start_utc") or "").strip()
    end_raw = str(meta.get("end_utc") or "").strip()
    if not label or not start_raw or not end_raw:
        return None
    try:
        start_utc = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
        end_utc = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
        if start_utc.tzinfo is None:
            start_utc = start_utc.replace(tzinfo=timezone.utc)
        if end_utc.tzinfo is None:
            end_utc = end_utc.replace(tzinfo=timezone.utc)
        return CheckpointDateRange(
            start_utc=start_utc,
            end_utc=end_utc,
            label=label,
        )
    except ValueError:
        return None


def apply_prior_scope_from_state(
    state: Mapping[str, Any] | None,
    *,
    user_query: str,
    date_range: Optional[CheckpointDateRange],
    explicit_location: Optional[str],
    location_intent: Optional[CheckpointLocationIntent],
) -> tuple[
    Optional[CheckpointDateRange],
    Optional[str],
    Optional[CheckpointLocationIntent],
    bool,
]:
    """
    Reuse the last temporal/location scope when a follow-up turn does not redefine it.

    Example: prior turn asked about May kitchen (0 results); user says "yes, run cost"
    should stay scoped to May + kitchen instead of widening to vector search.
    """
    if query_defines_retrieval_scope(user_query):
        return date_range, explicit_location, location_intent, False

    carried_over = False
    if state is None:
        return date_range, explicit_location, location_intent, carried_over

    if date_range is None:
        prior_temporal = state.get(CHECKPOINT_TEMPORAL_META_STATE_KEY)
        if isinstance(prior_temporal, dict):
            restored = date_range_from_temporal_meta(prior_temporal)
            if restored is not None:
                date_range = restored
                carried_over = True

    if not (explicit_location or "").strip() and location_intent is None:
        prior_location = state.get(CHECKPOINT_LOCATION_META_STATE_KEY)
        if isinstance(prior_location, dict):
            matched = str(prior_location.get("matched_field") or "").strip()
            if matched:
                explicit_location = matched
                carried_over = True
            else:
                requested = str(prior_location.get("requested") or "").strip()
                if requested:
                    location_intent = CheckpointLocationIntent(label=requested)
                    carried_over = True

    return date_range, explicit_location, location_intent, carried_over


def query_scope_overrides_checkpoint_ids(
    user_query: str,
    checkpoint_ids: Optional[list[str]],
) -> bool:
    """True when the question names area/time/inventory and should not lock to UI ids."""
    return bool(checkpoint_ids) and query_defines_retrieval_scope(user_query or "")


def plan_checkpoint_retrieval(
    user_query: str,
    *,
    location: Optional[str],
    checkpoint_ids: Optional[list[str]],
    reference_date: str | datetime | None,
    state: Mapping[str, Any] | None = None,
) -> CheckpointRetrievalPlan:
    """Choose retrieval mode and merge prior scope for vague follow-up turns."""
    has_ids = bool(checkpoint_ids and len(checkpoint_ids) > 0)
    if query_scope_overrides_checkpoint_ids(user_query or "", checkpoint_ids):
        has_ids = False
    inventory_query = bool(
        not has_ids and query_requests_checkpoint_inventory(user_query or "")
    )
    date_range = (
        parse_checkpoint_date_range(
            user_query or "",
            reference_date=reference_date or parse_reference_date_utc(None),
        )
        if not has_ids
        and not inventory_query
        and query_requests_temporal_filter(user_query or "")
        else None
    )
    explicit_location = (location or "").strip() or None
    location_intent = (
        parse_checkpoint_location_intent(user_query or "")
        if not has_ids
        and not inventory_query
        and query_requests_location_filter(user_query or "")
        else None
    )

    carried_over = False
    if not inventory_query:
        date_range, explicit_location, location_intent, carried_over = (
            apply_prior_scope_from_state(
                state,
                user_query=user_query or "",
                date_range=date_range,
                explicit_location=explicit_location,
                location_intent=location_intent,
            )
        )

    if has_ids:
        mode = "by_id"
    elif inventory_query:
        mode = "inventory_recent"
    elif date_range is not None:
        mode = "date_range"
    elif explicit_location or location_intent is not None:
        mode = "location_filter"
    else:
        mode = "vector"

    return CheckpointRetrievalPlan(
        mode=mode,
        date_range=date_range,
        explicit_location=explicit_location,
        location_intent=location_intent,
        inventory_query=inventory_query,
        carried_over=carried_over,
    )


__all__ = [
    "CheckpointRetrievalPlan",
    "apply_prior_scope_from_state",
    "date_range_from_temporal_meta",
    "plan_checkpoint_retrieval",
    "query_defines_retrieval_scope",
    "query_scope_overrides_checkpoint_ids",
]
