"""Classify casual vs substantive user turns for property_agent routing."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Literal, Mapping, Optional, Sequence

ConversationalLabel = Literal[
    "greeting", "acknowledgment", "capabilities", "substantive"
]

_PHRASES_PATH = Path(__file__).resolve().parent / "conversational_phrases.json"

# Imperatives / questions that always need tools even when short.
_SUBSTANTIVE_RE = re.compile(
    r"\b("
    r"recommend|analyse|analyze|analysis|find|show|compare|explain|search|list|"
    r"help me with|help me find|how much|how do i|what about|what changed|when did|why is|why are|"
    r"can you find|can you recommend|can you show|can you explain|can you compare|"
    r"do i have|is this covered|coverage for|providers? for|cost of|estimate|"
    r"diy steps|checkpoints? with|damage|repair|inspect"
    r")\b",
    re.IGNORECASE,
)

_WH_QUESTION_RE = re.compile(
    r"^\s*(how|what|when|where|why|who|which|can|could|should|is|are|do|does)\b", re.I
)

# User explicitly wants optional branches (coverage / DIY / service / cost pipeline).
_OPTIONAL_ANALYSIS_RE = re.compile(
    r"\b("
    r"recommend|analyse|analyze|analysis|run analysis|full analysis|"
    r"find providers?|find products?|local providers?|service providers?|"
    r"diy steps|step by step|how (?:do i|to) (?:fix|repair)|"
    r"coverage for|is this covered|am i covered|warranty|insurance for|check coverage|"
    r"cost estimate|how much|get details on cost|estimate (?:the )?cost|"
    r"what would it cost|compare.*cost"
    r")\b",
    re.IGNORECASE,
)

# Checkpoint Q&A / timeline only — UI optional-agent toggles must not trigger branches.
_RETRIEVAL_ONLY_RE = re.compile(
    r"\b("
    r"show me|can you show|display|list|summarize|summary of|"
    r"latest|most recent|last inspection|inspection notes|notes for|"
    r"what changed|what did|when did|when was|last time|"
    r"tell me about|read me|what does it say|what do the notes say|"
    r"compare.*(?:over time|between|checkpoints)"
    r")\b",
    re.IGNORECASE,
)

CHECKPOINT_LAST_RESPONSE_KIND_KEY = "checkpoint_last_response_kind"
CONVERSATIONAL_TURN_STATE_KEY = "conversational_turn"
LAST_OFFERED_OPTIONS_KEY = "last_offered_options"

# Order matches ``_CAPABILITY_BULLETS`` (for "first one" / "second one" picks).
DEFAULT_CAPABILITY_OPTIONS: tuple[str, ...] = (
    "checkpoints",
    "documents",
    "coverage",
    "diy",
    "service",
    "cost",
)

_INDEXICAL_PHRASE_RE = re.compile(
    r"^(?:how about )?(?:the )?(?P<ord>"
    r"first|second|third|fourth|fifth|sixth|"
    r"1st|2nd|3rd|4th|5th|6th"
    r") one"
    r"(?: in (?:your|the) list)?$",
    re.IGNORECASE,
)

# Parallel checkpoint branches (not checkpoints/documents menu items).
OPTIONAL_CHECKPOINT_BRANCHES: tuple[str, ...] = ("coverage", "diy", "service", "cost")

_MEAN_OPTIONAL_BRANCH_RE = re.compile(
    r"\b(?:i mean|actually|instead|just|only|want)\s+(?:the\s+)?"
    r"(?P<branch>coverage|diy|service|cost)\b",
    re.IGNORECASE,
)

_STANDALONE_OPTIONAL_BRANCH_RE = re.compile(
    r"^(?P<branch>coverage|diy|service|cost)$",
    re.IGNORECASE,
)

_ORDINAL_TO_INDEX: dict[str, int] = {
    "first": 0,
    "1st": 0,
    "second": 1,
    "2nd": 1,
    "third": 2,
    "3rd": 2,
    "fourth": 3,
    "4th": 3,
    "fifth": 4,
    "5th": 4,
    "sixth": 5,
    "6th": 5,
}

_EXPANDED_QUERY_BY_OPTION: dict[str, str] = {
    "checkpoints": (
        "Show me my maintenance checkpoints and the latest inspection findings."
    ),
    "documents": (
        "Answer my question using my uploaded property documents such as lease or policy."
    ),
    "coverage": (
        "Explain warranty and insurance coverage using my property documents."
    ),
    "diy": "Suggest DIY steps, videos, and products for my property issue.",
    "service": "Recommend local contractors and service providers near my property.",
    "cost": "Estimate repair costs and compare DIY versus professional options.",
}

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

CAPABILITY_INQUIRY_PHRASES: tuple[str, ...] = tuple(
    PHRASE_CATEGORIES.get("capability_inquiry", [])
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


def _contains_any_phrase(normalized: str, phrases: Sequence[str]) -> bool:
    for phrase in phrases:
        if phrase and phrase in normalized:
            return True
    return False


def _has_task_verb_signal(normalized: str) -> bool:
    """Task verbs / WH-questions without treating casual meta phrases as substantive."""
    if _SUBSTANTIVE_RE.search(normalized):
        return True
    if "?" in (normalized or "") and _WH_QUESTION_RE.match(normalized):
        return True
    if _WH_QUESTION_RE.match(normalized) and len(normalized.split()) >= 3:
        return True
    return False


def is_substantive_signal(normalized: str) -> bool:
    if not normalized:
        return False
    if (
        is_greeting_like(normalized)
        or is_acknowledgment_like(normalized)
        or is_capability_inquiry_like(normalized)
    ):
        return False
    return _has_task_verb_signal(normalized)


def is_greeting_like(normalized: str) -> bool:
    return _matches_any_phrase(normalized, GREETING_PHRASES)


def is_acknowledgment_like(normalized: str) -> bool:
    return _matches_any_phrase(normalized, ACKNOWLEDGMENT_PHRASES)


_PROPERTY_TASK_TOPIC_PHRASES = (
    "tell me about",
    "tell me more",
    "what about",
    "what is in",
    "what s in",
    "read my",
    "summarize",
    "summary of",
    "show me",
    "can you show",
)

_PROPERTY_TASK_TOPIC_WORDS = (
    "document",
    "documents",
    "lease",
    "policy",
    "insurance",
    "checkpoint",
    "checkpoints",
    "coverage",
    "kitchen",
    "garage",
    "inspection",
    "warranty",
    "provider",
    "repair",
    "cost",
    "diy",
)


def requests_property_information(normalized: str) -> bool:
    """True when the user asks for property docs, checkpoints, or similar (not casual chat)."""
    if is_substantive_signal(normalized):
        return True
    if _RETRIEVAL_ONLY_RE.search(normalized):
        return True
    if _contains_any_phrase(normalized, _PROPERTY_TASK_TOPIC_PHRASES):
        return True
    if any(
        marker in normalized for marker in ("i mean", "actually", "instead", "rather")
    ) and _contains_any_phrase(
        normalized,
        _PROPERTY_TASK_TOPIC_WORDS + ("first", "second", "third", "one", "two"),
    ):
        return True
    return False


def is_capability_inquiry_like(normalized: str) -> bool:
    if _contains_any_phrase(normalized, CAPABILITY_INQUIRY_PHRASES):
        return True
    # Vague "I don't know / what do you suggest" without a concrete property task.
    if _has_task_verb_signal(normalized):
        return False
    if "don t know" in normalized or "dont know" in normalized:
        if any(
            token in normalized
            for token in (
                "suggest",
                "should i",
                "what to ask",
                "where to start",
                "what can i",
            )
        ):
            return True
    if _contains_any_phrase(
        normalized,
        ("what do you suggest", "what would you suggest", "any suggestions"),
    ):
        return True
    return False


_TURN_PAYLOAD_STATE_KEYS = (
    "user_query",
    "property_address",
    "property_id",
    "primary_agent",
    "checkpoint_ids",
    "context_doc_uris",
    "checkpoint_optional_agents",
    "search_location",
    "correlation_id",
)


def sanitize_client_json_text(text: str) -> str:
    """Normalize smart quotes and stray whitespace from mobile/web clients."""
    out = (text or "").strip()
    for src, dst in (
        ("\u201c", '"'),
        ("\u201d", '"'),
        ("\u2018", "'"),
        ("\u2019", "'"),
    ):
        out = out.replace(src, dst)
    return out


def parse_turn_payload_from_text(text: str) -> Optional[dict[str, Any]]:
    """Parse ADK Web / client JSON user message into a dict."""
    raw = sanitize_client_json_text(text)
    if not raw or raw.lower().startswith("for context:"):
        return None
    candidates = [raw]
    if raw.startswith("{") or raw.startswith("["):
        candidates.append(raw.lstrip("\n\r\t "))
    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    return None


def _latest_user_payload_from_events(
    session_events: Sequence[Any] | None,
    *,
    current_invocation_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    if not session_events:
        return None

    def _scan(require_invocation: bool) -> Optional[dict[str, Any]]:
        for event in reversed(list(session_events)):
            if require_invocation and current_invocation_id:
                inv_id = getattr(event, "invocation_id", None)
                if inv_id != current_invocation_id:
                    continue
            author = getattr(event, "author", None)
            if author not in (None, "user"):
                continue
            text = _event_text(event)
            payload = parse_turn_payload_from_text(text)
            if payload and isinstance(payload.get("user_query"), str):
                if payload["user_query"].strip():
                    return payload
        return None

    found = _scan(require_invocation=True)
    if found is not None:
        return found
    return _scan(require_invocation=False)


def _payload_from_llm_request(llm_request: Any) -> Optional[dict[str, Any]]:
    contents = getattr(llm_request, "contents", None) or []
    for content in reversed(list(contents)):
        role = getattr(content, "role", None)
        if role not in (None, "user"):
            continue
        parts = getattr(content, "parts", None) or []
        for part in reversed(list(parts)):
            text = getattr(part, "text", None)
            if not isinstance(text, str):
                continue
            payload = parse_turn_payload_from_text(text)
            if payload and isinstance(payload.get("user_query"), str):
                if payload["user_query"].strip():
                    return payload
    return None


def hydrate_turn_state_from_context(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> str:
    """
    Copy the **current** turn's client payload into session state.

    Always prefers the latest user message for this invocation (or the
    in-flight ``llm_request``) over a stale ``user_query`` left in session state
    from an earlier turn.
    """
    state = getattr(ctx, "state", None)
    if state is None:
        return ""

    inv_id = None
    invocation = getattr(ctx, "_invocation_context", None)
    if invocation is not None:
        inv_id = getattr(invocation, "invocation_id", None)

    events: list[Any] = []
    if invocation is not None:
        session = getattr(invocation, "session", None)
        if session is not None:
            events = list(getattr(session, "events", None) or [])

    payload: Optional[dict[str, Any]] = None
    if llm_request is not None:
        payload = _payload_from_llm_request(llm_request)
    if payload is None:
        payload = _latest_user_payload_from_events(events, current_invocation_id=inv_id)

    if payload and hasattr(state, "__setitem__"):
        for key in _TURN_PAYLOAD_STATE_KEYS:
            if key in payload and payload[key] is not None:
                state[key] = payload[key]
        return resolve_user_query_from_state(state)

    return resolve_user_query_from_state(state)


def resolve_user_query_for_turn(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> str:
    return hydrate_turn_state_from_context(ctx, llm_request=llm_request)


def resolve_user_query_from_state(state: Mapping[str, Any] | None) -> str:
    if not state:
        return ""
    for key in ("user_query", "app:user_query"):
        value = state.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def resolve_property_address_from_state(
    state: Mapping[str, Any] | None,
) -> Optional[str]:
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
        "property_agent",
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
        if "```json" in text and any(
            marker in text for marker in _ANALYSIS_JSON_MARKERS
        ):
            return True
    return False


def record_last_offered_options(state: Any) -> None:
    """Remember capability menu order for indexical follow-ups (``second one``)."""
    if state is None or not hasattr(state, "__setitem__"):
        return
    state[LAST_OFFERED_OPTIONS_KEY] = list(DEFAULT_CAPABILITY_OPTIONS)


def _indexical_option_key(
    normalized: str,
    state: Mapping[str, Any] | None,
) -> Optional[str]:
    """Map ``third one`` / ``how about the second one in your list`` to a menu option key."""
    if not normalized or state is None:
        return None
    match = _INDEXICAL_PHRASE_RE.match(normalized)
    if not match:
        return None
    options = state.get(LAST_OFFERED_OPTIONS_KEY)
    if not isinstance(options, list) or not options:
        return None
    idx = _ORDINAL_TO_INDEX.get(match.group("ord").lower())
    if idx is None or idx < 0 or idx >= len(options):
        return None
    return str(options[idx])


def is_indexical_phrase(normalized: str) -> bool:
    """True for ``second one``, ``how about the 4th one in your list``, etc."""
    return bool(_INDEXICAL_PHRASE_RE.match(normalized))


def expand_indexical_user_query(
    user_query: str,
    state: Mapping[str, Any] | None,
) -> str:
    """
    Expand ``first one`` / ``second one`` after a capability list into a full query.

    No-op when session has no ``last_offered_options`` or the phrase is not indexical.
    """
    key = _indexical_option_key(normalize_user_query(user_query), state)
    if not key:
        return user_query
    expanded = _EXPANDED_QUERY_BY_OPTION.get(key)
    return expanded if expanded else user_query


def resolve_requested_optional_branches(
    user_query: str,
    state: Mapping[str, Any] | None = None,
) -> list[str]:
    """
    Optional analysis branches explicitly requested in ``user_query``.

    Examples: ``I mean coverage``, ``the third one`` (coverage menu item), ``find providers``.
    """
    normalized = normalize_user_query(user_query)
    if not normalized:
        return []

    if _RETRIEVAL_ONLY_RE.search(normalized) and not (
        _MEAN_OPTIONAL_BRANCH_RE.search(normalized)
        or _STANDALONE_OPTIONAL_BRANCH_RE.match(normalized)
        or _indexical_option_key(normalized, state)
    ):
        return []

    picked: list[str] = []

    menu_key = _indexical_option_key(normalized, state)
    if menu_key in OPTIONAL_CHECKPOINT_BRANCHES:
        picked.append(menu_key)

    mean_match = _MEAN_OPTIONAL_BRANCH_RE.search(normalized)
    if mean_match:
        branch = mean_match.group("branch").lower()
        if branch in OPTIONAL_CHECKPOINT_BRANCHES and branch not in picked:
            picked.append(branch)
    standalone_match = _STANDALONE_OPTIONAL_BRANCH_RE.match(normalized)
    if standalone_match:
        branch = standalone_match.group("branch").lower()
        if branch in OPTIONAL_CHECKPOINT_BRANCHES and branch not in picked:
            picked.append(branch)

    if picked:
        return picked

    if _OPTIONAL_ANALYSIS_RE.search(normalized):
        if re.search(
            r"\b(coverage|warranty|insurance|is this covered|am i covered)\b",
            normalized,
            re.I,
        ):
            if "coverage" not in picked:
                picked.append("coverage")
        if re.search(
            r"\b(diy|step by step|how (?:do i|to) (?:fix|repair))\b",
            normalized,
            re.I,
        ):
            if "diy" not in picked:
                picked.append("diy")
        if re.search(
            r"\b(providers?|contractors?|local pros?|service providers?)\b",
            normalized,
            re.I,
        ):
            if "service" not in picked:
                picked.append("service")
        if re.search(
            r"\b(cost|how much|estimate|price)\b",
            normalized,
            re.I,
        ):
            if "cost" not in picked:
                picked.append("cost")
        if not picked:
            ui = None
            if state is not None:
                ui = state.get("checkpoint_optional_agents") or state.get(
                    "_checkpoint_optional_agents_ui"
                )
            if isinstance(ui, list) and ui:
                return [str(b) for b in ui if str(b) in OPTIONAL_CHECKPOINT_BRANCHES]

    return picked


def classify_turn(
    user_query: str,
    *,
    session_events: Sequence[Any] | None = None,
    current_invocation_id: Optional[str] = None,
    state: Mapping[str, Any] | None = None,
) -> ConversationalLabel:
    _ = (session_events, current_invocation_id, state)
    normalized = normalize_user_query(user_query)
    if not normalized:
        return "greeting"

    # Task signals win over casual phrases (e.g. "hello, show kitchen notes").
    if requests_property_information(normalized):
        return "substantive"
    if is_substantive_signal(normalized):
        return "substantive"
    if _INDEXICAL_PHRASE_RE.match(normalized):
        return "substantive"

    if is_greeting_like(normalized):
        return "greeting"

    if is_capability_inquiry_like(normalized):
        return "capabilities"

    if is_acknowledgment_like(normalized):
        return "acknowledgment"

    # Uncertain — prefer substantive so the model can use conversation history.
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


def requests_checkpoint_optional_analysis(
    user_query: str,
    *,
    state: Mapping[str, Any] | None = None,
) -> bool:
    """
    True when the user asks for coverage/DIY/service/cost optional analysis.

    UI ``checkpoint_optional_agents`` toggles alone are insufficient unless the
    user also picks a branch (e.g. ``I mean coverage``, ``the third one``).
    """
    if resolve_requested_optional_branches(user_query, state):
        return True
    normalized = normalize_user_query(user_query)
    if not normalized:
        return False
    if _RETRIEVAL_ONLY_RE.search(normalized):
        return False
    if _OPTIONAL_ANALYSIS_RE.search(normalized):
        return True
    return False


def apply_query_gated_optional_agents(
    state: Mapping[str, Any],
    user_query: str,
) -> None:
    """Set or clear optional agents from query intent (retrieval-only vs branch picks)."""
    if not hasattr(state, "__setitem__"):
        return

    branches = resolve_requested_optional_branches(user_query, state)
    if branches:
        ui = state.get("checkpoint_optional_agents") or state.get(
            "_checkpoint_optional_agents_ui"
        )
        if isinstance(ui, list) and ui:
            filtered = [b for b in branches if b in ui]
            state["checkpoint_optional_agents"] = filtered or list(branches)
        else:
            state["checkpoint_optional_agents"] = list(branches)
        return

    if requests_checkpoint_optional_analysis(user_query, state=state):
        return

    if state.get("checkpoint_optional_agents"):
        state["_checkpoint_optional_agents_ui"] = state.get(
            "checkpoint_optional_agents"
        )
        state["checkpoint_optional_agents"] = []


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
    if label in ("greeting", "capabilities"):
        return True
    # acknowledgment: skip re-fetch when prior turn already answered
    if label == "acknowledgment":
        return True
    return True


_CAPABILITY_BULLETS = (
    "- **Maintenance checkpoints:** Review areas of your home over time and inspection findings.\n"
    "- **Property documents:** Answer questions from your uploaded lease, home policy, insurance, and similar files.\n"
    "- **Coverage:** Explain warranty and insurance points using your documents.\n"
    "- **DIY:** Suggest step-by-step fixes, videos, and products when you want to do it yourself.\n"
    "- **Service:** Recommend local contractors and service providers near your property.\n"
    "- **Cost:** Estimate repair costs and compare DIY vs professional options.\n"
)


def _context_attachment_hint(state: Mapping[str, Any] | None) -> str:
    """When the client attached checkpoints/docs but the user is unsure what to ask."""
    if not state:
        return ""
    checkpoint_ids = state.get("checkpoint_ids") or []
    doc_uris = state.get("context_doc_uris") or []
    if not checkpoint_ids and not doc_uris:
        return ""
    parts: list[str] = []
    if checkpoint_ids:
        parts.append("checkpoints selected")
    if doc_uris:
        parts.append("documents attached")
    joined = " and ".join(parts)
    return (
        f"You already have {joined} for this chat. For example, you could ask: "
        "Is this issue covered? What DIY steps apply? Who are local providers? "
        "Or what might repairs cost?\n\n"
    )


def build_capabilities_summary(
    *,
    property_address: Optional[str] = None,
    state: Mapping[str, Any] | None = None,
) -> str:
    """Product capability list for greetings and 'how can you help' questions."""
    record_last_offered_options(state)
    addr = (property_address or "").strip()
    hint = _context_attachment_hint(state)
    intro = (
        f"I can help with your property at {addr}. Here is what I can do:\n\n"
        if addr
        else "I can help with your property. Here is what I can do:\n\n"
    )
    return (
        hint + intro + _CAPABILITY_BULLETS + "\nWhat would you like to explore first?"
    )


def build_conversational_reply(
    label: ConversationalLabel,
    *,
    property_address: Optional[str] = None,
    prior_analysis: bool = False,
    state: Mapping[str, Any] | None = None,
) -> str:
    if label == "capabilities":
        return build_capabilities_summary(
            property_address=property_address, state=state
        )

    addr = (property_address or "").strip()
    hint = _context_attachment_hint(state)
    if label == "greeting":
        record_last_offered_options(state)
        if addr:
            return (
                f"Hello! I'm here to help with your property at {addr}.\n\n"
                f"{hint}Here is what I can do:\n\n{_CAPABILITY_BULLETS}\n"
                "What would you like to explore first?"
            )
        return (
            "Hello! I'm here to help with your home and property care.\n\n"
            f"{hint}Here is what I can do:\n\n{_CAPABILITY_BULLETS}\n"
            "What would you like to explore first?"
        )
    if prior_analysis or label == "acknowledgment":
        return (
            "You're welcome! I'm glad that was helpful. "
            "Let me know anytime you want updated information or a new question "
            "about your property."
        )
    return "Happy to help! What would you like to know about your property?"
