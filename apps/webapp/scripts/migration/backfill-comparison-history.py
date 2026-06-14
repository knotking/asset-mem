#!/usr/bin/env python3
"""
Backfill comparison history subcollection from denormalized visualDiff.

For each checkpoint with visualDiff.status == completed, creates
checkpoints/{id}/comparisons/{visualDiff.id} when missing.

Usage:
  export GOOGLE_CLOUD_PROJECT=homegeek-staging
  python apps/webapp/scripts/migration/backfill-comparison-history.py --dry-run
  python apps/webapp/scripts/migration/backfill-comparison-history.py --user-id UID --property-id PID
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
)
sys.path.insert(0, os.path.join(_REPO_ROOT, "gcp"))

from google.cloud import firestore  # noqa: E402

from common.checkpoint.comparisons import comparison_record_from_visual_diff  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def backfill_property(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    *,
    dry_run: bool,
) -> dict[str, int]:
    stats = {"created": 0, "skipped": 0, "no_visual_diff": 0}
    checkpoints_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
    )

    for doc in checkpoints_ref.stream():
        data = doc.to_dict() or {}
        visual_diff = data.get("visualDiff")
        if not isinstance(visual_diff, dict) or visual_diff.get("status") != "completed":
            stats["no_visual_diff"] += 1
            continue

        comparison_id = str(visual_diff.get("id") or f"diff_{doc.id}_legacy")
        comp_ref = doc.reference.collection("comparisons").document(comparison_id)
        if comp_ref.get().exists:
            stats["skipped"] += 1
            continue

        source = "manual" if visual_diff.get("matchReason") == "manual" else "auto"
        record = comparison_record_from_visual_diff(visual_diff, source=source)
        record["id"] = comparison_id

        if dry_run:
            logger.info(
                "Would create comparisons/%s on checkpoint %s",
                comparison_id,
                doc.id,
            )
        else:
            comp_ref.set(record)
        stats["created"] += 1

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill checkpoint comparison history")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--user-id")
    parser.add_argument("--property-id")
    args = parser.parse_args()

    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT")
    if not project:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT")

    db = firestore.Client(project=project)

    if args.user_id and args.property_id:
        user_ids = [args.user_id]
        property_map = {args.user_id: [args.property_id]}
    else:
        user_ids = []
        property_map = {}
        for user_doc in db.collection("users").stream():
            user_ids.append(user_doc.id)
            pids = [
                p.id
                for p in user_doc.reference.collection("properties").stream()
            ]
            property_map[user_doc.id] = pids

    totals = {"created": 0, "skipped": 0, "no_visual_diff": 0}
    for user_id in user_ids:
        for property_id in property_map.get(user_id, []):
            logger.info("Processing user=%s property=%s", user_id, property_id)
            stats = backfill_property(
                db, user_id, property_id, dry_run=args.dry_run
            )
            for k, v in stats.items():
                totals[k] += v

    logger.info("Done totals=%s dry_run=%s", totals, args.dry_run)


if __name__ == "__main__":
    main()
