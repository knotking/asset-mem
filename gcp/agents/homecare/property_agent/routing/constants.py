"""Homecare routing constants (not part of agent_framework)."""

USER_DOCS_PASSTHROUGH_STATE_KEY = "_executor_user_docs_passthrough"

RESOLVED_TURN_UI_CONTEXT_NOTE = (
    "primary_agent, checkpoint_ids, context_doc_uris, and UI optional toggles "
    "are context only — follow this block, not UI fields."
)

REPORT_MODE_EXECUTOR_NOTE = (
    "[REPORT_MODE]\n"
    "Answer ONLY from report_retrieval output for this turn. "
    "Summarize the exact section headings and issues in that text — do not invent "
    "roofing, HVAC, plumbing, electrical, foundation, or other systems unless they "
    "appear by name in the tool result. "
    "If the snapshot covers only specific areas (e.g. Vehicle - Exterior, Garage), "
    "do not present a whole-home inspection. "
    "If report_retrieval returns no usable content, say so briefly — do not invent "
    "report sections or systems. "
    "Do not offer DIY/service/cost branches unless the user explicitly asks.\n"
    "[/REPORT_MODE]"
)
