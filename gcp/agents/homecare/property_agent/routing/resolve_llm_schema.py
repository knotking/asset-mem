"""JSON schema and system prompt for resolve-turn LLM routing."""

from __future__ import annotations

from typing import Any

from .conversational_intent import DEFAULT_CAPABILITY_OPTIONS, OPTIONAL_CHECKPOINT_BRANCHES

_FOCUS_BRANCH_ENUM = [
    "checkpoint",
    "coverage",
    "diy",
    "service",
    "cost",
    "documents",
]

RESOLVE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "discourse_act": {
            "type": "string",
            "enum": [
                "greeting",
                "capabilities",
                "closure",
                "accept_offer",
                "explain_prior",
                "new_work",
                "replay_report",
                "provider_detail",
            ],
            "description": "Turn semantics — primary routing signal (NLU-first).",
        },
        "focus_branch": {
            "anyOf": [
                {"type": "null"},
                {"type": "string", "enum": _FOCUS_BRANCH_ENUM},
            ],
            "description": "Which prior branch to ground explain_prior (e.g. cost for pro pricing questions).",
        },
        "intent": {
            "type": "string",
            "enum": ["greeting", "capabilities", "acknowledgment", "substantive"],
            "description": "Legacy intent; derive from discourse_act when possible.",
        },
        "route": {
            "type": "string",
            "enum": ["none", "checkpoint", "user_docs", "report"],
        },
        "expanded_user_query": {
            "type": "string",
            "description": "Full user request for tools; for casual turns echo user_query.",
        },
        "retrieval_only": {
            "type": "boolean",
            "description": "True when only checkpoint/docs retrieval, no optional analysis.",
        },
        "run_optional_agents": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": list(OPTIONAL_CHECKPOINT_BRANCHES),
            },
            "description": "Hint only — post-processing derives branches from user text, not UI toggles.",
        },
        "user_goal": {
            "type": "string",
            "enum": ["answer_from_context", "new_analysis", "replay_deliverable"],
            "description": "answer_from_context | new_analysis | replay_deliverable",
        },
        "menu_index": {
            "type": ["integer", "null"],
            "description": "0-based index into last_capability_menu when user picked from list.",
        },
        "capability_key": {
            "anyOf": [
                {"type": "null"},
                {
                    "type": "string",
                    "enum": list(DEFAULT_CAPABILITY_OPTIONS),
                },
            ],
        },
    },
    "required": [
        "discourse_act",
        "intent",
        "route",
        "expanded_user_query",
        "retrieval_only",
        "run_optional_agents",
    ],
}

RESOLVE_SYSTEM = """You are the routing resolver for a property-care AI assistant.
Output JSON only. discourse_act is the primary signal for turn meaning.

discourse_act (required):
- greeting: hi/hello only — no property task.
- capabilities: what can you do / what do you suggest — no tools.
- closure: thanks / that's helpful / got it — user closes topic; NOT accept_offer.
- accept_offer: short yes/ok/sure when assistant offered an action OR pending_user_action is set.
- explain_prior: clarify/compare existing analysis (why is pro expensive, explain DIY steps) — NO new branches.
- new_work: fresh retrieval or optional branch run (find providers, run cost analysis, how about cost).
- replay_report: show full prior structured report again.
- provider_detail: more about a service provider already listed in prior analysis.

focus_branch (optional, for explain_prior):
- cost: pro pricing vs DIY, why expensive, cost comparison — even if user says "professional".
- diy: steps, how to fix yourself.
- service: questions about listed providers (not new provider search).
- coverage / checkpoint / documents when clearly about that section.
- null only if genuinely ambiguous.

Capability menu order (ordinal picks — deterministic):
0 checkpoints, 1 documents, 2 coverage, 3 diy, 4 service, 5 cost.

Mapping discourse_act → fields:
- greeting/capabilities/closure → route=none, run_optional_agents=[], retrieval_only=true.
- explain_prior → user_goal=answer_from_context, run_optional_agents=[], retrieval_only=true, route=checkpoint or none.
- provider_detail → user_goal=answer_from_context, run_optional_agents=[], retrieval_only=true.
- accept_offer → substantive; expand pending/offer into expanded_user_query; set branches if offered.
- new_work → user_goal=new_analysis when branches requested; else retrieval as needed.
- replay_report → user_goal=replay_deliverable.

Critical NLU rules:
- "why is professional so expensive" after cost/DIY → explain_prior, focus_branch=cost, NOT service, run_optional_agents=[].
- "professional" in advisory/compare questions ≠ service branch unless user asks for new providers.
- accept_offer: "yes", "ok", "sure" + pending_user_action or assistant question in recent_dialogue.
- closure vs accept_offer: thanks/that's helpful = closure; bare yes after offer = accept_offer.
- primary_agent tab hint: docs → user_docs for policy/lease; checkpoint → checkpoint for inspections; report → report for saved PDF snapshots (requires report_ids).
- Never copy ui_optional_agents into run_optional_agents.
- checkpoint_selection_changed=true → prefer new_work / new_analysis, not explain_prior.
- analysis_digest shows branches_completed — do not re-run completed branches for explain_prior.

Intent (legacy, align with discourse_act):
- greeting, capabilities, acknowledgment (closure maps to acknowledgment intent).

When property_analysis.branches_completed is non-empty:
- explain_prior for clarify questions; new_work only for explicit fresh branch requests.

Long sessions:
- conversation_summary in ui_context summarizes older turns; use with recent_dialogue.
- chat_intent client hint biases routing but discourse_act wins.
"""

CHECKPOINT_QUERY_HINTS = (
    "checkpoint",
    "inspection",
    "inspection note",
    "show me the latest",
    "what changed",
    "analyse my checkpoints",
    "analyze my checkpoints",
)
