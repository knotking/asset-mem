"""JSON schema and system prompt for resolve-turn LLM routing."""

from __future__ import annotations

from typing import Any

from .conversational_intent import DEFAULT_CAPABILITY_OPTIONS, OPTIONAL_CHECKPOINT_BRANCHES

RESOLVE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "intent": {
            "type": "string",
            "enum": ["greeting", "capabilities", "acknowledgment", "substantive"],
            "description": "Whether this turn needs tools or is casual chat.",
        },
        "route": {
            "type": "string",
            "enum": ["none", "checkpoint", "user_docs"],
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
        "intent",
        "route",
        "expanded_user_query",
        "retrieval_only",
        "run_optional_agents",
    ],
}

RESOLVE_SYSTEM = """You are the routing resolver for a property-care AI assistant.
Output JSON only.
Capability menu order (when user says "first one", "4th one", "how about cost", etc.):
0 checkpoints, 1 documents, 2 coverage, 3 diy, 4 service, 5 cost.
Intent:
- greeting: hi/hello/good morning only — no property task.
- capabilities: "what can you do", "what do you suggest", unsure what to ask — no tools.
- acknowledgment: thanks/got it/looks good ONLY when user does NOT ask for new work.
- substantive: any property task (checkpoints, docs, coverage, diy, service, cost, show notes, etc.).
User goals (checkpoint turns — post-processing enforces; set user_goal to match your intent):
- answer_from_context: interpretive follow-up, summary, advisory, show/list notes — answer from session; no new optional branches.
- new_analysis: user explicitly requests coverage/diy/service/cost analysis or "analyse checkpoints".
- replay_deliverable: user asks to see the full prior structured report again.
Critical:
- "yes do cost analysis", "how about cost?", "I mean coverage", "4th one" → substantive, user_goal=new_analysis.
- primary_agent is the client's active tab: "docs" → prefer user_docs for policy/lease/insurance/document questions;
  "checkpoint" → prefer checkpoint for inspections. checkpoint_ids alone do not override docs mode.
- ui_optional_agents and prior_full_checkpoint_analysis are hints only — never copy toggles into run_optional_agents.
- checkpoint_selection_changed=true means the user added/removed checkpoints since the last analysis — prefer user_goal=new_analysis and a fresh run_checkpoint_pipeline, not answer_from_context.
- Questions like overall condition, what's wrong, should I hire a professional → answer_from_context (even if toggles are on).
- More details / tell me about a **service provider already listed in prior analysis** → answer_from_context, retrieval_only=true, run_optional_agents=[]; do not set menu_index for provider names.
- route=none for casual intents OR general property questions that need no checkpoint/doc retrieval; checkpoint for checkpoints/branches; user_docs for document/policy.
- Expand indexical/menu picks into a concrete expanded_user_query for tools.
When property_analysis.branches_completed is non-empty (G3):
- Explain/clarify questions ("explain DIY steps", "why is cost high") → user_goal=answer_from_context, run_optional_agents=[].
- Only set new_analysis + branches when the user explicitly requests a fresh branch run or branches_completed lacks that branch.
- replay_deliverable when user wants the full report shown again (prose summary only; UI shows accordions).
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
