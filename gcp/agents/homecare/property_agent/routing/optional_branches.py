"""Public regex and constants for optional checkpoint analysis branches."""

from __future__ import annotations

import re

# Parallel checkpoint branches (not checkpoints/documents menu items).
OPTIONAL_CHECKPOINT_BRANCHES: tuple[str, ...] = ("coverage", "diy", "service", "cost")

MEAN_OPTIONAL_BRANCH_RE = re.compile(
    r"\b(?:i mean|actually|instead|just|only|want)\s+(?:the\s+)?"
    r"(?P<branch>coverage|diy|service|cost)\b",
    re.IGNORECASE,
)

STANDALONE_OPTIONAL_BRANCH_RE = re.compile(
    r"^(?P<branch>coverage|diy|service|cost)$",
    re.IGNORECASE,
)

HOW_ABOUT_OPTIONAL_BRANCH_RE = re.compile(
    r"\bhow about\s+(?:the\s+)?(?P<branch>coverage|diy|service|cost)\b",
    re.IGNORECASE,
)

EXPLICIT_BRANCH_RE = re.compile(
    r"\b("
    r"find (?:local )?(?:service )?providers?|"
    r"find (?:local )?contractors?|"
    r"recommend (?:local )?providers?|"
    r"run (?:a )?(?:cost|coverage|diy|service) (?:analysis|estimate)|"
    r"(?:yes,? )?(?:do|run) (?:the )?(?:cost|coverage|diy|service)"
    r")\b",
    re.IGNORECASE,
)
