"""Search query resolution for checkpoint optional branches."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from google.adk.tools import ToolContext

from .input_schema import CheckpointAnalysisInput

logger = logging.getLogger(__name__)

CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY = "checkpoint_retrieval_search_query"


def _text_from_user_content(content: Any) -> str:
    if content is None:
        return ""
    parts = getattr(content, "parts", None) or []
    chunks: list[str] = []
    for part in parts:
        t = getattr(part, "text", None)
        if isinstance(t, str) and t.strip():
            chunks.append(t.strip())
    return "\n".join(chunks).strip()


def _search_query_from_analysis_json(text: str) -> str:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return ""
    if not isinstance(data, dict):
        return ""
    return (data.get("search_query") or "").strip()


def resolve_effective_search_query(
    search_query: Optional[str],
    tool_context: Optional[ToolContext],
) -> str:
    """Tool arg first, then session state (retrieval stash or workflow input)."""
    sq = (search_query or "").strip()
    if sq:
        return sq
    if tool_context is None:
        return ""
    st = tool_context.state.get(CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY)
    if isinstance(st, str) and st.strip():
        return st.strip()
    return ""


def _strip_checkpoint_title_noise(text: str) -> str:
    """Remove checkpoint titles, dates, and times from retrieval blobs before search seeding."""
    s = (text or "").strip()
    if not s:
        return ""
    s = re.sub(r"\r\n?", " ", s)
    # Narrative: Checkpoint 'Checkpoint • May 11 • 9:10 PM' (Garage):
    s = re.sub(r"Checkpoint\s+'[^']*'(?:\s*\([^)]*\))?\s*:\s*", " ", s, flags=re.I)
    s = re.sub(r'Checkpoint\s+"[^"]*"(?:\s*\([^)]*\))?\s*:\s*', " ", s, flags=re.I)
    s = re.sub(r"Checkpoint\s+Name\s*:\s*[^,\n]+", " ", s, flags=re.I)
    # Stray suffix if a prior pipeline merged DIY search text into checkpoint prose
    s = re.sub(r"\bDIY\s+tutorial\s+how\s+to\s+fix\b", " ", s, flags=re.I)
    s = re.sub(r"•+", " ", s)
    s = re.sub(r"\b\d{1,2}:\d{2}\s*(?:AM|PM)\b", " ", s, flags=re.I)
    s = re.sub(
        r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
        r"Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+"
        r"\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b",
        " ",
        s,
        flags=re.I,
    )
    s = re.sub(r"\b\d{4}-\d{2}-\d{2}\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def optional_branch_search_user_query(
    checkpoint_results: str, *, max_chars: int = 280
) -> str:
    """
    Short plain-text query for optional parallel agents (DIY / shopping / YouTube paths).

    Strips checkpoint names and timestamps, then reuses DIY checkpoint-field compaction
    when structured labels (Summary / Issues / Location) are present.
    """
    from ..diy_agent.orchestrator import _compact_diy_search_seed

    cleaned = _strip_checkpoint_title_noise(checkpoint_results)
    seed = _compact_diy_search_seed(cleaned)
    out = (seed or cleaned).strip()
    out = re.sub(r"\s+", " ", out)
    if len(out) > max_chars:
        cut = out[: max_chars + 1]
        out = cut.rsplit(" ", 1)[0].strip() if " " in cut else cut[:max_chars].strip()
    if not out:
        out = cleaned[:max_chars].strip() if cleaned else ""
    return out


def _truncate_query(text: str, *, max_chars: int) -> str:
    out = re.sub(r"\s+", " ", (text or "").strip()).strip()
    if len(out) > max_chars:
        cut = out[: max_chars + 1]
        out = cut.rsplit(" ", 1)[0].strip() if " " in cut else cut[:max_chars].strip()
    return out


def resolve_branch_search_user_query(
    search_query: Optional[str],
    checkpoint_results: str,
    *,
    max_chars: int = 400,
) -> str:
    """Use caller-provided search_query when set; otherwise compact checkpoint_results."""
    raw = (search_query or "").strip()
    if raw:
        out = _truncate_query(raw, max_chars=max_chars)
    else:
        out = optional_branch_search_user_query(checkpoint_results, max_chars=max_chars)
    return out


def resolve_optional_branch_user_query(
    *,
    turn_query: str,
    search_query: Optional[str],
    checkpoint_results: str,
    query_mode: str = "branch_issue_search",
    max_chars: int = 400,
) -> str:
    """
    Query passed to optional branches as DocsInput.user_query.

    Entity/explicit follow-ups use the user's turn text; generic analysis uses the
    compact checkpoint issue stem (unless search_query was stashed from retrieval).
    """
    turn = (turn_query or "").strip()
    if query_mode in ("branch_entity_search", "branch_explicit") and turn:
        return _truncate_query(turn, max_chars=max_chars)
    return resolve_branch_search_user_query(
        search_query, checkpoint_results, max_chars=max_chars
    )


def _stash_retrieval_search_query(
    tool_ctx: ToolContext, inp: CheckpointAnalysisInput
) -> None:
    sq = (inp.search_query or "").strip()
    if not sq:
        text = _text_from_user_content(tool_ctx.user_content)
        sq = _search_query_from_analysis_json(text)
    if sq:
        tool_ctx.state[CHECKPOINT_RETRIEVAL_SEARCH_QUERY_STATE_KEY] = sq
        logger.debug(
            "checkpoint optional parallel: stashed search_query len=%d",
            len(sq),
        )
