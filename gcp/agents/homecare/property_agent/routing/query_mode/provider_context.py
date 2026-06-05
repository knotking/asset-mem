"""Service provider context matching and formatted answers."""

from __future__ import annotations

import re
from typing import Any, Optional

from property_agent.routing.schema import SessionStateLike

from property_agent.routing.optional_branches import OPTIONAL_CHECKPOINT_BRANCHES

from .session_memory import (
    extract_known_service_providers,
    extract_service_provider_details,
)

def _format_provider_detail_value(val: Any) -> Optional[str]:
    if isinstance(val, str):
        text = val.strip()
        return text or None
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return str(val)
    return None


def provider_context_answer_is_substantive(answer: str) -> bool:
    if not (answer or "").strip():
        return False
    for line in answer.splitlines():
        stripped = line.strip()
        if stripped.startswith("- **") and ":" in stripped:
            return True
    return False


def format_provider_context_answer(user_query: str, state: SessionStateLike | None) -> Optional[str]:
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
    lines = ["From your previous **Service results**:", f"Here is what we found earlier about **{match}**:\n"]
    notes = details.get("notes")
    if isinstance(notes, str) and notes.strip():
        lines.append(f"- **Notes:** {notes.strip()}")
    services = details.get("services")
    if not (isinstance(services, list) and services):
        raw_service = details.get("service")
        if isinstance(raw_service, str) and raw_service.strip():
            services = [raw_service.strip()]
    if isinstance(services, list) and services:
        lines.append(f"- **Services:** {', '.join(str(s) for s in services[:8])}")
    for label, key in (("Phone", "phone"), ("Contact", "contact_info"), ("Website", "website"), ("Location", "location")):
        formatted = _format_provider_detail_value(details.get(key))
        if formatted:
            lines.append(f"- **{label}:** {formatted}")
    rating = details.get("rating")
    if rating is None:
        rating = details.get("ratings")
    rating_text = _format_provider_detail_value(rating)
    if rating_text:
        lines.append(f"- **Rating:** {rating_text}")
    reviews_text = _format_provider_detail_value(details.get("reviews"))
    if reviews_text:
        lines.append(f"- **Reviews:** {reviews_text}")
    website = details.get("website")
    if isinstance(website, str) and website.strip():
        lines.append(f"\nYou can follow up with them directly via {website.strip()}.")
    body = "\n".join(lines)
    if provider_context_answer_is_substantive(body):
        return body
    return (
        f"From your previous **Service results**, **{match}** was listed as a "
        "recommended local provider. I only have limited details saved for this "
        "provider. If you want, I can run a fresh provider search for updated "
        "listings."
    )
_GENERIC_PROVIDER_TOKENS = frozenset({"handyman", "services", "service", "repair", "repairs", "company", "professional", "local", "home", "door", "garage", "maintenance", "inspection", "mentioned"})
_PROVIDER_MATCH_STOPWORDS = frozenset({"the", "a", "an", "and", "or", "of", "for", "in", "at", "on", "ca", "inc", "llc", "ltd"})
_ENTITY_TAIL_RE = re.compile(r"(?:more\s+(?:details?|info(?:rmation)?)\s+(?:about|on)|(?:tell|give)\s+me\s+more\s+(?:about|on)|get\s+(?:me\s+)?(?:more\s+)?details?\s+(?:about|on)|details?\s+on|more\s+on|what\s+do\s+you\s+know\s+about|learn\s+more\s+about|info\s+on)\s+(.+)$", re.IGNORECASE)


def _provider_match_tokens(text: str) -> set[str]:
    normalized = re.sub(r"[^\w\s&'-]", " ", (text or "").lower())
    tokens: set[str] = set()
    for raw in normalized.split():
        t = raw.strip("'&-")
        if len(t) < 2 or t in _PROVIDER_MATCH_STOPWORDS:
            continue
        tokens.add(t)
    return tokens


def _entity_span_from_query(user_query: str) -> str:
    text = (user_query or "").strip()
    if not text:
        return ""
    match = _ENTITY_TAIL_RE.search(text)
    if match:
        tail = match.group(1).strip()
        tail = re.split(r"\s+for\s+(?:the\s+)?(?:property|home)\s+at\s+", tail, maxsplit=1, flags=re.IGNORECASE)[0].strip()
        tail = re.split(r"\s+for\s+", tail, maxsplit=1, flags=re.IGNORECASE)[0].strip()
        return tail
    return text


def _provider_token_overlap_score(query_tokens: set[str], name_tokens: set[str]) -> float:
    if not query_tokens or not name_tokens:
        return 0.0
    overlap = query_tokens & name_tokens
    if not overlap:
        return 0.0
    if query_tokens <= name_tokens or name_tokens <= query_tokens:
        return 1.0
    if len(overlap) >= 2:
        return len(overlap) / max(len(query_tokens), len(name_tokens))
    if len(overlap) == 1 and len(next(iter(overlap))) >= 6:
        return 0.6
    return 0.0


def branches_mentioned_in_query(user_query: str) -> list[str]:
    normalized = (user_query or "").lower()
    picked: list[str] = []
    for branch in OPTIONAL_CHECKPOINT_BRANCHES:
        if re.search(rf"\b{re.escape(branch)}\b", normalized):
            if branch not in picked:
                picked.append(branch)
    return picked


def _provider_name_substring_match(entity: str, providers: list[str]) -> Optional[str]:
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


def _provider_distinctive_match_score(entity_tokens: set[str], name_tokens: set[str]) -> float:
    distinctive = entity_tokens - _GENERIC_PROVIDER_TOKENS - _PROVIDER_MATCH_STOPWORDS
    if not distinctive:
        return 0.0
    overlap = distinctive & name_tokens
    if not overlap:
        return 0.0
    return len(overlap) / len(distinctive)


def query_references_known_provider(user_query: str, state: SessionStateLike | None) -> Optional[str]:
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


def prior_analysis_has_service_results(state: SessionStateLike | None) -> bool:
    return bool(extract_known_service_providers(state))
