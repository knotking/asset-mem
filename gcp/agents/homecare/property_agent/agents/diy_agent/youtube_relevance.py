"""Rank YouTube DIY videos by token overlap with checkpoint issue stem (no domain blocklists)."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

# Generic English / DIY filler — not issue-type keywords.
_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "do",
        "fix",
        "for",
        "how",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "the",
        "this",
        "to",
        "tutorial",
        "video",
        "with",
        "your",
        "diy",
        "repair",
        "step",
        "steps",
    }
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokens_from_text(text: str) -> Set[str]:
    out: Set[str] = set()
    for match in _TOKEN_RE.finditer((text or "").casefold()):
        tok = match.group(0)
        if len(tok) < 2 or tok in _STOPWORDS:
            continue
        out.add(tok)
    return out


def relevance_anchor_tokens(
    relevance_stem: str,
    search_query: Optional[str] = None,
) -> Set[str]:
    """Tokens from the run-specific stem and optional YouTube query."""
    anchor: Set[str] = set()
    anchor.update(_tokens_from_text(relevance_stem))
    if search_query:
        anchor.update(_tokens_from_text(search_query))
    return anchor


def _video_text_blob(video: Dict[str, Any]) -> tuple[str, str]:
    title = str(video.get("title") or "")
    description = str(video.get("description") or "")
    return title, description


def score_youtube_video_relevance(
    video: Dict[str, Any],
    anchor_tokens: Set[str],
) -> float:
    """Higher when title/description share tokens with the issue stem."""
    if not anchor_tokens:
        return 0.0
    title, description = _video_text_blob(video)
    title_tokens = _tokens_from_text(title)
    desc_tokens = _tokens_from_text(description)
    score = 0.0
    for tok in anchor_tokens:
        if tok in title_tokens:
            score += 3.0
        elif tok in desc_tokens:
            score += 1.0
    return score


@dataclass(frozen=True)
class YouTubeRankRow:
    """One candidate video with relevance score for logging and ranking."""

    orig_idx: int
    score: float
    title: str
    video: Dict[str, Any]


def _score_video_rows(
    videos: List[Dict[str, Any]],
    anchor: Set[str],
) -> List[YouTubeRankRow]:
    rows: List[YouTubeRankRow] = []
    for idx, video in enumerate(videos):
        title = str(video.get("title") or "").strip()
        rows.append(
            YouTubeRankRow(
                orig_idx=idx,
                score=score_youtube_video_relevance(video, anchor),
                title=title,
                video=video,
            )
        )
    return rows


def _sort_rank_rows(rows: List[YouTubeRankRow]) -> List[YouTubeRankRow]:
    if any(r.score > 0 for r in rows):
        return sorted(rows, key=lambda r: (-r.score, r.orig_idx))
    return sorted(rows, key=lambda r: r.orig_idx)


def format_youtube_relevance_log(
    rows: List[YouTubeRankRow],
    *,
    max_results: int,
    anchor_tokens: Set[str],
    title_max_chars: int = 48,
) -> str:
    """Compact one-line summary for INFO logs."""
    anchor_blob = ",".join(sorted(anchor_tokens)[:12])
    if len(anchor_tokens) > 12:
        anchor_blob += ",…"
    parts: List[str] = []
    for rank, row in enumerate(rows, start=1):
        title = row.title
        if len(title) > title_max_chars:
            title = title[: title_max_chars - 1].rstrip() + "…"
        marker = "*" if rank <= max_results else ""
        parts.append(f"{marker}{row.score:g}:'{title}'")
    return f"anchor=[{anchor_blob}] ranked=[{'; '.join(parts)}]"


def log_youtube_relevance_ranking(
    rows: List[YouTubeRankRow],
    *,
    max_results: int,
    anchor_tokens: Set[str],
    candidate_count: int,
) -> None:
    """Emit INFO for selected top-N scores; DEBUG for full candidate pool."""
    if not rows:
        return
    logger.info(
        "youtube_relevance: candidates=%d selected=%d %s",
        candidate_count,
        min(max_results, len(rows)),
        format_youtube_relevance_log(
            rows, max_results=max_results, anchor_tokens=anchor_tokens
        ),
    )
    logger.debug(
        "youtube_relevance: full_pool=%s",
        [
            {
                "orig_idx": r.orig_idx,
                "score": r.score,
                "title": r.title,
                "selected": i < max_results,
            }
            for i, r in enumerate(rows)
        ],
    )


def rank_youtube_videos_by_stem(
    videos: List[Dict[str, Any]],
    relevance_stem: str,
    *,
    search_query: Optional[str] = None,
    max_results: int = 5,
) -> List[Dict[str, Any]]:
    """
    Re-rank prefetched videos by stem/query token overlap; demote low-overlap rows.

    When every score is zero, preserves incoming order (no hard drop).
    """
    if not videos:
        return []

    valid: List[Dict[str, Any]] = []
    for video in videos:
        if not isinstance(video, dict):
            continue
        if not str(video.get("url") or "").strip():
            continue
        valid.append(video)

    if not valid:
        return []

    anchor = relevance_anchor_tokens(relevance_stem, search_query)
    if not anchor:
        return valid[:max_results]

    rows = _sort_rank_rows(_score_video_rows(valid, anchor))
    log_youtube_relevance_ranking(
        rows,
        max_results=max_results,
        anchor_tokens=anchor,
        candidate_count=len(valid),
    )
    return [row.video for row in rows[:max_results]]


__all__ = [
    "YouTubeRankRow",
    "format_youtube_relevance_log",
    "log_youtube_relevance_ranking",
    "rank_youtube_videos_by_stem",
    "relevance_anchor_tokens",
    "score_youtube_video_relevance",
]
