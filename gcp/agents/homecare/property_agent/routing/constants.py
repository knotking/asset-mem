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
    "Saved report snapshots are frozen condition summaries only — they do NOT include "
    "cost estimates, DIY steps, service providers, or coverage analysis. "
    "Never call analyze_checkpoints and never offer to run cost/DIY/service/coverage "
    "analysis from report chat, even when the user asks for those details. "
    "Instead, state what the snapshot contains and that repair costs or branch analysis "
    "are not part of this saved report.\n"
    "[/REPORT_MODE]"
)

REPORT_MODE_CHECKPOINT_PIPELINE_BLOCKED = (
    "Skipped: report mode — saved report snapshots contain condition findings only, "
    "not cost/DIY/service/coverage analysis. Do not call analyze_checkpoints. "
    "Answer in markdown from the report snapshot or prior report summary; explain that "
    "branch analysis is outside report chat."
)
