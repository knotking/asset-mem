"""Regex helper for detecting checkpoint inventory / status queries."""

from __future__ import annotations

import re

_CHECKPOINT_INVENTORY_LIST_RE = re.compile(
    r"\b("
    r"what checkpoints?|which checkpoints?|list (?:my )?checkpoints?|"
    r"how many checkpoints?"
    r")\b",
    re.IGNORECASE,
)

# Status phrasing must mention checkpoints — avoid hijacking area queries like
# "current status of the garage door" into inventory list mode.
_CHECKPOINT_INVENTORY_STATUS_RE = re.compile(
    r"\b("
    r"checkpoint status|"
    r"status of (?:my |the )?checkpoints?|"
    r"(?:their|the) current status of (?:my |the )?checkpoints?"
    r")\b",
    re.IGNORECASE,
)

_CHECKPOINT_INVENTORY_STATUS_COMBO_RE = re.compile(
    r"checkpoints?.{0,48}(?:current )?status|(?:current )?status.{0,48}checkpoints?",
    re.IGNORECASE,
)


def query_requests_checkpoint_inventory(user_query: str) -> bool:
    """True when the user asks to list checkpoints or report live status."""
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    if _CHECKPOINT_INVENTORY_LIST_RE.search(normalized):
        return True
    if _CHECKPOINT_INVENTORY_STATUS_RE.search(normalized):
        return True
    return bool(_CHECKPOINT_INVENTORY_STATUS_COMBO_RE.search(normalized))
