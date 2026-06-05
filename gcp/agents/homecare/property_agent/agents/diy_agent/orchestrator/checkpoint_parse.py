"""Checkpoint diagnosis parsing and compact search seeds."""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_HIRE_PRO_KEYWORDS = (
    "gas line",
    "gas leak",
    "main electrical",
    "service panel",
    "breaker panel",
    "knob and tube",
    "asbestos",
    "structural",
    "load-bearing",
    "foundation",
    "sewage backup",
    "black mold",
    "refrigerant",
    "freon",
    "combustion",
    "carbon monoxide",
)


def _infer_hire_professional(diagnosis: str) -> bool:
    low = diagnosis.lower()
    return any(k in low for k in _HIRE_PRO_KEYWORDS)


def resolve_pipeline_diagnosis(
    user_query: str,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> tuple[str, Optional[str]]:
    """
    Split synthesis context from external API / web-grounding seeds.

    ``user_query`` carries the full diagnosis / checkpoint blob for synthesis. When a
    checkpoint retrieval seed is set, grounded web search, YouTube, SerpAPI, and library
    DIY cost use that phrase (after strip). Synthesis always uses ``user_query`` (falling
    back to the seed if ``user_query`` is empty).
    """
    llm_diagnosis = (user_query or "").strip()
    seed = (checkpoint_retrieval_search_query or "").strip()
    api_seed = seed if seed else None
    if not llm_diagnosis and api_seed:
        llm_diagnosis = api_seed
    return llm_diagnosis, api_seed


def _web_grounding_query(llm_diagnosis: str, api_seed: Optional[str]) -> str:
    """Issue text for Google Search grounding: retrieval seed when set, else compacted diagnosis."""
    if api_seed:
        return api_seed
    compact = _compact_diy_search_seed(llm_diagnosis)
    return compact or llm_diagnosis


def _extract_labeled_line(text: str, label: str) -> str:
    """Return one-line value after ``Label:`` (checkpoint-style blobs)."""
    m = re.search(rf"(?im)^{re.escape(label)}\s*:\s*(.+)$", text)
    if not m:
        return ""
    return re.sub(r"\s+", " ", m.group(1).strip())


# Comma-separated checkpoint summaries (single line) use the same labels; values end at the next label.
_KNOWN_CHECKPOINT_LABEL = (
    r"(?:Checkpoint\s+Name|(?:Location/Asset|Location)|Summary|Issues|Detected\s+items)"
)


def _extract_inline_labeled_value(one_line: str, label_regex: str) -> str:
    """Parse ``..., Label: value, NextLabel:`` style checkpoint text."""
    m = re.search(
        rf"(?i)(?:^|,)\s*{label_regex}\s*:\s*(.+?)(?=,\s*{_KNOWN_CHECKPOINT_LABEL}\s*:|$)",
        one_line,
    )
    if not m:
        return ""
    return re.sub(r"\s+", " ", m.group(1).strip())


def _joined_clean_parts(loc: str, sum_: str, iss: str) -> list[str]:
    """Join Location / Summary / Issues without duplicating sentence-ending periods."""
    out: list[str] = []
    for p in (loc, sum_, iss):
        s = (p or "").strip().rstrip(" \t.;")
        if s:
            out.append(s)
    return out


def _diy_search_seed_max_chars() -> int:
    raw = os.getenv("DIY_SEARCH_SEED_MAX_CHARS", "280").strip()
    try:
        n = int(raw)
    except ValueError:
        return 280
    return max(40, min(n, 2000))


def _shopping_query_max_chars() -> int:
    raw = os.getenv("DIY_SHOPPING_QUERY_MAX_CHARS", "120").strip()
    try:
        n = int(raw)
    except ValueError:
        return 120
    return max(30, min(n, 400))


def _shopping_search_seed(loc: str, sum_: str, iss: str) -> str:
    """
    Short keyword-style query for Google Shopping (SerpAPI).

    Long narrative strings often return ``Google hasn't returned any results``;
    location + issues (or summary) tends to match product search better than
    the full YouTube-oriented seed.
    """
    loc = (loc or "").strip().rstrip(" \t.;")
    sum_ = (sum_ or "").strip().rstrip(" \t.;")
    iss = (iss or "").strip().rstrip(" \t.;")
    chunks: list[str] = []
    if loc:
        chunks.append(loc)
    body = iss or sum_
    if body:
        chunks.append(body)
    elif sum_ and not chunks:
        chunks.append(sum_)
    q = " ".join(chunks).strip()
    q = re.sub(r"\s+", " ", q)
    max_c = _shopping_query_max_chars()
    if len(q) > max_c:
        cut = q[: max_c + 1]
        q = cut.rsplit(" ", 1)[0].strip() if " " in cut else cut[:max_c].strip()
    return q


def _parse_checkpoint_fields(diagnosis: str) -> tuple[str, str, str, str]:
    """
    Strip checkpoint boilerplate; return (location, summary, issues, rest_one_line).

    ``rest_one_line`` is the blob collapsed to one line if structured fields are absent.
    """
    raw = (diagnosis or "").strip()
    if not raw:
        return "", "", "", ""

    t = re.sub(r"\r\n?", "\n", raw)
    t = re.sub(
        r"(?is)^\s*analyse?\s+my\s+checkpoints\s*",
        "",
        t,
        count=1,
    ).lstrip()
    t = re.sub(r"(?is)\bcheckpoint\s+context\s*:?\s*", "", t, count=1).strip()
    t = re.sub(
        r"(?is)checkpoint\s+name\s*:\s*[^\n,]+(?:,|\n)?\s*", "", t, count=1
    ).strip()

    one_line = re.sub(r"\s+", " ", t)

    loc = _extract_labeled_line(t, "Location/Asset") or _extract_labeled_line(
        t, "Location"
    )
    sum_ = _extract_labeled_line(t, "Summary")
    iss = _extract_labeled_line(t, "Issues")

    if not loc:
        loc = _extract_inline_labeled_value(one_line, r"(?:Location/Asset|Location)")
    if not sum_:
        sum_ = _extract_inline_labeled_value(one_line, "Summary")
    if not iss:
        iss = _extract_inline_labeled_value(one_line, "Issues")

    return loc, sum_, iss, one_line


def _split_list_field(raw: str) -> list[str]:
    if not (raw or "").strip():
        return []
    return [x.strip() for x in re.split(r"[,;]", raw) if x.strip()]


def parse_checkpoint_structured_context(diagnosis: str) -> Dict[str, Any]:
    """
    Structured checkpoint fields for step generation (location, summary, issues, etc.).

    Returns a dict with only non-empty values suitable for JSON ``checkpoint`` input.
    """
    raw = (diagnosis or "").strip()
    if not raw:
        return {}

    t = re.sub(r"\r\n?", "\n", raw)
    loc, sum_, iss, one_line = _parse_checkpoint_fields(diagnosis)

    detected_raw = _extract_labeled_line(
        t, "Detected items"
    ) or _extract_inline_labeled_value(one_line, r"Detected\s+items")
    conditions_raw = _extract_labeled_line(
        t, "Conditions"
    ) or _extract_inline_labeled_value(one_line, "Conditions")

    out: Dict[str, Any] = {}
    if loc:
        out["location"] = loc
    if sum_:
        out["summary"] = sum_
    if iss:
        out["issues"] = iss
    detected = _split_list_field(detected_raw)
    if detected:
        out["detected_items"] = detected
    conditions = _split_list_field(conditions_raw)
    if conditions:
        out["conditions"] = conditions
    return out


def _compact_diy_search_seed(diagnosis: str) -> str:
    """
    Turn long checkpoint-style prompts into a short phrase for YouTube search (and fallbacks).

    SerpAPI uses ``_shopping_search_seed`` with a shorter keyword-style query. Checkpoint flows
    pass the retrieval seed to YouTube/shopping/web/cost; synthesis uses full ``user_query``.
    """
    raw = (diagnosis or "").strip()
    if not raw:
        return ""

    loc, sum_, iss, one_line = _parse_checkpoint_fields(diagnosis)

    parts = _joined_clean_parts(loc, sum_, iss)
    if parts:
        seed = ". ".join(parts)
    else:
        seed = one_line

    seed = re.sub(r"(?i),?\s*detected\s+items\s*:.*$", "", seed).strip()
    seed = re.sub(r"\s+", " ", seed).strip()
    seed = re.sub(r"\.\s*\.+", ". ", seed).strip()

    max_c = _diy_search_seed_max_chars()
    if len(seed) > max_c:
        cut = seed[: max_c + 1]
        if " " in cut:
            seed = cut.rsplit(" ", 1)[0].strip()
        else:
            seed = cut[:max_c].strip()

    if not seed:
        seed = re.sub(r"\s+", " ", raw)[:200].strip()

    if len(diagnosis) > len(seed) + 80:
        logger.debug(
            "DIY external search seed: diagnosis_len=%d seed_len=%d",
            len(diagnosis),
            len(seed),
        )
    return seed

