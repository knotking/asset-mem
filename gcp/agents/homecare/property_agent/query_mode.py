"""Query modes and session working memory for ChatGPT-style multi-turn chat."""

from __future__ import annotations

import json
import re
from typing import Any, Literal, Mapping, Optional

from .conversational_intent import (
    OPTIONAL_CHECKPOINT_BRANCHES,
    _HOW_ABOUT_OPTIONAL_BRANCH_RE,
    _MEAN_OPTIONAL_BRANCH_RE,
    _STANDALONE_OPTIONAL_BRANCH_RE,
    resolve_requested_optional_branches,
)

SESSION_WORKING_MEMORY_SNAPSHOT_KEY = "session_working_memory_snapshot"

QueryModeKind = Literal[
    "interpret_session",
    "branch_issue_search",
    "branch_entity_search",
    "branch_explicit",
]

_ENTITY_DETAIL_RE = re.compile(
    r"\b("
    r"more (?:details?|info(?:rmation)?) (?:about|on)|"
    r"(?:tell|give) me (?:more )?(?:about|on)|"
    r"(?:what|anything) (?:do you know |can you tell me )?about|"
    r"learn more about|details on|info on|"
    r"who is|what is|get (?:more )?details (?:about|on)|"
    r"more on"
    r")\b",
    re.IGNORECASE,
)

_EXPLICIT_BRANCH_RE = re.compile(
    r"\b("
    r"find (?:local )?(?:service )?providers?|"
    r"find (?:local )?contractors?|"
    r"recommend (?:local )?providers?|"
    r"run (?:a )?(?:cost|coverage|diy|service) (?:analysis|estimate)|"
    r"(?:yes,? )?(?:do|run) (?:the )?(?:cost|coverage|diy|service)"
    r")\b",
    re.IGNORECASE,
)


def query_requests_entity_detail(user_query: str) -> bool:
    """True when the user asks for more information about a specific entity."""
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    if _ENTITY_DETAIL_RE.search(normalized):
        return True
    # Short message that is only a business-like name (2+ capitalized words).
    if re.match(
        r"^[A-Z][\w'&.-]+(?:\s+[A-Z][\w'&.-]+)+$",
        normalized,
    ):
        return True
    return False


def _names_from_service_results_blob(obj: Any) -> list[str]:
    if not isinstance(obj, dict):
        return []
    svc = obj.get("serviceResults")
    if not isinstance(svc, dict):
        analysis = obj.get("analysis")
        if isinstance(analysis, dict):
            svc = analysis.get("serviceResults")
    if not isinstance(svc, dict):
        return []
    local = svc.get("localPros")
    if not isinstance(local, dict):
        return []
    names: list[str] = []
    for key in ("serpAPIResults", "googleSearchResults", "yelpAPIResults"):
        items = local.get(key)
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("title") or item.get("businessName")
            if isinstance(name, str) and name.strip():
                names.append(name.strip())
    return names


def _provider_entry_from_item(item: dict[str, Any]) -> dict[str, Any]:
    """Normalize a serviceResults list item (synthesis may use ``service`` not ``services``)."""
    entry = {
        k: item.get(k)
        for k in (
            "name",
            "services",
            "notes",
            "website",
            "phone",
            "contact_info",
            "location",
            "rating",
        )
        if item.get(k) is not None
    }
    raw_service = item.get("service")
    if raw_service is not None and not entry.get("services"):
        if isinstance(raw_service, str) and raw_service.strip():
            entry["services"] = [raw_service.strip()]
        elif isinstance(raw_service, list):
            entry["services"] = raw_service
    name = item.get("name") or item.get("title") or item.get("businessName")
    if isinstance(name, str) and name.strip() and "name" not in entry:
        entry["name"] = name.strip()
    return entry


def _merge_provider_details(
    existing: dict[str, Any], new: dict[str, Any]
) -> dict[str, Any]:
    merged = dict(existing)
    for key, value in new.items():
        if value is None:
            continue
        if key not in merged or not merged.get(key):
            merged[key] = value
        elif key == "services" and isinstance(value, list):
            old = merged.get("services")
            if isinstance(old, list):
                merged["services"] = list(dict.fromkeys([*old, *value]))
            else:
                merged["services"] = value
    return merged


