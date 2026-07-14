#!/usr/bin/env python3
"""
Staging negative controls for landscape_irrigation routing.

Uploads kitchen + car fixtures, runs local analysis against homegeek-staging
Firestore/Vertex, and asserts landscape-specific condition_scores keys are absent.

Usage
-----
  python gcp/proxy/scripts/test_landscape_negative_controls_staging.py
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from google.cloud import firestore, storage

from gcs_firebase_media import ensure_firebase_download_url

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "homegeek-staging")
GCS_BUCKET = os.environ.get("GCS_BUCKET", "homegeek-user-data-staging")
USER_ID = os.environ.get("TEST_USER_ID", "9pMlqgk0IGNYwp1m08MmOGmlRCh1")
PROPERTY_ID = os.environ.get("TEST_PROPERTY_ID", "1xCBskwh1ar5Hf9Yl86p")

FIXTURES = Path(__file__).resolve().parent / "fixtures"
WORKER_DIR = (
    Path(__file__).resolve().parents[1]
    / "workers"
    / "function"
    / "checkpoint_analysis"
)
GCP_ROOT = Path(__file__).resolve().parents[2]

LANDSCAPE_SCORE_KEYS = frozenset(
    {"plant_health", "irrigation_coverage", "drainage"}
)

CASES = (
    {
        "label": "kitchen",
        "image": FIXTURES / "negative-control-kitchen.png",
        "assetType": "real_estate",
        "location": "Kitchen",
        "expected_category": "property",
    },
    {
        "label": "car",
        "image": FIXTURES / "negative-control-car.png",
        "assetType": "vehicle",
        "location": "Car - Exterior",
        "expected_category": "vehicle",
    },
)


def main() -> int:
    sys.path.insert(0, str(WORKER_DIR))
    sys.path.insert(0, str(GCP_ROOT))
    os.environ.setdefault("GCP_PROJECT_ID", PROJECT_ID)

    from checkpoint_service import analyze_checkpoint_image
    from prompt_builder import get_asset_category

    storage_client = storage.Client(project=PROJECT_ID)
    bucket = storage_client.bucket(GCS_BUCKET)
    db = firestore.Client(project=PROJECT_ID)
    prop_ref = (
        db.collection("users")
        .document(USER_ID)
        .collection("properties")
        .document(PROPERTY_ID)
    )
    if not prop_ref.get().exists:
        print(f"FAIL: property not found: {PROPERTY_ID}", file=sys.stderr)
        return 1

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    failures = 0

    for case in CASES:
        image_path: Path = case["image"]
        if not image_path.is_file():
            print(f"FAIL [{case['label']}]: missing {image_path}", file=sys.stderr)
            failures += 1
            continue

        category = get_asset_category(case["location"])
        print(f"\n=== {case['label']} ===")
        print(f"location={case['location']} get_asset_category={category}")
        if category != case["expected_category"]:
            print(
                f"FAIL [{case['label']}]: expected category "
                f"{case['expected_category']}, got {category}",
                file=sys.stderr,
            )
            failures += 1
            continue

        content_type = "image/png"
        file_name = (
            f"checkpoint_neg_{case['label']}_{stamp}_{uuid.uuid4().hex[:8]}.png"
        )
        storage_path = (
            f"uploads/{USER_ID}/properties/{PROPERTY_ID}/checkpoints/{file_name}"
        )
        gs_uri = f"gs://{GCS_BUCKET}/{storage_path}"
        blob = bucket.blob(storage_path)
        blob.upload_from_filename(str(image_path), content_type=content_type)
        media_url = ensure_firebase_download_url(blob, GCS_BUCKET, storage_path)
        print(f"uploaded {gs_uri}")

        checkpoint_ref = prop_ref.collection("checkpoints").document()
        checkpoint_ref.set(
            {
                "name": f"Neg control {case['label']} {stamp}",
                "userId": USER_ID,
                "propertyId": PROPERTY_ID,
                "assetType": case["assetType"],
                "location": case["location"],
                "createdAt": firestore.SERVER_TIMESTAMP,
                "analysisStatus": "processing",
                "media": [
                    {
                        "id": file_name,
                        "url": media_url,
                        "gsURI": gs_uri,
                        "contentType": content_type,
                        "storagePath": storage_path,
                    }
                ],
            }
        )
        print(f"checkpoint_id={checkpoint_ref.id}")

        try:
            analysis = analyze_checkpoint_image(
                gs_uri, content_type, location=case["location"]
            )
        except Exception as exc:
            checkpoint_ref.update({"analysisStatus": "failed"})
            print(f"FAIL [{case['label']}]: analyze error: {exc}", file=sys.stderr)
            failures += 1
            continue

        scores = analysis.get("condition_scores") or {}
        leaked = sorted(LANDSCAPE_SCORE_KEYS.intersection(scores))
        print(f"condition_scores={json.dumps(scores, default=str)}")
        print(f"summary={(analysis.get('summary') or '')[:200]}")

        checkpoint_ref.update(
            {
                "analysisStatus": "completed",
                "aiAnalysis": {
                    "summary": analysis.get("summary"),
                    "conditions": analysis.get("conditions"),
                    "detectedItems": analysis.get("detectedItems"),
                    "issues": analysis.get("issues") or [],
                    "condition_scores": scores,
                    "score_status": analysis.get("score_status"),
                    "damage_scores": analysis.get("damage_scores") or {},
                    "cost_estimates": analysis.get("cost_estimates") or {},
                    "aiConfidence": 0.9,
                    "analyzedAt": firestore.SERVER_TIMESTAMP,
                    "analysisSource": "local-negative-control-script",
                },
            }
        )

        if leaked:
            print(
                f"FAIL [{case['label']}]: landscape score keys leaked: {leaked}",
                file=sys.stderr,
            )
            failures += 1
            continue

        if "overall" not in scores:
            print(
                f"FAIL [{case['label']}]: missing overall condition score",
                file=sys.stderr,
            )
            failures += 1
            continue

        print(f"PASS [{case['label']}]: no landscape score keys")

    if failures:
        print(f"\nFAIL: {failures} negative-control case(s) failed", file=sys.stderr)
        return 1
    print("\nPASS: all negative controls")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
