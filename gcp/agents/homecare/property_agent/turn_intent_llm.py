"""LLM classifier for checkpoint follow-up intent (explain vs re-run branches)."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Mapping, Optional

from google.genai import types

from .conversational_intent import (
    OPTIONAL_CHECKPOINT_BRANCHES,
    prior_checkpoint_analysis_in_session,
    query_requests_full_analysis_replay,
    resolve_explicit_optional_branches,
)
from .model_config import GLOBAL_GEMINI_MODEL
from .query_mode import (
    prior_analysis_branches_completed,
    query_looks_like_explain_follow_up,
    query_requests_fresh_external_data,
)

logger = logging.getLogger(__name__)

TurnIntentResult = dict[str, Any]

_INTENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "user_goal": {
            "type": "string",
            "enum": ["answer_from_context", "new_analysis", "replay_deliverable"],
        },
        "run_optional_agents": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": list(OPTIONAL_CHECKPOINT_BRANCHES),
            },
        },
        "reason": {
            "type": "string",
            "description": "One short sentence for logs.",
        },
    },
    "required": ["user_goal", "run_optional_agents", "reason"],
}

_INTENT_SYSTEM = """You classify a checkpoint chat follow-up when prior analysis already exists.

Output JSON only.

user_goal:
- answer_from_context: explain, summarize, clarify, or advise using prior analysis (e.g. "explain DIY steps", "why is professional cost high").
- new_analysis: user explicitly wants to RUN/FETCH new branch work (e.g. "run cost analysis", "find more service providers", "yes do DIY analysis", "analyse checkpoints for coverage and diy").
- replay_deliverable: user wants the full prior structured report shown again.

run_optional_agents:
- Empty for answer_from_context and replay_deliverable.
- For new_analysis, list only branches that must be executed now (coverage, diy, service, cost).

