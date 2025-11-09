"""Utilities for loading and querying service provider metadata."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable, List, Optional

from pydantic import BaseModel, Field, ValidationError

DEFAULT_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "providers.sample.json"


class ProviderRecord(BaseModel):
    """Represents a single service provider entry."""

    provider_id: str = Field(..., description="Unique identifier for the provider.")
    display_name: str = Field(..., description="Public facing business name.")
    categories: List[str] = Field(default_factory=list, description="Service categories handled by this provider.")
    service_types: List[str] = Field(default_factory=list, description="Specific services or specialties.")
    coverage_zip_codes: List[str] = Field(default_factory=list, description="Supported postal codes.")
    coverage_cities: List[str] = Field(default_factory=list, description="Supported city names.")
    rating: Optional[float] = Field(default=None, description="Average review rating (0-5 scale).")
    response_time_minutes: Optional[int] = Field(default=None, description="Typical response time for new requests.")
    phone_number: Optional[str] = Field(default=None, description="Primary phone number for messaging or calls.")
    email: Optional[str] = Field(default=None, description="Primary email point of contact.")
    messaging_channel: str = Field(
        default="sms",
        description="Preferred outbound channel (sms|whatsapp|voice|email).",
    )
    notes: Optional[str] = Field(default=None, description="Supplemental internal notes.")

    def supports_location(self, postal_code: Optional[str], city: Optional[str]) -> bool:
        if not postal_code and not city:
            return True
        if postal_code and postal_code in self.coverage_zip_codes:
            return True
        if city and any(c.lower() == city.lower() for c in self.coverage_cities):
            return True
        return False

    def matches_category(self, category: Optional[str]) -> bool:
        if not category:
            return True
        canonical = category.lower()
        return any(c.lower() == canonical for c in self.categories)


class ProviderCatalog:
    """File-backed provider catalog with convenience lookups."""

    def __init__(self, data_path: Optional[Path] = None) -> None:
        env_path = os.environ.get("SERVICE_PROVIDER_DATA_PATH")
        self._data_path = Path(data_path or env_path or DEFAULT_DATA_PATH)
        self._records: List[ProviderRecord] = []
        self._load_once()

    def _load_once(self) -> None:
        if self._records:
            return
        if not self._data_path.exists():
            raise FileNotFoundError(
                f"Provider catalog not found at {self._data_path}. "
                "Update SERVICE_PROVIDER_DATA_PATH or place a file at the default location."
            )
        raw = json.loads(self._data_path.read_text())
        if not isinstance(raw, list):
            raise ValueError("Provider catalog JSON must be a list of providers.")
        parsed: List[ProviderRecord] = []
        for entry in raw:
            try:
                parsed.append(ProviderRecord(**entry))
            except ValidationError as exc:
                raise ValueError(f"Invalid provider entry: {exc}") from exc
        self._records = parsed

    @property
    def records(self) -> List[ProviderRecord]:
        return list(self._records)

    def find_matches(
        self,
        category: Optional[str] = None,
        postal_code: Optional[str] = None,
        city: Optional[str] = None,
        limit: int = 5,
        min_rating: Optional[float] = None,
    ) -> List[ProviderRecord]:
        """Return providers that match the supplied filters."""

        candidates: Iterable[ProviderRecord] = self._records
        if category:
            candidates = filter(lambda r: r.matches_category(category), candidates)
        if postal_code or city:
            candidates = filter(lambda r: r.supports_location(postal_code, city), candidates)
        if min_rating is not None:
            candidates = filter(lambda r: (r.rating or 0) >= min_rating, candidates)
        results = sorted(
            candidates,
            key=lambda r: (
                -(r.rating or 0),
                r.response_time_minutes or 9999,
                r.display_name,
            ),
        )
        return list(results)[:limit]


@lru_cache(maxsize=1)
def get_default_catalog() -> ProviderCatalog:
    return ProviderCatalog()


__all__ = ["ProviderCatalog", "ProviderRecord", "get_default_catalog"]

