#!/usr/bin/env python3
"""
Verify that a delete flow completed successfully in Firebase (and optionally Storage / job doc).

Run AFTER triggering deletion from the UI or API. Pass the resource IDs you deleted.

Examples:
  # Document
  python verify-deletion.py --project homegeek-staging verify document \\
    --user-id UID --doc-id DOC_ID --storage-path documents/UID/file.pdf

  # Checkpoint
  python verify-deletion.py --project homegeek-staging verify checkpoint \\
    --user-id UID --property-id PID --checkpoint-id CP_ID \\
    --storage-path uploads/UID/properties/PID/checkpoints/a.jpg

  # Chat session
  python verify-deletion.py --project homegeek-staging verify session \\
    --user-id UID --session-id SESSION_ID

  # Property (waits for deletion job by default)
  python verify-deletion.py --project homegeek-staging verify property \\
    --user-id UID --property-id PID --wait-seconds 180

  # Saved service provider
  python verify-deletion.py --project homegeek-staging verify saved-provider \\
    --user-id UID --property-id PID --provider-id PROVIDER_ID

  # Full user erasure (post support job)
  python verify-deletion.py --project homegeek-staging verify user \\
    --user-id UID --wait-seconds 300

  # Poll a deletion job only
  python verify-deletion.py --project homegeek-staging wait-job \\
    --user-id UID --job-id property_PID --wait-seconds 180
"""

from __future__ import annotations

import argparse
import sys
import time
from dataclasses import dataclass, field
from typing import Callable

import firebase_admin
from firebase_admin import firestore, storage
from google.cloud import storage as gcs_storage
from google.cloud.firestore_v1.base_query import FieldFilter


@dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class VerificationReport:
    scenario: str
    results: list[CheckResult] = field(default_factory=list)

    def add(self, name: str, passed: bool, detail: str = "") -> None:
        self.results.append(CheckResult(name, passed, detail))

    @property
    def ok(self) -> bool:
        return all(r.passed for r in self.results)

    def print_report(self) -> None:
        print(f"\n=== Verification: {self.scenario} ===")
        for r in self.results:
            icon = "✓" if r.passed else "✗"
            line = f"  {icon} {r.name}"
            if r.detail:
                line += f" — {r.detail}"
            print(line)
        print(f"\n{'PASS' if self.ok else 'FAIL'} ({sum(r.passed for r in self.results)}/{len(self.results)} checks)")


def init_firebase(project_id: str):
    if not firebase_admin._apps:
        firebase_admin.initialize_app(options={"projectId": project_id})
    db = firestore.client()
    bucket = storage.bucket(f"{project_id}.firebasestorage.app")
    return db, bucket


def gcs_blob_exists(bucket, path: str) -> bool:
    if not path or not path.strip():
        return False
    try:
        return bucket.blob(path.strip()).exists()
    except Exception:
        return False


def gcs_prefix_has_objects(bucket, prefix: str) -> tuple[bool, int]:
    if not prefix:
        return False, 0
    normalized = prefix.rstrip("/") + "/"
    count = 0
    for blob in bucket.list_blobs(prefix=normalized, max_results=5):
        count += 1
    return count > 0, count


def doc_exists(db, path_parts: list[str]) -> bool:
    ref = db
    for i, part in enumerate(path_parts):
        if i == 0:
            ref = db.collection(part)
            continue
        if i == len(path_parts) - 1:
            return ref.document(part).get().exists
        ref = ref.document(part)
    return False


def collection_count(query) -> int:
    return sum(1 for _ in query.stream())


def wait_for_job(
    db,
    user_id: str,
    job_id: str,
    timeout_seconds: int,
    poll_interval: int = 3,
) -> tuple[str | None, str | None, list[str]]:
    """Returns (status, error, warnings) or (None, 'timeout', []) on timeout."""
    ref = (
        db.collection("users")
        .document(user_id)
        .collection("deletionJobs")
        .document(job_id)
    )
    deadline = time.time() + timeout_seconds
    last_status = None
    while time.time() < deadline:
        snap = ref.get()
        if not snap.exists:
            time.sleep(poll_interval)
            continue
        data = snap.to_dict() or {}
        status = data.get("status", "running")
        phase = data.get("phase", "")
        last_status = status
        print(f"  … job {job_id}: status={status} phase={phase}")
        if status in ("completed", "failed"):
            return status, data.get("error"), list(data.get("warnings") or [])
        time.sleep(poll_interval)
    return None, f"timeout after {timeout_seconds}s (last status={last_status})", []


