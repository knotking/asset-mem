"""Parse calendar/time-window phrases in checkpoint queries."""

from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

_MONTH_ALIASES: dict[str, int] = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}

_TEMPORAL_SIGNAL_RE = re.compile(
    r"\b("
    r"last\s+year|previous\s+year|this\s+year|current\s+year|"
    r"last\s+month|previous\s+month|this\s+month|current\s+month|"
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|"
    r"dec(?:ember)?)(?:\s+month)?|"
    r"\d{4}"
    r")\b",
    re.IGNORECASE,
)

_MONTH_YEAR_RE = re.compile(
    r"\b("
    r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|"
    r"dec(?:ember)?)"
    r"(?:\s+month)?(?:\s+(20\d{2}))?",
    re.IGNORECASE,
)

_YEAR_ONLY_RE = re.compile(r"\b(20\d{2})\b")


@dataclass(frozen=True)
class CheckpointDateRange:
    """UTC half-open interval ``[start_utc, end_utc)`` for Firestore ``createdAt``."""

    start_utc: datetime
    end_utc: datetime
    label: str


def query_requests_temporal_filter(user_query: str) -> bool:
    """True when the user is asking about a calendar window, not semantic similarity."""
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    return bool(_TEMPORAL_SIGNAL_RE.search(normalized))


def _month_bounds(year: int, month: int) -> CheckpointDateRange:
    last_day = calendar.monthrange(year, month)[1]
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    label = f"{calendar.month_name[month]} {year}"
    return CheckpointDateRange(start_utc=start, end_utc=end, label=label)


def _year_bounds(year: int) -> CheckpointDateRange:
    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    return CheckpointDateRange(start_utc=start, end_utc=end, label=str(year))


def _parse_month_token(token: str) -> Optional[int]:
    return _MONTH_ALIASES.get((token or "").strip().lower().rstrip("."))


def parse_reference_date_utc(value: str | datetime | None) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value.strip():
        text = value.strip()
        try:
            if "T" in text:
                parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            else:
                parsed = datetime.strptime(text[:10], "%Y-%m-%d")
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def parse_checkpoint_date_range(
    user_query: str,
    *,
    reference_date: str | datetime | None = None,
) -> Optional[CheckpointDateRange]:
    """
    Resolve a checkpoint capture window from natural language.

    Uses ``reference_date`` (typically ``current_date_utc`` from session context)
    to interpret relative phrases like "previous month" or bare "April".
    """
    normalized = (user_query or "").strip()
    if not normalized or not query_requests_temporal_filter(normalized):
        return None

    ref = parse_reference_date_utc(reference_date)
    lower = normalized.lower()

    if re.search(r"\b(?:last|previous)\s+year\b", lower):
        return _year_bounds(ref.year - 1)
    if re.search(r"\b(?:this|current)\s+year\b", lower):
        return _year_bounds(ref.year)

    if re.search(r"\b(?:last|previous)\s+month\b", lower):
        year = ref.year
        month = ref.month - 1
        if month < 1:
            month = 12
            year -= 1
        return _month_bounds(year, month)
    if re.search(r"\b(?:this|current)\s+month\b", lower):
        return _month_bounds(ref.year, ref.month)

    month_match = _MONTH_YEAR_RE.search(normalized)
    if month_match:
        month_num = _parse_month_token(month_match.group(1))
        if month_num is not None:
            explicit_year = month_match.group(2)
            year = int(explicit_year) if explicit_year else ref.year
            return _month_bounds(year, month_num)

    year_match = _YEAR_ONLY_RE.search(normalized)
    if year_match and not month_match:
        return _year_bounds(int(year_match.group(1)))

    return None


def format_temporal_scope_disclosure(date_range: CheckpointDateRange) -> str:
    return f"Temporal scope: checkpoints captured during {date_range.label} (UTC)."


__all__ = [
    "CheckpointDateRange",
    "format_temporal_scope_disclosure",
    "parse_checkpoint_date_range",
    "parse_reference_date_utc",
    "query_requests_temporal_filter",
]