def _parse_json_maybe(text: Any) -> Any:
    if not isinstance(text, str) or not text.strip():
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _analysis_json_from_dual_format(text: str) -> Optional[dict[str, Any]]:
    if not text:
        return None
    match = re.search(r"```json\s*\n?([\s\S]*?)```", text)
    if not match:
        return None
    parsed = _parse_json_maybe(match.group(1).strip())
    return parsed if isinstance(parsed, dict) else None


def _analysis_object_from_state(state: Mapping[str, Any] | None) -> Optional[dict[str, Any]]:
    """Return the inner ``analysis`` object from session stash, if present."""
    if not state:
        return None
    stash = state.get("checkpoint_analysis_dual_format")
    if isinstance(stash, str):
        parsed = _analysis_json_from_dual_format(stash)
        if isinstance(parsed, dict):
            inner = parsed.get("analysis")
            return inner if isinstance(inner, dict) else parsed
    parallel = _parse_json_maybe(state.get("checkpoint_parallel_results"))
    if isinstance(parallel, dict):
        for key, value in parallel.items():
            if not any(
                token in str(key).lower()
                for token in ("diy", "cost", "coverage", "service")
            ):
                continue
            inner = _parse_json_maybe(value) if isinstance(value, str) else value
            if isinstance(inner, dict) and inner.get("analysis"):
                analysis = inner.get("analysis")
                if isinstance(analysis, dict):
                    return analysis
    return None


def _branch_payload_has_content(branch: str, analysis: dict[str, Any]) -> bool:
    if branch == "diy":
        diy = analysis.get("diyResults")
        if not isinstance(diy, dict):
            return False
        steps = diy.get("diySteps")
        if isinstance(steps, dict) and steps.get("steps"):
            return True
        videos = (diy.get("youtubeSearch") or {}).get("videos")
        return isinstance(videos, list) and len(videos) > 0
    if branch == "cost":
        cost = analysis.get("costEstimationResults")
        if not isinstance(cost, dict):
            return False
        estimates = cost.get("costEstimates")
        return isinstance(estimates, dict) and bool(estimates)
    if branch == "coverage":
        cov = analysis.get("coverageResult")
        return isinstance(cov, dict) and bool(cov)
    if branch == "service":
        svc = analysis.get("serviceResults")
        if not isinstance(svc, dict):
            return False
        local = svc.get("localPros")
        if not isinstance(local, dict):
            return False
        for key in ("serpAPIResults", "googleSearchResults", "yelpAPIResults"):
            items = local.get(key)
            if isinstance(items, list) and items:
                return True
        return False
    return False


def prior_analysis_branches_completed(
    state: Mapping[str, Any] | None,
) -> frozenset[str]:
    """Branches with substantive data in the latest completed analysis."""
    analysis = _analysis_object_from_state(state)
    if not analysis:
        return frozenset()
    completed: set[str] = set()
    for branch in OPTIONAL_CHECKPOINT_BRANCHES:
        if _branch_payload_has_content(branch, analysis):
            completed.add(branch)
    return frozenset(completed)


_EXPLAIN_FOLLOW_UP_RE = re.compile(
    r"\b("
    r"explain|walk me through|help me understand|clarify|"
    r"why (?:is|are|does|do)|what (?:are|were) the|"
    r"can you explain|tell me more about the|"
    r"break down|elaborate on"
    r")\b",
    re.IGNORECASE,
)

_FRESH_EXTERNAL_DATA_RE = re.compile(
    r"\b("
    r"find (?:me )?(?:more|new|additional|other)\s+(?:local\s+)?(?:service\s+)?providers?|"
    r"(?:get|run|fetch)\s+(?:new|fresh|latest)\s+(?:provider|search)|"
    r"re-?run|run again|refresh|start over|from scratch|"
    r"new search for providers?"
    r")\b",
    re.IGNORECASE,
)