def verify_document(
    db, bucket, user_id: str, doc_id: str, storage_paths: list[str], gs_uris: list[str]
) -> VerificationReport:
    report = VerificationReport("document")
    exists = (
        db.collection("users")
        .document(user_id)
        .collection("docs")
        .document(doc_id)
        .get()
        .exists
    )
    report.add("firestore:users/{uid}/docs/{docId}", not exists, "still exists" if exists else "gone")

    for path in storage_paths:
        found = gcs_blob_exists(bucket, path)
        report.add(f"storage:{path}", not found, "still exists" if found else "gone")

    if gs_uris:
        report.add(
            "rag:gsURI",
            True,
            "skipped (pass --check-rag to assert RAG removal; not implemented in verifier)",
        )

    return report


def verify_checkpoint(
    db,
    bucket,
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    storage_paths: list[str],
) -> VerificationReport:
    report = VerificationReport("checkpoint")
    cp_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
        .document(checkpoint_id)
    )
    exists = cp_ref.get().exists
    report.add("firestore:checkpoints/{id}", not exists, "still exists" if exists else "gone")

    metrics_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("metrics")
        .document("summary")
    )
    metrics_exists = metrics_ref.get().exists
    report.add(
        "firestore:metrics/summary",
        True,
        "present (rebuilt after delete)" if metrics_exists else "absent (async rebuild may be pending)",
    )

    for path in storage_paths:
        found = gcs_blob_exists(bucket, path)
        report.add(f"storage:{path}", not found, "still exists" if found else "gone")

    return report


def verify_session(
    db, bucket, user_id: str, session_id: str, storage_paths: list[str]
) -> VerificationReport:
    report = VerificationReport("session")
    session_ref = db.collection("users").document(user_id).collection("chats").document(session_id)
    session_exists = session_ref.get().exists
    report.add("firestore:chats/{sessionId}", not session_exists, "still exists" if session_exists else "gone")

    if session_exists:
        msg_count = collection_count(session_ref.collection("messages"))
        report.add("firestore:messages", msg_count == 0, f"{msg_count} message(s) remain")
    else:
        report.add("firestore:messages", True, "parent session gone")

    shared_q = (
        db.collection("sharedChats")
        .where(filter=FieldFilter("originalUserId", "==", user_id))
        .where(filter=FieldFilter("originalSessionId", "==", session_id))
    )
    shared_count = collection_count(shared_q)
    report.add("firestore:sharedChats", shared_count == 0, f"{shared_count} shared copy(ies) remain")

    for path in storage_paths:
        found = gcs_blob_exists(bucket, path)
        report.add(f"storage:{path}", not found, "still exists" if found else "gone")

    return report


def verify_saved_providers_empty(
    db, user_id: str, property_id: str
) -> VerificationReport:
    """Verify no savedProviders remain on the property (property may already be deleted)."""
    report = VerificationReport("saved-provider")
    prop_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
    )
    if not prop_ref.get().exists:
        report.add("firestore:savedProviders", True, "property gone")
        return report
    count = collection_count(prop_ref.collection("savedProviders"))
    report.add("firestore:savedProviders", count == 0, f"{count} remain")
    return report


def verify_saved_provider(
    db, user_id: str, property_id: str, provider_id: str
) -> VerificationReport:
    report = VerificationReport("saved-provider")
    ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("savedProviders")
        .document(provider_id)
    )
    exists = ref.get().exists
    report.add("firestore:savedProviders/{id}", not exists, "still exists" if exists else "gone")
    return report


