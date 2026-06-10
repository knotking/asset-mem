#!/usr/bin/env python3
"""
Re-wrap checkpoint ``embedding`` fields as Firestore Vector values.

Older checkpoint analysis runs stored embeddings as plain float arrays. Firestore
vector indexes only index the Vector field type, so ``findNearest`` returns no hits
until embeddings are wrapped with ``Vector([...])``.

Usage:
  # Staging dry-run (all checkpoints)
  GCP_PROJECT_ID=homegeek-staging python migrate_checkpoint_embeddings.py --dry-run

  # One property
  python migrate_checkpoint_embeddings.py --user-id UID --property-id PID

  # Apply
  python migrate_checkpoint_embeddings.py
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Any, Iterator

try:
    from google.cloud import firestore
    from google.cloud.firestore_v1.vector import Vector
except ImportError as exc:
    print(f"Install google-cloud-firestore: {exc}", file=sys.stderr)
    sys.exit(1)


@dataclass
class MigrationStats:
    scanned: int = 0
    skipped_no_embedding: int = 0
    skipped_already_vector: int = 0
    skipped_invalid: int = 0
    updated: int = 0
    errors: int = 0


def _checkpoint_refs(
    db: firestore.Client,
    *,
    user_id: str | None,
    property_id: str | None,
) -> Iterator[firestore.DocumentReference]:
    if user_id and property_id:
        yield from (
            db.collection("users")
            .document(user_id)
            .collection("properties")
            .document(property_id)
            .collection("checkpoints")
            .list_documents()
        )
        return

    users = [db.collection("users").document(user_id)] if user_id else db.collection("users").stream()
    for user_doc in users:
        user_ref = user_doc if isinstance(user_doc, firestore.DocumentReference) else user_doc.reference
        properties = (
            [user_ref.collection("properties").document(property_id)]
            if property_id
            else user_ref.collection("properties").list_documents()
        )
        for prop_ref in properties:
            yield from prop_ref.collection("checkpoints").list_documents()


def _needs_vector_wrap(embedding: Any) -> bool:
    if embedding is None:
        return False
    if isinstance(embedding, list):
        return len(embedding) > 0
    if isinstance(embedding, Vector):
        return False
    return False


def migrate(
    db: firestore.Client,
    *,
    user_id: str | None,
    property_id: str | None,
    dry_run: bool,
    limit: int | None,
) -> MigrationStats:
    stats = MigrationStats()

    for ckpt_ref in _checkpoint_refs(db, user_id=user_id, property_id=property_id):
        if limit is not None and stats.scanned >= limit:
            break

        stats.scanned += 1
        path = ckpt_ref.path
        try:
            snap = ckpt_ref.get()
            if not snap.exists:
                stats.skipped_invalid += 1
                continue
            data = snap.to_dict() or {}
            embedding = data.get("embedding")

            if embedding is None:
                stats.skipped_no_embedding += 1
                continue
            if isinstance(embedding, Vector):
                stats.skipped_already_vector += 1
                continue
            if not isinstance(embedding, list):
                print(f"skip invalid type path={path} type={type(embedding).__name__}")
                stats.skipped_invalid += 1
                continue

            print(
                f"{'would update' if dry_run else 'update'} path={path} "
                f"dim={len(embedding)} model={data.get('embeddingModel')!r}"
            )
            if not dry_run:
                ckpt_ref.update({"embedding": Vector(embedding)})
            stats.updated += 1
        except Exception as exc:
            stats.errors += 1
            print(f"error path={path}: {exc}", file=sys.stderr)

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Wrap checkpoint embedding arrays as Firestore Vector for vector search."
    )
    parser.add_argument(
        "--project-id",
        default=os.environ.get("GCP_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT"),
        help="GCP project (default: GCP_PROJECT_ID env)",
    )
    parser.add_argument("--user-id", help="Limit to one user")
    parser.add_argument("--property-id", help="Limit to one property (requires --user-id)")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print actions without writing",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Stop after scanning N checkpoint docs",
    )
    args = parser.parse_args()

    if args.property_id and not args.user_id:
        parser.error("--property-id requires --user-id")

    if not args.project_id:
        print("Set GCP_PROJECT_ID or pass --project-id", file=sys.stderr)
        return 1

    db = firestore.Client(project=args.project_id)
    print(
        f"project={args.project_id} dry_run={args.dry_run} "
        f"user_id={args.user_id or '*'} property_id={args.property_id or '*'}"
    )

    stats = migrate(
        db,
        user_id=args.user_id,
        property_id=args.property_id,
        dry_run=args.dry_run,
        limit=args.limit,
    )

    print(
        f"done scanned={stats.scanned} updated={stats.updated} "
        f"already_vector={stats.skipped_already_vector} "
        f"no_embedding={stats.skipped_no_embedding} invalid={stats.skipped_invalid} "
        f"errors={stats.errors}"
    )
    return 1 if stats.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
