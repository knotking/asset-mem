"""Turn hydration, optional-branch detection, and canned conversational replies."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Literal, Mapping, Optional, Sequence

ConversationalLabel = Literal[
    "greeting", "acknowledgment", "capabilities", "substantive"
]

_PHRASES_PATH = Path(__file__).resolve().parent / "conversational_phrases.json"

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

# User wants the prior full structured report replayed, not a new short summary.
_FULL_ANALYSIS_REPLAY_RE = re.compile(
    r"\b("
    r"show (?:me )?(?:the )?full (?:analysis|report)|"
    r"(?:show|see|view|open|repeat|display) (?:me )?(?:the )?(?:full |complete )?"
    r"(?:analysis|report|results)(?: again)?|"
    r"(?:full |complete )(?:analysis|report) again|"
    r"run (?:a )?full analysis|"
    r"(?:analyse|analyze) (?:my )?checkpoints again|"
    r"re-?run (?:the )?analysis"
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
# Set for the current executor invocation when structured checkpoint analysis runs.
EXECUTOR_INVOCATION_STRUCTURED_ANALYSIS_KEY = (
    "_executor_invocation_structured_analysis"
)

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

_HOW_ABOUT_OPTIONAL_BRANCH_RE = re.compile(
    r"\bhow about\s+(?:the\s+)?(?P<branch>coverage|diy|service|cost)\b",
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


def is_greeting_like(normalized: str) -> bool:
    return _matches_any_phrase(normalized, GREETING_PHRASES)


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

    how_about_match = _HOW_ABOUT_OPTIONAL_BRANCH_RE.search(normalized)
    if how_about_match:
        branch = how_about_match.group("branch").lower()
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

    return picked


def clear_executor_invocation_analysis_flag(state: Any) -> None:
    """Reset per-invocation analysis tracking before the executor runs."""
    if state is not None and hasattr(state, "__setitem__"):
        state[EXECUTOR_INVOCATION_STRUCTURED_ANALYSIS_KEY] = False


def mark_executor_invocation_structured_analysis(state: Any) -> None:
    """This executor invocation is producing (or passing through) structured analysis."""
    if state is not None and hasattr(state, "__setitem__"):
        state[EXECUTOR_INVOCATION_STRUCTURED_ANALYSIS_KEY] = True


def executor_invocation_requested_structured_analysis(
    state: Mapping[str, Any] | None,
) -> bool:
    if not state:
        return False
    return bool(state.get(EXECUTOR_INVOCATION_STRUCTURED_ANALYSIS_KEY))


def query_requests_full_analysis_replay(user_query: str) -> bool:
    """True when the user asks to see the full prior checkpoint analysis again."""
    normalized = normalize_user_query(user_query)
    if not normalized:
        return False
    return bool(_FULL_ANALYSIS_REPLAY_RE.search(normalized))


def prior_checkpoint_analysis_in_session(state: Mapping[str, Any] | None) -> bool:
    """True when this session already delivered checkpoint analysis or has a stash."""
    if not state:
        return False
    if state.get(CHECKPOINT_LAST_RESPONSE_KIND_KEY) == "analysis":
        return True
    if state.get("checkpoint_analysis_dual_format"):
        return True
    if state.get("checkpoint_parallel_results"):
        return True
    return False


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