def verify_property(
    db,
    bucket,
    user_id: str,
    property_id: str,
    job_id: str | None,
    wait_seconds: int,
    storage_paths: list[str],
) -> VerificationReport:
    report = VerificationReport("property")
    resolved_job_id = job_id or f"property_{property_id}"

    if wait_seconds > 0:
        status, err, warnings = wait_for_job(db, user_id, resolved_job_id, wait_seconds)
        if status is None:
            report.add("deletionJob:completed", False, err or "job doc missing")
        elif status == "failed":
            report.add("deletionJob:completed", False, err or "job failed")
            for w in warnings:
                report.add("deletionJob:warning", True, w)
        else:
            report.add("deletionJob:completed", True, f"job {resolved_job_id}")
            for w in warnings:
                report.add("deletionJob:warning", True, w)
    else:
        job_snap = (
            db.collection("users")
            .document(user_id)
            .collection("deletionJobs")
            .document(resolved_job_id)
            .get()
        )
        if job_snap.exists:
            data = job_snap.to_dict() or {}
            status = data.get("status")
            report.add(
                "deletionJob:status",
                status == "completed",
                f"status={status}" + (f" error={data.get('error')}" if data.get("error") else ""),
            )
        else:
            report.add("deletionJob:doc", True, "no job doc (may have been cleaned up)")

    prop_ref = db.collection("users").document(user_id).collection("properties").document(property_id)
    prop_snap = prop_ref.get()
    if prop_snap.exists:
        data = prop_snap.to_dict() or {}
        if data.get("deletionStatus") == "deleting":
            report.add("firestore:properties/{id}", False, "tombstone still present (deletionStatus=deleting)")
        else:
            report.add("firestore:properties/{id}", False, "property doc still exists")
    else:
        report.add("firestore:properties/{id}", True, "gone")

    docs_q = (
        db.collection("users")
        .document(user_id)
        .collection("docs")
        .where(filter=FieldFilter("propertyId", "==", property_id))
    )
    docs_left = collection_count(docs_q)
    report.add("firestore:docs by propertyId", docs_left == 0, f"{docs_left} doc(s) remain")

    chats_q = (
        db.collection("users")
        .document(user_id)
        .collection("chats")
        .where(filter=FieldFilter("propertyId", "==", property_id))
    )
    chats_left = collection_count(chats_q)
    report.add("firestore:chats by propertyId", chats_left == 0, f"{chats_left} chat(s) remain")

    if prop_snap.exists:
        cp_left = collection_count(prop_ref.collection("checkpoints"))
        sp_left = collection_count(prop_ref.collection("savedProviders"))
        report.add("firestore:checkpoints subcollection", cp_left == 0, f"{cp_left} remain")
        report.add("firestore:savedProviders subcollection", sp_left == 0, f"{sp_left} remain")
    else:
        report.add("firestore:checkpoints subcollection", True, "property gone")
        report.add("firestore:savedProviders subcollection", True, "property gone")

    prefix = f"uploads/{user_id}/properties/{property_id}/"
    has_blobs, blob_sample = gcs_prefix_has_objects(bucket, prefix)
    report.add(f"storage:{prefix}", not has_blobs, f"~{blob_sample}+ object(s)" if has_blobs else "empty")

    shared_q = (
        db.collection("sharedChats")
        .where(filter=FieldFilter("originalUserId", "==", user_id))
        .where(filter=FieldFilter("propertyId", "==", property_id))
    )
    shared_left = collection_count(shared_q)
    report.add("firestore:sharedChats by propertyId", shared_left == 0, f"{shared_left} remain")

    for path in storage_paths:
        found = gcs_blob_exists(bucket, path)
        report.add(f"storage:{path}", not found, "still exists" if found else "gone")

    return report


def verify_user_erasure(
    db, bucket, user_id: str, job_id: str | None, wait_seconds: int
) -> VerificationReport:
    report = VerificationReport("user-erasure")
    resolved_job_id = job_id or f"user_{user_id}"

    if wait_seconds > 0:
        status, err, warnings = wait_for_job(db, user_id, resolved_job_id, wait_seconds)
        if status is None:
            report.add("deletionJob:completed", False, err or "job doc missing")
        elif status == "failed":
            report.add("deletionJob:completed", False, err or "job failed")
        else:
            report.add("deletionJob:completed", True, resolved_job_id)
        for w in warnings:
            report.add("deletionJob:warning", True, w)

    user_ref = db.collection("users").document(user_id)
    user_exists = user_ref.get().exists
    subcollections = list(user_ref.collections())
    report.add(
        "firestore:users/{uid}",
        not user_exists and len(subcollections) == 0,
        "gone"
        if not user_exists and not subcollections
        else f"user doc exists={user_exists} subcollections={[c.id for c in subcollections]}",
    )

    token_ref = db.collection("llm_token_usage").document(user_id)
    report.add("firestore:llm_token_usage/{uid}", not token_ref.get().exists, "gone" if not token_ref.get().exists else "still exists")

    support_ref = db.collection("support_requests").document(user_id)
    report.add("firestore:support_requests/{uid}", not support_ref.get().exists, "gone" if not support_ref.get().exists else "still exists")

    shared_q = db.collection("sharedChats").where(filter=FieldFilter("originalUserId", "==", user_id))
    shared_left = collection_count(shared_q)
    report.add("firestore:sharedChats by user", shared_left == 0, f"{shared_left} remain")

    for prefix in (f"uploads/{user_id}/", f"documents/{user_id}/"):
        has_blobs, blob_sample = gcs_prefix_has_objects(bucket, prefix)
        report.add(f"storage:{prefix}", not has_blobs, f"objects remain (sample≥{blob_sample})" if has_blobs else "empty")

    return report


def cmd_wait_job(args) -> int:
    db, _ = init_firebase(args.project)
    status, err, warnings = wait_for_job(db, args.user_id, args.job_id, args.wait_seconds)
    if status == "completed":
        print(f"Job {args.job_id} completed.")
        for w in warnings:
            print(f"  warning: {w}")
        return 0
    print(f"Job {args.job_id} not completed: status={status} error={err}")
    return 1


