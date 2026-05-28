"""Branch-specific search intents derived from checkpoint retrieval."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


def _clean_phrase(text: str, *, max_chars: int = 120) -> str:
    q = re.sub(r"\s+", " ", (text or "").strip())
    if len(q) <= max_chars:
        return q
    cut = q[: max_chars + 1]
    if " " in cut:
        return cut.rsplit(" ", 1)[0].strip()
    return q[:max_chars].strip()


_YOUTUBE_QUERY_FILLER = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "on",
        "in",
        "at",
        "to",
        "for",
        "of",
        "with",
        "near",
        "residential",
        "significant",
        "minor",
        "major",
        "surface",
        "localized",
        "local",
    }
)
_YOUTUBE_SYMPTOM_TOKENS = frozenset(
    {
        "chipping",
        "chips",
        "chip",
        "scratches",
        "scratch",
        "scuff",
        "scuffs",
        "ding",
        "dents",
        "dent",
        "crack",
        "cracks",
        "peeling",
        "fade",
        "faded",
    }
)
_YOUTUBE_ACTION_TOKENS = frozenset(
    {"repair", "fix", "replace", "install", "refinish", "patch", "touch", "up"}
)


def _reorder_youtube_tokens(tokens: List[str]) -> List[str]:
    """Prefer asset-first phrasing (e.g. ``garage door paint repair``)."""
    if not tokens:
        return tokens
    actions = [t for t in tokens if t in _YOUTUBE_ACTION_TOKENS]
    rest = [t for t in tokens if t not in _YOUTUBE_ACTION_TOKENS]

    if "garage" in rest and "door" in rest:
        rest = [t for t in rest if t not in ("garage", "door")]
        return ["garage", "door", *rest, *actions]

    vehicle_markers = ("car", "auto", "automotive", "vehicle")
    vehicle = next((m for m in vehicle_markers if m in rest), None)
    if vehicle:
        rest = [t for t in rest if t not in vehicle_markers]
        return [vehicle, *rest, *actions]

    if actions:
        non_actions = [t for t in tokens if t not in _YOUTUBE_ACTION_TOKENS]
        return [*non_actions, *actions]
    return tokens


def compact_youtube_search_query(
    text: str,
    *,
    max_words: int = 6,
    max_chars: int = 80,
) -> str:
    """
    Normalize a YouTube query into a short keyword phrase (3–6 words).

    Strips how-to/tutorial phrasing, drops filler/symptom tokens, and ensures an
    action word (``repair``, ``fix``, etc.) when appropriate.
    """
    q = re.sub(r"\s+", " ", (text or "").strip())
    if not q:
        return ""

    q = re.sub(
        r"^(?:how\s+to\s+(?:fix|repair|paint|replace|install|remove|clean)\s+|"
        r"how\s+to\s+|tutorial\s+(?:for\s+)?|diy\s+(?:tutorial\s+)?)",
        "",
        q,
        flags=re.IGNORECASE,
    )
    q = re.sub(
        r"\s+(?:tutorial|diy|how\s+to\s+fix|how\s+to\s+repair)\s*$",
        "",
        q,
        flags=re.IGNORECASE,
    ).strip()

    tokens = re.findall(r"[a-z0-9']+", q.lower())
    kept: List[str] = []
    for token in tokens:
        if token in _YOUTUBE_QUERY_FILLER:
            continue
        if token == "up" and kept and kept[-1] == "touch":
            kept[-1] = "touch-up"
            continue
        kept.append(token)

    if kept and any(token in _YOUTUBE_SYMPTOM_TOKENS for token in kept):
        kept = [token for token in kept if token not in _YOUTUBE_SYMPTOM_TOKENS]

    has_action = any(
        token in _YOUTUBE_ACTION_TOKENS or token == "touch-up" for token in kept
    )
    if kept and not has_action:
        kept.append("repair")

    kept = _reorder_youtube_tokens(kept)
    if len(kept) > max_words:
        kept = kept[:max_words]

    result = " ".join(kept) if kept else q
    return _clean_phrase(result, max_chars=max_chars)


@dataclass(frozen=True)
class BranchSearchIntents:
    """Per-branch search phrases for optional checkpoint analysis."""

    issue_stem: str
    youtube_query: str
    shopping_materials: List[str] = field(default_factory=list)
    service_trade_query: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_stem": self.issue_stem,
            "youtube_query": self.youtube_query,
            "shopping_materials": list(self.shopping_materials),
            "service_trade_query": self.service_trade_query,
        }

    @classmethod
    def from_dict(cls, raw: Any) -> Optional[BranchSearchIntents]:
        if not isinstance(raw, dict):
            return None
        stem = str(raw.get("issue_stem") or raw.get("refined_query") or "").strip()
        if not stem:
            return None
        yt = str(raw.get("youtube_query") or "").strip()
        svc = str(raw.get("service_trade_query") or "").strip()
        materials_raw = raw.get("shopping_materials")
        materials: List[str] = []
        if isinstance(materials_raw, list):
            for item in materials_raw[:5]:
                if isinstance(item, str) and item.strip():
                    materials.append(_clean_phrase(item, max_chars=80))
        youtube = compact_youtube_search_query(yt or stem)
        return cls(
            issue_stem=_clean_phrase(stem, max_chars=200),
            youtube_query=youtube,
            shopping_materials=materials or [_clean_phrase(stem, max_chars=80)],
            service_trade_query=_clean_phrase(
                svc or f"{stem} repair contractor", max_chars=120
            ),
        )

    @classmethod
    def fallback_from_raw_query(cls, raw_query: str) -> BranchSearchIntents:
        stem = _clean_phrase(raw_query, max_chars=200)
        if not stem:
            return cls(
                issue_stem="",
                youtube_query="",
                shopping_materials=[],
                service_trade_query="",
            )
        return cls(
            issue_stem=stem,
            youtube_query=compact_youtube_search_query(stem),
            shopping_materials=[_clean_phrase(stem, max_chars=80)],
            service_trade_query=_clean_phrase(f"{stem} repair contractor", max_chars=120),
        )


__all__ = ["BranchSearchIntents", "compact_youtube_search_query"]