def query_looks_like_explain_follow_up(user_query: str) -> bool:
    """True for explain/clarify questions about prior analysis (not menu picks)."""
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    if _HOW_ABOUT_OPTIONAL_BRANCH_RE.search(normalized):
        return False
    if _MEAN_OPTIONAL_BRANCH_RE.search(normalized):
        return False
    if _STANDALONE_OPTIONAL_BRANCH_RE.match(normalized):
        return False
    return bool(_EXPLAIN_FOLLOW_UP_RE.search(normalized))


def query_requests_fresh_external_data(user_query: str) -> bool:
    """True when the user wants a new provider search or explicit re-run."""
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    return bool(_FRESH_EXTERNAL_DATA_RE.search(normalized))


def _iter_service_result_blobs(state: Mapping[str, Any]) -> list[dict[str, Any]]:
    blobs: list[dict[str, Any]] = []
    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        raw = snapshot.get("service_results_blob")
        if isinstance(raw, dict):
            blobs.append(raw)

    parallel = _parse_json_maybe(state.get("checkpoint_parallel_results"))
    if isinstance(parallel, dict):
        for key, value in parallel.items():
            if "service" not in str(key).lower():
                continue
            inner = _parse_json_maybe(value) if isinstance(value, str) else value
            if isinstance(inner, dict):
                blobs.append(inner)

    stash = state.get("checkpoint_analysis_dual_format")
    if isinstance(stash, str):
        parsed = _analysis_json_from_dual_format(stash)
        if isinstance(parsed, dict):
            blobs.append(parsed)
    return blobs


def extract_known_service_providers(state: Mapping[str, Any] | None) -> list[str]:
    """Provider names from prior structured analysis in session state."""
    if not state:
        return []
    seen: dict[str, str] = {}

    def _add(names: list[str]) -> None:
        for n in names:
            key = n.lower()
            if key not in seen:
                seen[key] = n

    for blob in _iter_service_result_blobs(state):
        _add(_names_from_service_results_blob(blob))

    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        for name in snapshot.get("service_providers_mentioned") or []:
            if isinstance(name, str) and name.strip():
                _add([name.strip()])

    return sorted(seen.values(), key=len, reverse=True)


def extract_service_provider_details(
    state: Mapping[str, Any] | None,
) -> dict[str, dict[str, Any]]:
    """Map provider name -> detail fields from prior service branch / synthesis."""
    if not state:
        return {}
    out: dict[str, dict[str, Any]] = {}

    def _add_from_blob(blob: dict[str, Any]) -> None:
        svc = blob.get("serviceResults")
        if not isinstance(svc, dict):
            analysis = blob.get("analysis")
            if isinstance(analysis, dict):
                svc = analysis.get("serviceResults")
        if not isinstance(svc, dict):
            return
        local = svc.get("localPros")
        if not isinstance(local, dict):
            return
        for key in ("serpAPIResults", "googleSearchResults", "yelpAPIResults"):
            items = local.get(key)
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = item.get("name") or item.get("title") or item.get("businessName")
                if not isinstance(name, str) or not name.strip():
                    continue
                key = name.strip()
                entry = _provider_entry_from_item(item)
                if key in out:
                    out[key] = _merge_provider_details(out[key], entry)
                else:
                    out[key] = entry

    for blob in _iter_service_result_blobs(state):
        _add_from_blob(blob)

    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        stored = snapshot.get("service_provider_details")
        if isinstance(stored, dict):
            for name, detail in stored.items():
                if name not in out and isinstance(detail, dict):
                    out[str(name)] = detail
    return out


def snapshot_session_analysis_context(state: Any) -> None:
    """
    Persist analysis facts for follow-up turns.

    Called before context-only routing clears active optional agents, and after
    structured analysis completes.
    """
    if state is None or not hasattr(state, "__setitem__"):
        return
    memory = _build_session_working_memory_from_live(state)
    memory.pop("service_results_blob", None)
    if not memory:
        return
    existing = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(existing, dict):
        merged = dict(existing)
        for key, value in memory.items():
            if key == "service_providers_mentioned":
                names = set(merged.get(key) or [])
                names.update(value or [])
                merged[key] = sorted(names, key=str.lower)
            elif key == "service_provider_details":
                details = dict(merged.get(key) or {})
                if isinstance(value, dict):
                    details.update(value)
                merged[key] = details
            elif value:
                merged[key] = value
        memory = merged
    state[SESSION_WORKING_MEMORY_SNAPSHOT_KEY] = memory