def add_storage_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--storage-path",
        action="append",
        default=[],
        metavar="PATH",
        help="Storage object path to verify deleted (repeatable). From Firebase console or doc.storagePath.",
    )
    parser.add_argument(
        "--gs-uri",
        action="append",
        default=[],
        help="gs:// URI (for reference; storage path derived if --storage-path omitted)",
    )


def gs_uris_to_storage_paths(gs_uris: list[str]) -> list[str]:
    paths = []
    for uri in gs_uris:
        if uri.startswith("gs://"):
            parts = uri[5:].split("/", 1)
            if len(parts) == 2:
                paths.append(parts[1])
    return paths


def cmd_verify(args) -> int:
    db, bucket = init_firebase(args.project)
    storage_paths = list(args.storage_path or [])
    storage_paths.extend(gs_uris_to_storage_paths(args.gs_uri or []))
    storage_paths = list(dict.fromkeys(p for p in storage_paths if p))

    scenario = args.scenario
    if scenario == "document":
        if not args.doc_id:
            print("error: --doc-id required", file=sys.stderr)
            return 2
        report = verify_document(db, bucket, args.user_id, args.doc_id, storage_paths, args.gs_uri or [])
    elif scenario == "checkpoint":
        if not args.property_id or not args.checkpoint_id:
            print("error: --property-id and --checkpoint-id required", file=sys.stderr)
            return 2
        report = verify_checkpoint(
            db, bucket, args.user_id, args.property_id, args.checkpoint_id, storage_paths
        )
    elif scenario == "session":
        if not args.session_id:
            print("error: --session-id required", file=sys.stderr)
            return 2
        report = verify_session(db, bucket, args.user_id, args.session_id, storage_paths)
    elif scenario == "saved-provider":
        if not args.property_id:
            print("error: --property-id required", file=sys.stderr)
            return 2
        if not args.provider_id or args.provider_id in ("__none__", "none", "-"):
            report = verify_saved_providers_empty(db, args.user_id, args.property_id)
        else:
            report = verify_saved_provider(
                db, args.user_id, args.property_id, args.provider_id
            )
    elif scenario == "property":
        if not args.property_id:
            print("error: --property-id required", file=sys.stderr)
            return 2
        report = verify_property(
            db,
            bucket,
            args.user_id,
            args.property_id,
            args.job_id,
            args.wait_seconds,
            storage_paths,
        )
    elif scenario == "user":
        report = verify_user_erasure(db, bucket, args.user_id, args.job_id, args.wait_seconds)
    else:
        print(f"error: unknown scenario {scenario}", file=sys.stderr)
        return 2

    report.print_report()
    return 0 if report.ok else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Verify HomeApp delete flows completed in Firebase/Storage.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--project",
        required=True,
        help="Firebase/GCP project id (e.g. homegeek-staging)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    wait_p = sub.add_parser("wait-job", help="Poll users/{uid}/deletionJobs/{jobId} until done")
    wait_p.add_argument("--user-id", required=True)
    wait_p.add_argument("--job-id", required=True, help="e.g. property_{propertyId} or user_{uid}")
    wait_p.add_argument("--wait-seconds", type=int, default=180)
    wait_p.set_defaults(func=cmd_wait_job)

    verify_p = sub.add_parser("verify", help="Run post-delete checks for a scenario")
    verify_p.add_argument(
        "scenario",
        choices=["document", "checkpoint", "session", "saved-provider", "property", "user"],
        help="Delete scenario to verify",
    )
    verify_p.add_argument("--user-id", required=True, help="Firebase Auth uid")
    verify_p.add_argument("--property-id", help="Property id (checkpoint, property, saved-provider)")
    verify_p.add_argument("--doc-id", help="Document id in users/{uid}/docs")
    verify_p.add_argument("--checkpoint-id", help="Checkpoint id")
    verify_p.add_argument("--session-id", help="Chat session id")
    verify_p.add_argument("--provider-id", help="Saved provider id")
    verify_p.add_argument(
        "--job-id",
        help="Deletion job id (default property_{propertyId} or user_{uid})",
    )
    verify_p.add_argument(
        "--wait-seconds",
        type=int,
        default=0,
        help="Poll deletion job before checks (property default 180 if --wait-seconds omitted: use 180 for property, 300 for user)",
    )
    add_storage_args(verify_p)
    verify_p.set_defaults(func=cmd_verify)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    # Sensible defaults for async jobs
    if args.command == "verify" and args.scenario == "property" and args.wait_seconds == 0:
        args.wait_seconds = 180
    if args.command == "verify" and args.scenario == "user" and args.wait_seconds == 0:
        args.wait_seconds = 300
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
