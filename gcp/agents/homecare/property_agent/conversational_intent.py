"""Classify casual vs substantive user turns for property_agent routing."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Literal, Mapping, Optional, Sequence

ConversationalLabel = Literal["greeting", "acknowledgment", "substantive"]

_PHRASES_PATH = Path(__file__).resolve().parent / "conversational_phrases.json"

# Imperatives / questions that always need tools even when short.
_SUBSTANTIVE_RE = re.compile(
    r"\b("
    r"recommend|analyse|analyze|analysis|find|show|compare|explain|search|list|"
    r"help me|how much|how do|what about|what changed|when did|why is|why are|"
    r"can you find|can you recommend|can you show|can you explain|can you compare|"
    r"do i have|is this covered|coverage for|providers? for|cost of|estimate|"
    r"diy steps|checkpoints? with|damage|repair|inspect"
    r")\b",
    re.IGNORECASE,
)

_WH_QUESTION_RE = re.compile(r"^\s*(how|what|when|where|why|who|which|can|could|should|is|are|do|does)\b", re.I)

CHECKPOINT_LAST_RESPONSE_KIND_KEY = "checkpoint_last_response_kind"
CONVERSATIONAL_TURN_STATE_KEY = "conversational_turn"

_ANALYSIS_JSON_MARKERS = (
    '"serviceResults"',
    '"diyResults"',
    '"coverageResult"',
    '"costEstimationResults"',
    '"analysisStatus"',
    '"checkpointSummary"',
)


def _load_phrase_categories() -> dict[str, list[str]]:
    data = json.loads(_PHRASES_PATH.read_text(encoding="utf-8"))
    out: dict[str, list[str]] = {}
    for key, values in data.items():
        if isinstance(values, list):
            out[key] = [str(v).strip().lower() for v in values if str(v).strip()]
    return out


PHRASE_CATEGORIES: dict[str, list[str]] = _load_phrase_categories()

GREETING_PHRASES: tuple[str, ...] = tuple(
    PHRASE_CATEGORIES.get("greeting", [])
    + PHRASE_CATEGORIES.get("social", [])
    + PHRASE_CATEGORIES.get("off_topic", [])
)

ACKNOWLEDGMENT_PHRASES: tuple[str, ...] = tuple(
    PHRASE_CATEGORIES.get("thanks", [])
    + PHRASE_CATEGORIES.get("positive_reaction", [])
    + PHRASE_CATEGORIES.get("understanding", [])
    + PHRASE_CATEGORIES.get("affirmation", [])
    + PHRASE_CATEGORIES.get("closure", [])
    + PHRASE_CATEGORIES.get("app_reaction", [])
    + PHRASE_CATEGORIES.get("ultra_short", [])
)


def normalize_user_query(user_query: str) -> str:
    text = (user_query or "").strip().lower()
    text = re.sub(r"[^\w\s'+]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _exact_or_prefix_match(normalized: str, phrase: str) -> bool:
    if not phrase:
        return False
    if normalized == phrase:
        return True
    return normalized.startswith(phrase + " ") or normalized.endswith(" " + phrase)


def _matches_any_phrase(normalized: str, phrases: Sequence[str]) -> bool:
    for phrase in phrases:
        if _exact_or_prefix_match(normalized, phrase):
            return True
    return False


def is_substantive_signal(normalized: str) -> bool:
    if not normalized:
        return False
    if _SUBSTANTIVE_RE.search(normalized):
        return True
    if "?" in (normalized or "") and _WH_QUESTION_RE.match(normalized):
        return True
    if _WH_QUESTION_RE.match(normalized) and len(normalized.split()) >= 3:
        return True
    return False


def is_greeting_like(normalized: str) -> bool:
    return _matches_any_phrase(normalized, GREETING_PHRASES)


def is_acknowledgment_like(normalized: str) -> bool:
    return _matches_any_phrase(normalized, ACKNOWLEDGMENT_PHRASES)


def resolve_user_query_from_state(state: Mapping[str, Any] | None) -> str:
    if not state:
        return ""
    for key in ("user_query", "app:user_query"):
        value = state.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def resolve_property_address_from_state(state: Mapping[str, Any] | None) -> Optional[str]:
    if not state:
        return None
    for key in ("property_address", "app:property_address"):
        value = state.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _event_text(event: Any) -> str:
    content = getattr(event, "content", None)
    if content is None:
        return ""
    parts = getattr(content, "parts", None) or []
    chunks: list[str] = []
    for part in parts:
        text = getattr(part, "text", None)
        if isinstance(text, str) and text.strip():
            chunks.append(text)
    return "\n".join(chunks)


def last_turn_delivered_checkpoint_analysis(
    session_events: Sequence[Any] | None,
    *,
    current_invocation_id: Optional[str] = None,
    state: Mapping[str, Any] | None = None,
) -> bool:
    if state and state.get(CHECKPOINT_LAST_RESPONSE_KIND_KEY) in (
        "analysis",
        "retrieval",
    ):
        return True

    if not session_events:
        return False

    model_authors = {
        "doculink_agent",
        "checkpoint_progress_agent",
        "checkpoint_analysis_synthesis_agent",
        "checkpoint_progress_synthesis_agent",
    }
    for event in reversed(list(session_events)):
        inv_id = getattr(event, "invocation_id", None)
        if current_invocation_id and inv_id == current_invocation_id:
            continue
        author = getattr(event, "author", None)
        if author not in model_authors and author != "user":
            continue
        if author == "user":
            continue
        text = _event_text(event)
        if not text:
            continue
        if "```json" in text and any(marker in text for marker in _ANALYSIS_JSON_MARKERS):
            return True
    return False


def classify_turn(
    user_query: str,
    *,
    session_events: Sequence[Any] | None = None,
    current_invocation_id: Optional[str] = None,
    state: Mapping[str, Any] | None = None,
) -> ConversationalLabel:
    normalized = normalize_user_query(user_query)
    if not normalized:
        return "greeting"

    if is_greeting_like(normalized):
        return "greeting"

    if is_acknowledgment_like(normalized):
        return "acknowledgment"

    if is_substantive_signal(normalized):
        return "substantive"

    # Short utterances without task verbs default to acknowledgment after prior analysis.
    if len(normalized.split()) <= 8 and last_turn_delivered_checkpoint_analysis(
        session_events,
        current_invocation_id=current_invocation_id,
        state=state,
    ):
        return "acknowledgment"

    if len(normalized.split()) <= 4:
        return "acknowledgment"

    return "substantive"


def is_conversational_turn(
    user_query: str,
    *,
    session_events: Sequence[Any] | None = None,
    current_invocation_id: Optional[str] = None,
    state: Mapping[str, Any] | None = None,
) -> bool:
    return (
        classify_turn(
            user_query,
            session_events=session_events,
            current_invocation_id=current_invocation_id,
            state=state,
        )
        != "substantive"
    )


def should_skip_tools(
    user_query: str,
    *,
    session_events: Sequence[Any] | None = None,
    current_invocation_id: Optional[str] = None,
    state: Mapping[str, Any] | None = None,
) -> bool:
    label = classify_turn(
        user_query,
        session_events=session_events,
        current_invocation_id=current_invocation_id,
        state=state,
    )
    if label == "substantive":
        return False
    if label == "greeting":
        return True
    # acknowledgment: skip re-fetch when prior turn already answered
    if label == "acknowledgment":
        return True
    return True


def build_conversational_reply(
    label: ConversationalLabel,
    *,
    property_address: Optional[str] = None,
    prior_analysis: bool = False,
) -> str:
    addr = (property_address or "").strip()
    if label == "greeting":
        if addr:
            return (
                f"Hello! I'm here to help with your property at {addr}. "
                "You can ask about checkpoints, documents, repairs, coverage, "
                "local providers, or costs — what would you like to explore?"
            )
        return (
            "Hello! I'm here to help with your home and property care. "
            "What would you like to know today?"
        )
    if prior_analysis or label == "acknowledgment":
        return (
            "You're welcome! I'm glad that was helpful. "
            "Let me know anytime you want updated information or a new question "
            "about your property."
        )
    return "Happy to help! What would you like to know about your property?"


def conversational_system_note(label: ConversationalLabel) -> str:
    return (
        "[Conversational turn — do NOT call any tools, sub-agents, or transfer_to_agent. "
        f"Intent={label}. Reply in plain text only, briefly.]"
    )