Rules:
- Mentioning "DIY", "cost", "coverage", or "service" in an explain/clarify question is NOT enough for new_analysis.
- "find more/new/additional providers" → new_analysis with service only.
- "how about cost?" / "I mean coverage" / menu picks → new_analysis for that branch.
- Default to answer_from_context when prior analysis likely already contains the answer.
"""


def turn_intent_llm_disabled() -> bool:
    raw = (os.getenv("TURN_INTENT_LLM_DISABLED") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _json_from_response(response: Any) -> Optional[dict[str, Any]]:
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, dict):
        return parsed
    text = (getattr(response, "text", None) or "").strip()
    if not text:
        return None
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _intent_context_blob(state: Mapping[str, Any], user_query: str) -> dict[str, Any]:
    completed = sorted(prior_analysis_branches_completed(state))
    return {
        "user_query": user_query,
        "prior_full_checkpoint_analysis": prior_checkpoint_analysis_in_session(state),
        "branches_completed_in_prior_analysis": completed,
        "checkpoint_ids_count": len(state.get("checkpoint_ids") or []),
        "ui_optional_agents": state.get("checkpoint_optional_agents")
        or state.get("_checkpoint_optional_agents_ui"),
    }


def call_turn_intent_llm(
    *,
    user_query: str,
    expanded_user_query: str,
    state: Mapping[str, Any],
) -> Optional[TurnIntentResult]:
    """Single flash JSON call; None on failure or when disabled."""
    if turn_intent_llm_disabled():
        return None
    model = getattr(GLOBAL_GEMINI_MODEL, "model", None) or "gemini-3.1-flash-lite"
    blob = json.dumps(
        {
            **_intent_context_blob(state, user_query),
            "expanded_user_query": expanded_user_query,
        },
        indent=2,
    )
    prompt = f"{_INTENT_SYSTEM}\n\nINPUT_JSON:\n{blob}\n"
    t0 = time.monotonic()
    try:
        client = GLOBAL_GEMINI_MODEL.api_client
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=256,
                response_mime_type="application/json",
                response_json_schema=_INTENT_SCHEMA,
            ),
        )
    except Exception:
        logger.exception("turn_intent_llm: generate_content failed")
        return None
    raw = _json_from_response(response)
    if not raw:
        logger.warning(
            "turn_intent_llm: empty JSON (elapsed_ms=%.0f)",
            (time.monotonic() - t0) * 1000,
        )
        return None
    goal = raw.get("user_goal")
    if goal not in ("answer_from_context", "new_analysis", "replay_deliverable"):
        return None
    branches = [
        str(b)
        for b in (raw.get("run_optional_agents") or [])
        if str(b) in OPTIONAL_CHECKPOINT_BRANCHES
    ]
    result: TurnIntentResult = {
        "user_goal": goal,
        "run_optional_agents": branches,
        "reason": str(raw.get("reason") or "")[:200],
        "source": "llm",
    }
    logger.info(
        "turn_intent_llm goal=%s branches=%r reason=%r elapsed_ms=%.0f",
        goal,
        branches,
        result["reason"][:80],
        (time.monotonic() - t0) * 1000,
    )
    return result


def _deterministic_turn_intent(
    *,
    user_query: str,
    expanded_user_query: str,
    state: Mapping[str, Any],
) -> TurnIntentResult:
    """Fallback when intent LLM is off or fails."""
    q = (user_query or "").strip()
    expanded = (expanded_user_query or q).strip()
    if query_requests_full_analysis_replay(expanded) or query_requests_full_analysis_replay(q):
        return {
            "user_goal": "replay_deliverable",
            "run_optional_agents": [],
            "reason": "explicit full report replay",
            "source": "deterministic",
        }
    if query_requests_fresh_external_data(q) or query_requests_fresh_external_data(
        expanded
    ):
        return {
            "user_goal": "new_analysis",
            "run_optional_agents": ["service"],
            "reason": "fresh provider search requested",
            "source": "deterministic",
        }
    explicit = resolve_explicit_optional_branches(expanded, state)
    if not explicit:
        explicit = resolve_explicit_optional_branches(q, state)
    if explicit:
        return {
            "user_goal": "new_analysis",
            "run_optional_agents": explicit,
            "reason": "explicit branch or menu pick",
            "source": "deterministic",
        }
    if query_looks_like_explain_follow_up(q) or query_looks_like_explain_follow_up(
        expanded
    ):
        return {
            "user_goal": "answer_from_context",
            "run_optional_agents": [],
            "reason": "explain/clarify follow-up on prior analysis",
            "source": "deterministic",
        }
    return {
        "user_goal": "answer_from_context",
        "run_optional_agents": [],
        "reason": "default follow-up from prior analysis",
        "source": "deterministic",
    }


def classify_checkpoint_follow_up_intent(
    *,
    user_query: str,
    expanded_user_query: str,
    state: Mapping[str, Any],
) -> TurnIntentResult:
    """LLM intent with deterministic guardrails (used when prior analysis exists)."""
    llm = call_turn_intent_llm(
        user_query=user_query,
        expanded_user_query=expanded_user_query,
        state=state,
    )
    intent = llm or _deterministic_turn_intent(
        user_query=user_query,
        expanded_user_query=expanded_user_query,
        state=state,
    )
    return apply_turn_intent_guardrails(
        intent,
        user_query=user_query,
        expanded_user_query=expanded_user_query,
        state=state,
    )


def apply_turn_intent_guardrails(
    intent: TurnIntentResult,
    *,
    user_query: str,
    expanded_user_query: str,
    state: Mapping[str, Any],
) -> TurnIntentResult:
    """Hard policy overrides on top of LLM/deterministic intent."""
    q = (user_query or "").strip()
    expanded = (expanded_user_query or q).strip()
    out = dict(intent)
    branches = list(out.get("run_optional_agents") or [])

    if query_requests_full_analysis_replay(expanded) or query_requests_full_analysis_replay(
        q
    ):
        out["user_goal"] = "replay_deliverable"
        out["run_optional_agents"] = []
        return out

    if query_requests_fresh_external_data(q) or query_requests_fresh_external_data(
        expanded
    ):
        out["user_goal"] = "new_analysis"
        if "service" not in branches:
            branches = ["service"]
        out["run_optional_agents"] = branches
        return out

    completed = prior_analysis_branches_completed(state)
    explicit = resolve_explicit_optional_branches(expanded, state)
    if not explicit:
        explicit = resolve_explicit_optional_branches(q, state)
    explicit_pick = bool(explicit) and set(branches) <= set(explicit)

    if out.get("user_goal") == "new_analysis" and branches:
        if (
            query_looks_like_explain_follow_up(q)
            or query_looks_like_explain_follow_up(expanded)
        ) and all(b in completed for b in branches):
            out["user_goal"] = "answer_from_context"
            out["run_optional_agents"] = []
            out["reason"] = (
                (out.get("reason") or "")
                + " [guardrail: explain follow-up, branches in prior analysis]"
            ).strip()
            return out
        # Drop branches already completed unless explicit menu pick or fresh run
        if (
            not explicit_pick
            and not query_requests_fresh_external_data(q)
            and not query_requests_fresh_external_data(expanded)
        ):
            needed = [b for b in branches if b not in completed]
            if not needed:
                out["user_goal"] = "answer_from_context"
                out["run_optional_agents"] = []
                out["reason"] = (
                    (out.get("reason") or "")
                    + " [guardrail: all requested branches already completed]"
                ).strip()
            else:
                out["run_optional_agents"] = needed
    return out


def intent_to_checkpoint_payload(
    intent: TurnIntentResult,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Map classified intent onto resolver payload fields."""
    goal = intent.get("user_goal", "answer_from_context")
    branches = list(intent.get("run_optional_agents") or [])
    if goal == "replay_deliverable":
        return {
            **payload,
            "retrieval_only": False,
            "run_optional_agents": [],
            "user_goal": "replay_deliverable",
        }
    if goal == "new_analysis" and branches:
        return {
            **payload,
            "retrieval_only": False,
            "run_optional_agents": branches,
            "user_goal": "new_analysis",
        }
    return {
        **payload,
        "retrieval_only": True,
        "run_optional_agents": [],
        "user_goal": "answer_from_context",
    }
