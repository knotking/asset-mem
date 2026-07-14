#!/usr/bin/env python3
"""
Staging smoke: landscape_irrigation checkpoint analysis end-to-end.

Uploads a lawn/irrigation photo to GCS, creates a Firestore checkpoint under the
given user/property, then either:
  - publishes to the staging checkpoint-analysis Pub/Sub topic (default), or
  - runs analysis locally with this checkout (`--mode local`) and writes results
    to Firestore (use when staging worker is missing fixes).

Polls until analysis completes and asserts landscape condition_scores keys.

Usage
-----
  # from repo root, with ADC for homegeek-staging
  python gcp/proxy/scripts/test_landscape_checkpoint_staging.py
  python gcp/proxy/scripts/test_landscape_checkpoint_staging.py --mode local

Optional env:
  TEST_USER_ID, TEST_PROPERTY_ID, IMAGE_PATH, GCP_PROJECT_ID, GCS_BUCKET,
  CHECKPOINT_ANALYSIS_TOPIC, POLL_SECONDS
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from google.cloud import firestore, pubsub_v1, storage

from gcs_firebase_media import ensure_firebase_download_url

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "homegeek-staging")
GCS_BUCKET = os.environ.get("GCS_BUCKET", "homegeek-user-data-staging")
TOPIC = os.environ.get("CHECKPOINT_ANALYSIS_TOPIC", "checkpoint-analysis-topic-staging")
USER_ID = os.environ.get("TEST_USER_ID", "9pMlqgk0IGNYwp1m08MmOGmlRCh1")
PROPERTY_ID = os.environ.get("TEST_PROPERTY_ID", "1xCBskwh1ar5Hf9Yl86p")
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "180"))
LOCATION = "Front Lawn"
ASSET_TYPE = "landscape_irrigation"
REQUIRED_SCORE_KEYS = ("plant_health", "irrigation_coverage", "drainage", "overall")

DEFAULT_IMAGE = Path(__file__).resolve().parent / "fixtures" / "landscape-front-lawn-test.png"
WORKER_DIR = (
    Path(__file__).resolve().parents[1]
    / "workers"
    / "function"
    / "checkpoint_analysis"
)
GCP_COMMON = Path(__file__).resolve().parents[2] / "common"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=("pubsub", "local"),
        default=os.environ.get("LANDSCAPE_E2E_MODE", "pubsub"),
        help="pubsub = deployed staging worker; local = analyze with this checkout",
    )
    args = parser.parse_args()

    image_path = Path(os.environ.get("IMAGE_PATH", str(DEFAULT_IMAGE)))
    if not image_path.is_file():
        print(f"FAIL: image not found: {image_path}", file=sys.stderr)
        return 1

    content_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    file_name = f"checkpoint_landscape_e2e_{stamp}_{uuid.uuid4().hex[:8]}.png"
    storage_path = (
        f"uploads/{USER_ID}/properties/{PROPERTY_ID}/checkpoints/{file_name}"
    )
    gs_uri = f"gs://{GCS_BUCKET}/{storage_path}"

    print(f"project={PROJECT_ID} mode={args.mode}")
    print(f"user={USER_ID} property={PROPERTY_ID}")
    print(f"image={image_path} ({content_type})")
    print(f"gs_uri={gs_uri}")

    # 1) Upload media
    storage_client = storage.Client(project=PROJECT_ID)
    bucket = storage_client.bucket(GCS_BUCKET)
    blob = bucket.blob(storage_path)
    blob.upload_from_filename(str(image_path), content_type=content_type)
    media_url = ensure_firebase_download_url(blob, GCS_BUCKET, storage_path)
    print("uploaded: ok")

    # 2) Create checkpoint doc
    db = firestore.Client(project=PROJECT_ID)
    prop_ref = (
        db.collection("users")
        .document(USER_ID)
        .collection("properties")
        .document(PROPERTY_ID)
    )
    prop = prop_ref.get()
    if not prop.exists:
        print(f"FAIL: property not found: {PROPERTY_ID}", file=sys.stderr)
        return 1

    checkpoint_ref = prop_ref.collection("checkpoints").document()
    checkpoint_id = checkpoint_ref.id
    checkpoint_ref.set(
        {
            "name": f"Landscape E2E Front Lawn {stamp}",
            "userId": USER_ID,
            "propertyId": PROPERTY_ID,
            "assetType": ASSET_TYPE,
            "location": LOCATION,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "analysisStatus": "pending",
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
    print(f"checkpoint_id={checkpoint_id}")

    if args.mode == "local":
        return _run_local_analysis(checkpoint_ref, checkpoint_id, gs_uri, content_type)

    # 3) Publish analysis job (match API source so worker skips creation quota path)
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC)
    payload = {
        "imageUrl": gs_uri,
        "contentType": content_type,
        "location": LOCATION,
        "checkpointId": checkpoint_id,
        "userId": USER_ID,
        "propertyId": PROPERTY_ID,
        "source": "checkpoint-analysis-api",
        "jobId": f"landscape-e2e-{uuid.uuid4().hex[:12]}",
    }
    message_id = publisher.publish(
        topic_path, json.dumps(payload).encode("utf-8")
    ).result()
    print(f"pubsub_message_id={message_id} topic={TOPIC}")

    # 4) Poll for completion
    deadline = time.time() + POLL_SECONDS
    last_status = None
    while time.time() < deadline:
        snap = checkpoint_ref.get()
        data = snap.to_dict() or {}
        status = data.get("analysisStatus")
        if status != last_status:
            print(f"analysisStatus={status}")
            last_status = status
        if status == "completed":
            return _assert_landscape(data, checkpoint_id)
        if status == "failed":
            print("FAIL: analysisStatus=failed", file=sys.stderr)
            print(json.dumps(_redact(data), indent=2, default=str), file=sys.stderr)
            return 1
        time.sleep(5)

    print(f"FAIL: timed out after {POLL_SECONDS}s (last status={last_status})", file=sys.stderr)
    return 1


def _run_local_analysis(checkpoint_ref, checkpoint_id: str, gs_uri: str, content_type: str) -> int:
    sys.path.insert(0, str(WORKER_DIR))
    sys.path.insert(0, str(GCP_COMMON.parent))  # so `common.*` resolves via gcp/
    os.environ.setdefault("GCP_PROJECT_ID", PROJECT_ID)

    from checkpoint_service import analyze_checkpoint_image  # noqa: WPS433

    checkpoint_ref.update({"analysisStatus": "processing"})
    print("local_analyze: start")
    try:
        analysis = analyze_checkpoint_image(gs_uri, content_type, location=LOCATION)
    except Exception as exc:
        checkpoint_ref.update({"analysisStatus": "failed"})
        print(f"FAIL: local analyze error: {exc}", file=sys.stderr)
        return 1

    issues = analysis.get("issues") or []
    issues_by_severity = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
    for issue in issues:
        if isinstance(issue, dict):
            severity = issue.get("severity", "minor")
            issues_by_severity[severity] = issues_by_severity.get(severity, 0) + 1
        else:
            issues_by_severity["minor"] += 1

    checkpoint_ref.update(
        {
            "analysisStatus": "completed",
            "aiAnalysis": {
                "summary": analysis.get("summary"),
                "conditions": analysis.get("conditions"),
                "detectedItems": analysis.get("detectedItems"),
                "issues": issues,
                "condition_scores": analysis.get("condition_scores") or {},
                "score_status": analysis.get("score_status"),
                "damage_scores": analysis.get("damage_scores") or {},
                "cost_estimates": analysis.get("cost_estimates") or {},
                "issues_by_severity": issues_by_severity,
                "aiConfidence": 0.9,
                "analyzedAt": firestore.SERVER_TIMESTAMP,
                "analysisSource": "local-e2e-script",
            },
        }
    )
    print("local_analyze: wrote Firestore")
    data = checkpoint_ref.get().to_dict() or {}
    return _assert_landscape(data, checkpoint_id)


def _assert_landscape(data: dict, checkpoint_id: str) -> int:
    ai = data.get("aiAnalysis") or {}
    scores = ai.get("condition_scores") or {}
    missing = [k for k in REQUIRED_SCORE_KEYS if k not in scores]
    print("--- result ---")
    print(f"checkpoint_id={checkpoint_id}")
    print(f"assetType={data.get('assetType')}")
    print(f"location={data.get('location')}")
    print(f"detectedAsset={ai.get('detectedAsset')}")
    print(f"condition_scores={json.dumps(scores, default=str)}")
    print(f"damage_scores={json.dumps(ai.get('damage_scores') or {}, default=str)}")
    print(f"summary={((ai.get('summary') or '')[:240])}")

    errors: list[str] = []
    if data.get("assetType") != ASSET_TYPE:
        errors.append(f"assetType expected {ASSET_TYPE}, got {data.get('assetType')}")
    if data.get("location") != LOCATION:
        errors.append(f"location expected {LOCATION}, got {data.get('location')}")
    if missing:
        errors.append(f"missing condition_scores keys: {missing}")
    if not errors:
        print("PASS: landscape_irrigation analysis verified")
        return 0
    for err in errors:
        print(f"FAIL: {err}", file=sys.stderr)
    return 1


def _redact(data: dict) -> dict:
    keep = {
        "analysisStatus",
        "assetType",
        "location",
        "name",
        "analysisQuotaExceeded",
        "analysisCreationQuotaExceeded",
        "aiAnalysis",
    }
    return {k: data.get(k) for k in keep if k in data}


if __name__ == "__main__":
    raise SystemExit(main())