def _service_results_blob_for_snapshot(state: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    stash = state.get("checkpoint_analysis_dual_format")
    if isinstance(stash, str):
        parsed = _analysis_json_from_dual_format(stash)
        if isinstance(parsed, dict) and _names_from_service_results_blob(parsed):
            return parsed
    parallel = _parse_json_maybe(state.get("checkpoint_parallel_results"))
    if isinstance(parallel, dict):
        for key, value in parallel.items():
            if "service" not in str(key).lower():
                continue
            inner = _parse_json_maybe(value) if isinstance(value, str) else value
            if isinstance(inner, dict) and _names_from_service_results_blob(inner):
                return inner
    return None


def _build_session_working_memory_from_live(
    state: Mapping[str, Any],
) -> dict[str, Any]:
    memory: dict[str, Any] = {}
    providers = extract_known_service_providers(state)
    if providers:
        memory["service_providers_mentioned"] = providers[:12]
    details = extract_service_provider_details(state)
    if details:
        memory["service_provider_details"] = details
    blob = _service_results_blob_for_snapshot(state)
    if blob:
        memory["service_results_blob"] = blob

    stash = state.get("checkpoint_analysis_dual_format")
    if isinstance(stash, str):
        parsed = _analysis_json_from_dual_format(stash)
        if isinstance(parsed, dict):
            analysis = parsed.get("analysis")
            if isinstance(analysis, dict):
                summary = analysis.get("checkpointSummary")
                if isinstance(summary, dict):
                    memory["checkpoint_summary"] = {
                        k: summary.get(k)
                        for k in (
                            "overallCondition",
                            "issuesDetected",
                            "locations",
                            "checkpointsAnalyzed",
                        )
                        if summary.get(k) is not None
                    }
                title = analysis.get("title")
                if isinstance(title, str) and title.strip():
                    memory["analysis_title"] = title.strip()

    if state.get("checkpoint_last_response_kind"):
        memory["last_response_kind"] = state.get("checkpoint_last_response_kind")
    return memory


_FRESH_CHECKPOINT_AREA_RE = re.compile(
    r"\b("
    r"kitchen|bathroom|bedroom|roof|basement|attic|yard|exterior|"
    r"living room|dining room|laundry|hvac|plumbing|electrical"
    r")\b",
    re.IGNORECASE,
)


def _checkpoint_areas_in_memory(state: Mapping[str, Any] | None) -> set[str]:
    memory = build_session_working_memory(state)
    if not memory:
        return set()
    areas: set[str] = set()
    summary = memory.get("checkpoint_summary")
    if isinstance(summary, dict):
        for loc in summary.get("locations") or []:
            if isinstance(loc, str) and loc.strip():
                areas.add(loc.strip().lower())
    return areas


def query_asks_area_outside_memory(
    user_query: str,
    state: Mapping[str, Any] | None,
) -> bool:
    """
    True when the user names a home area (kitchen, etc.) not covered by prior analysis.

    These turns should be answered from session memory ("we only analyzed the garage"),
    not by re-running checkpoint retrieval.
    """
    normalized = (user_query or "").strip().lower()
    match = _FRESH_CHECKPOINT_AREA_RE.search(normalized)
    if not match:
        return False
    memory_areas = _checkpoint_areas_in_memory(state)
    if not memory_areas:
        return False
    asked = match.group(1).lower().strip()
    for mem in memory_areas:
        if asked == mem or asked in mem or mem in asked:
            return False
    return True


def needs_fresh_checkpoint_retrieval(
    user_query: str,
    *,
    state: Mapping[str, Any] | None = None,
) -> bool:
    """True when the user asks about a new area or explicit checkpoint listing."""
    normalized = (user_query or "").strip().lower()
    if not normalized:
        return False
    if state is not None and query_references_known_provider(user_query, state):
        return False
    if _FRESH_CHECKPOINT_AREA_RE.search(normalized):
        if state is not None and query_asks_area_outside_memory(user_query, state):
            return False
        return True
    if re.search(
        r"\b(issues?|problems?|inspection|checkpoints?)\b.*\b(in|at|for)\b",
        normalized,
    ):
        return True
    return False


def should_block_checkpoint_agent_for_context_turn(
    *,
    user_query: str,
    state: Mapping[str, Any] | None,
    user_goal: str,
    query_mode: str,
) -> bool:
    """
    Block checkpoint_agent on context-only turns that should use session memory.

    Allows retrieval when the user asks about a new home area (e.g. kitchen).
    """
    if user_goal != "answer_from_context":
        return False
    if should_answer_provider_from_context(user_query, state=state):
        return True
    if needs_fresh_checkpoint_retrieval(user_query, state=state):
        return False
    memory = build_session_working_memory(state)
    if not memory:
        return False
    if query_mode != "interpret_session":
        return False
    if query_requests_entity_detail(user_query):
        return bool(query_references_known_provider(user_query, state))
    if memory.get("checkpoint_summary"):
        return True
    return False


def _format_provider_detail_value(val: Any) -> Optional[str]:
    if isinstance(val, str):
        text = val.strip()
        return text or None
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return str(val)
    return None


def provider_context_answer_is_substantive(answer: str) -> bool:
    """True when the canned provider answer includes at least one detail bullet."""
    if not (answer or "").strip():
        return False
    for line in answer.splitlines():
        stripped = line.strip()
        if stripped.startswith("- **") and ":" in stripped:
            return True
    return False


def format_provider_context_answer(
    user_query: str,
    state: Mapping[str, Any] | None,
) -> Optional[str]:
    """Markdown answer for a named-provider follow-up from session memory."""
    if not state:
        return None
    match = query_references_known_provider(user_query, state)
    if not match:
        return None
    details = extract_service_provider_details(state).get(match)
    if not details:
        providers = extract_known_service_providers(state)
        if match in providers:
            return (
                f"From your previous **Service results**, **{match}** was listed as "
                "a recommended local provider. I only have limited details saved for "
                "this provider. If you want, I can run a fresh provider search for "
                "updated listings."
            )
        return None
    lines = [
        "From your previous **Service results**:",
        f"Here is what we found earlier about **{match}**:\n",
    ]
    notes = details.get("notes")
    if isinstance(notes, str) and notes.strip():
        lines.append(f"- **Notes:** {notes.strip()}")
    services = details.get("services")
    if not (isinstance(services, list) and services):
        raw_service = details.get("service")
        if isinstance(raw_service, str) and raw_service.strip():
            services = [raw_service.strip()]
    if isinstance(services, list) and services:
        svc_text = ", ".join(str(s) for s in services[:8])
        lines.append(f"- **Services:** {svc_text}")
    for label, key in (
        ("Phone", "phone"),
        ("Contact", "contact_info"),
        ("Website", "website"),
        ("Location", "location"),
        ("Rating", "rating"),
    ):
        formatted = _format_provider_detail_value(details.get(key))
        if formatted:
            lines.append(f"- **{label}:** {formatted}")
    website = details.get("website")
    if isinstance(website, str) and website.strip():
        lines.append(
            f"\nYou can follow up with them directly via {website.strip()}."
        )
    body = "\n".join(lines)
    if provider_context_answer_is_substantive(body):
        return body
    return (
        f"From your previous **Service results**, **{match}** was listed as a "
        "recommended local provider. I only have limited details saved for this "
        "provider. If you want, I can run a fresh provider search for updated "
        "listings."
    )


# Generic words shared by many service listings — overlap alone is not distinctive.
_GENERIC_PROVIDER_TOKENS = frozenset(
    {
        "handyman",
        "services",
        "service",
        "repair",
        "repairs",
        "company",
        "professional",
        "local",
        "home",
        "door",
        "garage",
        "maintenance",
        "inspection",
        "mentioned",
    }
)

# Tokens dropped when matching user text to prior provider names (not routing keywords).
_PROVIDER_MATCH_STOPWORDS = frozenset(
    {
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "for",
        "in",
        "at",
        "on",
        "ca",
        "inc",
        "llc",
        "ltd",
    }
)

_ENTITY_TAIL_RE = re.compile(
    r"(?:"
    r"more\s+(?:details?|info(?:rmation)?)\s+(?:about|on)|"
    r"(?:tell|give)\s+me\s+more\s+(?:about|on)|"
    r"get\s+(?:me\s+)?(?:more\s+)?details?\s+(?:about|on)|"
    r"details?\s+on|more\s+on|"
    r"what\s+do\s+you\s+know\s+about|"
    r"learn\s+more\s+about|"
    r"info\s+on"
    r")\s+(.+)$",
    re.IGNORECASE,
)


def _provider_match_tokens(text: str) -> set[str]:
    """Meaningful tokens for fuzzy provider name ↔ query matching."""
    normalized = re.sub(r"[^\w\s&'-]", " ", (text or "").lower())
    tokens: set[str] = set()
    for raw in normalized.split():
        t = raw.strip("'&-")
        if len(t) < 2 or t in _PROVIDER_MATCH_STOPWORDS:
            continue
        tokens.add(t)
    return tokens


def _entity_span_from_query(user_query: str) -> str:
    """Likely business/entity phrase after a detail-seeking lead-in."""
    text = (user_query or "").strip()
    if not text:
        return ""
    match = _ENTITY_TAIL_RE.search(text)
    if match:
        tail = match.group(1).strip()
        # Drop trailing property-address clauses from expanded queries.
        tail = re.split(
            r"\s+for\s+(?:the\s+)?(?:property|home)\s+at\s+",
            tail,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0].strip()
        tail = re.split(r"\s+for\s+", tail, maxsplit=1, flags=re.IGNORECASE)[0].strip()
        return tail
    return text


def _provider_token_overlap_score(
    query_tokens: set[str], name_tokens: set[str]
) -> float:
    if not query_tokens or not name_tokens:
        return 0.0
    overlap = query_tokens & name_tokens
    if not overlap:
        return 0.0
    if query_tokens <= name_tokens or name_tokens <= query_tokens:
        return 1.0
    if len(overlap) >= 2:
        return len(overlap) / max(len(query_tokens), len(name_tokens))
    if len(overlap) == 1:
        token = next(iter(overlap))
        if len(token) >= 6:
            return 0.6
    return 0.0


def branches_mentioned_in_query(user_query: str) -> list[str]:
    """Explicit optional-branch mentions in the user text (e.g. 'coverage, diy, service')."""
    normalized = (user_query or "").lower()
    picked: list[str] = []
    for branch in OPTIONAL_CHECKPOINT_BRANCHES:
        if re.search(rf"\b{re.escape(branch)}\b", normalized):
            if branch not in picked:
                picked.append(branch)
    return picked


def _provider_name_substring_match(entity: str, providers: list[str]) -> Optional[str]:
    """Prefer longest provider whose name aligns with the entity phrase."""
    el = entity.lower().strip()
    if len(el) < 3:
        return None
    best: Optional[tuple[int, str]] = None
    for name in providers:
        nl = name.lower()
        if el in nl or nl in el:
            score = min(len(el), len(nl))
            if best is None or score > best[0]:
                best = (score, name)
    return best[1] if best else None


def _provider_distinctive_match_score(
    entity_tokens: set[str], name_tokens: set[str]
) -> float:
    """Score overlap on distinctive (non-generic) tokens."""
    distinctive = entity_tokens - _GENERIC_PROVIDER_TOKENS - _PROVIDER_MATCH_STOPWORDS
    if not distinctive:
        return 0.0
    overlap = distinctive & name_tokens
    if not overlap:
        return 0.0
    return len(overlap) / len(distinctive)


def query_references_known_provider(
    user_query: str,
    state: Mapping[str, Any] | None,
) -> Optional[str]:
    """Return the matched provider name if the query references a prior result."""
    providers = extract_known_service_providers(state)
    if not providers:
        return None
    q = (user_query or "").lower()
    entity = _entity_span_from_query(user_query)
    entity_l = entity.lower() if entity else ""
    query_tokens = _provider_match_tokens(user_query)
    entity_tokens = _provider_match_tokens(entity) if entity else set()

    if entity:
        substring = _provider_name_substring_match(entity, providers)
        if substring:
            return substring

    best_name: Optional[str] = None
    best_score = 0.0

    for name in providers:
        if len(name) < 4:
            continue
        nl = name.lower()
        if nl in q or (entity_l and nl in entity_l) or (entity_l and entity_l in nl):
            return name
        name_tokens = _provider_match_tokens(name)
        score = max(
            _provider_distinctive_match_score(query_tokens, name_tokens),
            _provider_distinctive_match_score(entity_tokens, name_tokens),
            _provider_token_overlap_score(query_tokens, name_tokens) * 0.5,
            _provider_token_overlap_score(entity_tokens, name_tokens) * 0.5,
        )
        if score > best_score:
            best_score = score
            best_name = name

    if best_name is not None and best_score >= 0.5:
        return best_name
    return None


def should_answer_provider_from_context(
    user_query: str,
    *,
    state: Mapping[str, Any] | None,
) -> bool:
    """
    Named-provider follow-up already in session — answer in prose, no service re-run.
    """
    if not prior_analysis_has_service_results(state):
        return False
    if not query_requests_entity_detail(user_query):
        return False
    return query_references_known_provider(user_query, state) is not None


def prior_analysis_has_service_results(state: Mapping[str, Any] | None) -> bool:
    return bool(extract_known_service_providers(state))


def infer_query_mode(
    *,
    user_goal: str,
    expanded_user_query: str,
    run_optional_agents: list[str],
    state: Mapping[str, Any] | None = None,
) -> QueryModeKind:
    """Map resolved turn to how optional branches should be queried."""
    if user_goal == "answer_from_context":
        return "interpret_session"

    expanded = (expanded_user_query or "").strip()
    if user_goal != "new_analysis" or not run_optional_agents:
        return "interpret_session"

    if query_references_known_provider(expanded, state) and query_requests_entity_detail(
        expanded
    ):
        return "branch_entity_search"

    if query_requests_entity_detail(expanded) and not _EXPLICIT_BRANCH_RE.search(
        expanded
    ):
        return "branch_entity_search"

    if _EXPLICIT_BRANCH_RE.search(expanded) or resolve_requested_optional_branches(
        expanded, state
    ):
        return "branch_explicit"

    return "branch_issue_search"


def build_session_working_memory(state: Mapping[str, Any] | None) -> dict[str, Any]:
    """
    Compact facts for executor follow-ups (not shown to the user).

    Merges durable snapshot with live session analysis stash.
    """
    if not state:
        return {}

    memory: dict[str, Any] = {}
    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        memory.update(snapshot)

    live = _build_session_working_memory_from_live(state)
    for key, value in live.items():
        if not value:
            continue
        if key == "service_providers_mentioned":
            names = set(memory.get(key) or [])
            if isinstance(value, list):
                names.update(value)
            memory[key] = sorted(names, key=str.lower)
        elif key == "service_provider_details" and isinstance(value, dict):
            merged = dict(memory.get(key) or {})
            merged.update(value)
            memory[key] = merged
        else:
            memory[key] = value

    return memory


def format_session_working_memory_block(state: Mapping[str, Any] | None) -> str:
    """Injected into executor instructions on context-only turns."""
    memory = build_session_working_memory(state)
    if not memory:
        return ""
    return (
        "[SESSION_WORKING_MEMORY]\n"
        f"{json.dumps(memory, indent=2)}\n"
        "[/SESSION_WORKING_MEMORY]\n"
        "Use this as ground truth for follow-up answers. Do not re-run tools unless "
        "the user asks for new external data or a branch not covered here."
    )
