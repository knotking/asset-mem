#!/usr/bin/env python3
"""
Run leaf-to-root deletion scenarios via uvproxy HTTP only, then verify.

Prerequisites:
  - uvproxy running (default http://localhost:8080)
  - TEST_FIREBASE_ID_TOKEN or --firebase-id-token (Bearer for the target user)
  - DATA_ERASURE_ADMIN_SECRET in gcp/proxy/.env for user erasure step

Firestore reads (inventory + stuck-job reset) use Admin SDK only for test orchestration.
Leaf deletes go through the proxy API except saved providers (client Firestore delete in QA).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import firebase_admin
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION_DIR = Path(__file__).resolve().parent
VERIFY_SH = MIGRATION_DIR / "verify-deletion.sh"
PROXY_ENV = REPO_ROOT / "gcp" / "proxy" / ".env"


def _load_proxy_env() -> None:
    if not PROXY_ENV.exists():
        return
    for line in PROXY_ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def init_fb(project: str):
    if not firebase_admin._apps:
        firebase_admin.initialize_app(options={"projectId": project})
    return firestore.client()


def proxy_request(
    base_url: str,
    method: str,
    path: str,
    token: str,
    payload: dict | None = None,
    *,
    extra_headers: dict[str, str] | None = None,
) -> dict:
    url = f"{base_url.rstrip('/')}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if extra_headers:
        headers.update(extra_headers)
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            body = resp.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {method} {path}: {err_body}") from exc


def reset_stuck_job(db, user_id: str, job_id: str) -> None:
    ref = db.collection("users").document(user_id).collection("deletionJobs").document(job_id)
    snap = ref.get()
    if not snap.exists:
        return
    if (snap.to_dict() or {}).get("status") == "running":
        ref.set(
            {
                "status": "failed",
                "phase": "error",
                "error": "reset by run-deletion-scenarios",
            },
            merge=True,
        )
        print(f"  reset stuck job {job_id}", flush=True)


def wait_job_via_proxy(base_url: str, token: str, job_id: str, timeout: int) -> str:
    deadline = time.time() + timeout
    last = "unknown"
    while time.time() < deadline:
        data = proxy_request(base_url, "GET", f"/deletion/jobs/{job_id}", token)
        last = data.get("status", "running")
        phase = data.get("phase")
        print(f"  … job {job_id}: status={last} phase={phase}", flush=True)
        if last in ("completed", "failed"):
            if last == "failed":
                print(f"  … error: {data.get('error')}", flush=True)
            return last
        time.sleep(3)
    return f"timeout(last={last})"


def run_verify(project: str, scenario: str, user_id: str, extra: list[str]) -> tuple[int, str]:
    cmd = [str(VERIFY_SH), "--project", project, "verify", scenario, "--user-id", user_id, *extra]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(MIGRATION_DIR))
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def require_token(explicit: str | None) -> str:
    token = (explicit or os.environ.get("TEST_FIREBASE_ID_TOKEN") or os.environ.get("FIREBASE_ID_TOKEN") or "").strip()
    if not token:
        print(
            "error: set TEST_FIREBASE_ID_TOKEN (or --firebase-id-token).\n"
            "  Log in as the user in webapp, then copy the Firebase ID token from the browser.",
            file=sys.stderr,
        )
        sys.exit(2)
    return token


def main() -> int:
    parser = argparse.ArgumentParser(description="Run deletion scenarios via uvproxy HTTP only")
    parser.add_argument("--project", default="homegeek-staging")
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--proxy-url", default="http://localhost:8080")
    parser.add_argument("--firebase-id-token", help="Firebase Bearer token for the target user")
    args = parser.parse_args()

    _load_proxy_env()
    token = require_token(args.firebase_id_token)
    uid = args.user_id
    project = args.project
    proxy = args.proxy_url
    db = init_fb(project)

    props = list(db.collection("users").document(uid).collection("properties").stream())
    if not props:
        print("No properties found; aborting.")
        return 1
    pid = props[0].id

    docs = list(db.collection("users").document(uid).collection("docs").limit(1).stream())
    doc_id = docs[0].id if docs else None
    doc_data = docs[0].to_dict() or {} if docs else {}

    cps = list(
        db.collection("users")
        .document(uid)
        .collection("properties")
        .document(pid)
        .collection("checkpoints")
        .limit(1)
        .stream()
    )
    cp_id = cps[0].id if cps else None
    cp_path = ""
    if cps:
        for media in (cps[0].to_dict() or {}).get("media") or []:
            if isinstance(media, dict) and media.get("storagePath"):
                cp_path = str(media["storagePath"])
                break

    chats = list(
        db.collection("users")
        .document(uid)
        .collection("chats")
        .where(filter=FieldFilter("propertyId", "==", pid))
        .limit(1)
        .stream()
    )
    session_id = chats[0].id if chats else None

    providers = list(
        db.collection("users")
        .document(uid)
        .collection("properties")
        .document(pid)
        .collection("savedProviders")
        .limit(1)
        .stream()
    )
    provider_id = providers[0].id if providers else None

    results: list[tuple[str, int]] = []

    def step(
        name: str, scenario: str, verify_args: list[str], action, *, action_label: str = "proxy"
    ) -> None:
        print(f"\n{'='*60}\nSTEP: {name}\n{'='*60}", flush=True)
        try:
            action()
            print(f"  {action_label}: ok", flush=True)
        except Exception as exc:
            print(f"  {action_label} FAILED: {exc}", flush=True)
        code, out = run_verify(project, scenario, uid, verify_args)
        print(out, flush=True)
        results.append((name, code))

    if doc_id:
        storage_path = doc_data.get("storagePath")
        step(
            "document",
            "document",
            ["--doc-id", doc_id] + (["--storage-path", storage_path] if storage_path else []),
            lambda: proxy_request(
                proxy,
                "POST",
                "/deletion/document",
                token,
                {
                    "userId": uid,
                    "docId": doc_id,
                    "storagePath": storage_path,
                    "gsURI": doc_data.get("gsURI"),
                },
            ),
        )
    else:
        print("SKIP document: no docs", flush=True)

    if cp_id and cp_path:
        step(
            "checkpoint",
            "checkpoint",
            ["--property-id", pid, "--checkpoint-id", cp_id, "--storage-path", cp_path],
            lambda: proxy_request(
                proxy,
                "POST",
                "/deletion/checkpoint",
                token,
                {"userId": uid, "propertyId": pid, "checkpointId": cp_id},
            ),
        )
    else:
        print("SKIP checkpoint: none found", flush=True)

    if session_id:
        step(
            "session",
            "session",
            ["--session-id", session_id],
            lambda: proxy_request(
                proxy,
                "POST",
                "/deletion/session",
                token,
                {"userId": uid, "sessionId": session_id},
            ),
        )
    else:
        print("SKIP session: none found", flush=True)

    if provider_id:
        provider_ref = (
            db.collection("users")
            .document(uid)
            .collection("properties")
            .document(pid)
            .collection("savedProviders")
            .document(provider_id)
        )
        step(
            "saved-provider",
            "saved-provider",
            ["--property-id", pid, "--provider-id", provider_id],
            lambda: provider_ref.delete(),
            action_label="firestore",
        )
    else:
        step(
            "saved-provider (none on property)",
            "saved-provider",
            ["--property-id", pid, "--provider-id", "__none__"],
            lambda: None,
        )

    print(f"\n{'='*60}\nSTEP: property delete\n{'='*60}", flush=True)
    property_job_id = f"property_{pid}"
    try:
        reset_stuck_job(db, uid, property_job_id)
        data = proxy_request(
            proxy,
            "POST",
            "/deletion/property",
            token,
            {"userId": uid, "propertyId": pid},
        )
        job_id = data.get("jobId") or property_job_id
        print(f"  started job {job_id}", flush=True)
        status = wait_job_via_proxy(proxy, token, job_id, 300)
        print(f"  job finished: {status}", flush=True)
    except Exception as exc:
        print(f"  property FAILED: {exc}", flush=True)
    code, out = run_verify(project, "property", uid, ["--property-id", pid, "--wait-seconds", "5"])
    print(out, flush=True)
    results.append(("property", code))

    print(f"\n{'='*60}\nSTEP: user erasure\n{'='*60}", flush=True)
    admin_secret = (os.environ.get("DATA_ERASURE_ADMIN_SECRET") or "").strip()
    user_job_id = f"user_{uid}"
    if not admin_secret:
        print("  SKIP: DATA_ERASURE_ADMIN_SECRET not set in gcp/proxy/.env", flush=True)
        results.append(("user", 1))
    else:
        try:
            reset_stuck_job(db, uid, user_job_id)
            data = proxy_request(
                proxy,
                "POST",
                "/deletion/user",
                "",
                {"userId": uid},
                extra_headers={"X-Data-Erasure-Admin-Secret": admin_secret},
            )
            job_id = data.get("jobId") or user_job_id
            print(f"  started job {job_id}", flush=True)
            status = wait_job_via_proxy(proxy, token, job_id, 300)
            print(f"  job finished: {status}", flush=True)
        except Exception as exc:
            print(f"  user FAILED: {exc}", flush=True)
        code, out = run_verify(project, "user", uid, ["--wait-seconds", "5"])
        print(out, flush=True)
        results.append(("user", code))

    print(f"\n{'='*60}\nSUMMARY\n{'='*60}", flush=True)
    for name, code in results:
        print(f"  {'PASS' if code == 0 else 'FAIL'}: {name} (exit={code})", flush=True)
    return 0 if all(c == 0 for _, c in results) else 1


if __name__ == "__main__":
    sys.exit(main())
