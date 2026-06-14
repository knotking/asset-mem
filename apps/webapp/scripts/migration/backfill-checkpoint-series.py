#!/usr/bin/env python3
"""
Backfill checkpoint series for existing properties.

Groups checkpoints by normalized location, creates checkpointSeries docs,
and assigns seriesId / revisionNumber on each capture.

Usage:
  export GOOGLE_CLOUD_PROJECT=homegeek-staging
  python apps/webapp/scripts/migration/backfill-checkpoint-series.py --dry-run
  python apps/webapp/scripts/migration/backfill-checkpoint-series.py --user-id UID --property-id PID
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

# Repo root → gcp/common on path
_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
)
sys.path.insert(0, os.path.join(_REPO_ROOT, "gcp"))

from google.cloud import firestore  # noqa: E402

from common.checkpoint.series import (  # noqa: E402
    make_series_id,
    normalize_series_location,
    series_display_name,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _checkpoint_sort_key(data: dict[str, Any]) -> datetime:
    for key in ("createdAt", "capturedAt"):
        raw = data.get(key)
        if raw is None:
            continue
        if hasattr(raw, "timestamp"):
            return datetime.fromtimestamp(raw.timestamp(), tz=timezone.utc)
        if isinstance(raw, datetime):
            return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    return datetime.min.replace(tzinfo=timezone.utc)


def backfill_property(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    *,
    dry_run: bool,
) -> dict[str, int]:
    stats = {"series_created": 0, "captures_updated": 0, "skipped": 0}
    checkpoints_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
    )

    by_location: dict[str, list[tuple[str, dict[str, Any]]]] = defaultdict(list)
    for doc in checkpoints_ref.stream():
        data = doc.to_dict() or {}
        if data.get("seriesId"):
            stats["skipped"] += 1
            continue
        loc_key = normalize_series_location(data.get("location") or data.get("name"))
        by_location[loc_key].append((doc.id, data))

    series_coll = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpointSeries")
    )

    for loc_key, captures in by_location.items():
        captures.sort(key=lambda item: _checkpoint_sort_key(item[1]))
        series_id = make_series_id(loc_key)
        series_ref = series_coll.document(series_id)
        display = series_display_name(
            captures[0][1].get("location"),
            captures[0][1].get("name"),
        )

        if dry_run:
            logger.info(
                "DRY RUN property=%s series=%s location=%s captures=%d",
                property_id,
                series_id,
                loc_key,
                len(captures),
            )
            stats["series_created"] += 1
            stats["captures_updated"] += len(captures)
            continue

        batch = db.batch()
        prev_id: str | None = None
        for idx, (capture_id, data) in enumerate(captures, start=1):
            is_latest = idx == len(captures)
            cp_ref = checkpoints_ref.document(capture_id)
            batch.update(
                cp_ref,
                {
                    "seriesId": series_id,
                    "revisionNumber": idx,
                    "isLatestInSeries": is_latest,
                    "supersedesCaptureId": prev_id,
                    "captureKind": data.get("captureKind") or "ad_hoc",
                },
            )
            prev_id = capture_id
            stats["captures_updated"] += 1

        batch.set(
            series_ref,
            {
                "userId": user_id,
                "propertyId": property_id,
                "name": display,
                "location": loc_key,
                "assetType": captures[-1][1].get("assetType") or "real_estate",
                "createdAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
                "latestCaptureId": captures[-1][0],
                "captureCount": len(captures),
            },
            merge=True,
        )
        batch.commit()
        stats["series_created"] += 1
        logger.info(
            "Backfilled property=%s series=%s captures=%d",
            property_id,
            series_id,
            len(captures),
        )

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill checkpoint series")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--user-id", help="Limit to one user")
    parser.add_argument("--property-id", help="Limit to one property (requires --user-id)")
    args = parser.parse_args()

    db = firestore.Client()
    totals = {"series_created": 0, "captures_updated": 0, "skipped": 0}

    if args.user_id and args.property_id:
        property_refs = [
            db.collection("users")
            .document(args.user_id)
            .collection("properties")
            .document(args.property_id)
        ]
    elif args.user_id:
        property_refs = (
            db.collection("users")
            .document(args.user_id)
            .collection("properties")
            .stream()
        )
        property_refs = [p.reference for p in property_refs]
    else:
        logger.error("Provide --user-id (and optionally --property-id)")
        return 1

    for prop_ref in property_refs:
        user_id = prop_ref.parent.parent.id  # users/{uid}/properties/{pid}
        property_id = prop_ref.id
        stats = backfill_property(
            db, user_id, property_id, dry_run=args.dry_run
        )
        for k, v in stats.items():
            totals[k] += v

    logger.info("Done: %s", totals)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
