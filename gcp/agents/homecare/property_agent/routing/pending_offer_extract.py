"""Micro-LLM extraction of pending user actions from assistant replies."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from google.genai import types

from ..model_config import global_flash_lite_client_and_model
from .optional_branches import OPTIONAL_CHECKPOINT_BRANCHES
from .pending_user_action import PendingUserAction, set_pending_user_action

logger = logging.getLogger(__name__)


def pending_offer_extract_enabled() -> bool:
    """Run after-agent offer extraction for accept-offer fast-path."""
    return True

_EXTRACT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "has_offer": {"type": "boolean"},
        "kind": {
            "type": "string",
            "enum": ["run_branch", "pick_capability", "confirm_action", "none"],
        },
        "expanded_user_query": {"type": "string"},
        "run_optional_agents": {
            "type": "array",
            "items": {"type": "string", "enum": list(OPTIONAL_CHECKPOINT_BRANCHES)},
        },
        "capability_key": {
            "anyOf": [
                {"type": "null"},
                {
                    "type": "string",
                    "enum": [
                        "checkpoints",
                        "documents",
                        "coverage",
                        "diy",
                        "service",
                        "cost",
                    ],
                },
            ],
        },
        "offered_summary": {"type": "string"},
    },
    "required": ["has_offer", "kind", "expanded_user_query", "run_optional_agents"],
}

_EXTRACT_SYSTEM = """You extract whether the assistant's last message offers the user a concrete next action.
Output JSON only.
has_offer=true when the assistant asks the user to confirm running analysis, picking a menu item, or doing a specific branch (cost/diy/service/coverage).
kind=run_branch when offering optional checkpoint branches; pick_capability when offering the capability menu; confirm_action for other yes/no confirmations; none when no offer.
expanded_user_query: concrete task if user says yes (e.g. "Run cost analysis for the garage door issue").
run_optional_agents: subset of coverage,diy,service,cost when kind=run_branch; else [].
Never invent branches the assistant did not offer."""


def _json_from_response(response: Any) -> Optional[dict[str, Any]]:
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, dict):
        return parsed
    primary = (getattr(response, "text", None) or "").strip()
    if primary.startswith("```"):
        primary = re.sub(r"^```(?:json)?\s*", "", primary, flags=re.I)
        primary = re.sub(r"\s*```\s*$", "", primary).strip()
    try:
        data = json.loads(primary)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def extract_pending_offer_from_text(
    assistant_text: str,
    *,
    user_query: str = "",
) -> Optional[PendingUserAction]:
    text = (assistant_text or "").strip()
    if not text or "?" not in text:
        return None
    prompt = (
        f"{_EXTRACT_SYSTEM}\n\n"
        f"USER_QUERY_BEFORE_REPLY: {user_query[:200]}\n\n"
        f"ASSISTANT_REPLY:\n{text[:2000]}\n"
    )
    client, model = global_flash_lite_client_and_model()
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=256,
                response_mime_type="application/json",
                response_json_schema=_EXTRACT_SCHEMA,
            ),
        )
    except Exception:
        logger.debug("pending_offer_extract: generate_content failed", exc_info=True)
        return None
    raw = _json_from_response(response)
    if not raw or not raw.get("has_offer"):
        return None
    kind = raw.get("kind")
    if kind not in ("run_branch", "pick_capability", "confirm_action"):
        return None
    branches = [str(b) for b in (raw.get("run_optional_agents") or []) if b in OPTIONAL_CHECKPOINT_BRANCHES]
    expanded = str(raw.get("expanded_user_query") or "").strip()
    if not expanded and kind == "run_branch" and branches:
        expanded = f"Run {', '.join(branches)} analysis."
    if not expanded:
        expanded = "Proceed with the offered action."
    return PendingUserAction(
        kind=kind,
        expanded_user_query=expanded,
        run_optional_agents=branches,
        capability_key=raw.get("capability_key"),
        offered_summary=str(raw.get("offered_summary") or "")[:300] or None,
    )


def _heuristic_pending_from_offer(assistant_text: str) -> Optional[PendingUserAction]:
    """Fallback when micro-LLM extract misses a trailing offer question."""
    text = (assistant_text or "").strip()
    if not text or "?" not in text:
        return None
    tail = text[-500:].lower()
    branches: list[str] = []
    for branch in OPTIONAL_CHECKPOINT_BRANCHES:
        if branch in tail or f"**{branch}**" in text[-500:].lower():
            branches.append(branch)
    if not branches:
        if "provider" in tail or "shop" in tail or "professional" in tail:
            branches.append("service")
        if "diy" in tail or "step" in tail or "material" in tail:
            if "diy" not in branches:
                branches.append("diy")
    if not branches:
        return None
    expanded = f"Run {', '.join(branches)} analysis."
    return PendingUserAction(
        kind="run_branch",
        expanded_user_query=expanded,
        run_optional_agents=branches,
    )


def maybe_set_pending_from_assistant_reply(
    state: Any,
    *,
    assistant_text: str,
    user_query: str = "",
) -> None:
    pending = extract_pending_offer_from_text(assistant_text, user_query=user_query)
    source = "llm"
    if pending is None:
        pending = _heuristic_pending_from_offer(assistant_text)
        source = "heuristic"
    if pending is not None:
        set_pending_user_action(state, pending)
        logger.info(
            "pending_offer_extract: source=%s kind=%s branches=%r",
            source,
            pending.kind,
            pending.run_optional_agents,
        )
