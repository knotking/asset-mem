#!/usr/bin/env python3
"""
Exercise the proxy streaming endpoint so Reasoning Engine runs and token totals
are persisted to Firestore (llm_token_usage/{userId}).

Prerequisites
-------------
- Proxy running locally (e.g. uvicorn from gcp/proxy/api) or a reachable Cloud Run URL.
- TEST_FIREBASE_ID_TOKEN (Bearer) for the test user; for local runs GCP credentials
  with Firestore write access (Application Default Credentials).
- REASONING_ENGINE_ID and Vertex config must be valid or the stream will fail before
  usage is recorded.

Usage
-----
  cd gcp/proxy
  export FIREBASE_WEBHOOK_SECRET=...   # from .env / .env.staging
  export TEST_USER_ID=your-firebase-uid
  python scripts/test_token_usage_request.py

  # Optional
  export PROXY_BASE_URL=http://127.0.0.1:8080
  export TEST_USER_QUERY="hello"   # default is already "hello"

Sends ``user_query`` (default ``hello``) and **waits for the full HTTP response body**
(the default uses a non-streaming ``POST`` so the client does not return until the
proxy finishes the Reasoning Engine stream and closes the response). Use
``--stream-chunks`` to print chunks as they arrive (still drains fully before exit).

After a successful run, check Firestore document llm_token_usage/{TEST_USER_ID} for
updated counters (and server logs for "Recorded token usage" / "Token usage:" lines).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import httpx
except ImportError:
    print("Install httpx: pip install httpx", file=sys.stderr)
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore


def _load_env() -> None:
    if not load_dotenv:
        return
    proxy_root = Path(__file__).resolve().parent.parent
    for name in (".env", ".env.staging"):
        p = proxy_root / name
        if p.is_file():
            load_dotenv(p)
            break


def main() -> int:
    _load_env()

    parser = argparse.ArgumentParser(description="POST to proxy firebase-agent-stream to test token usage.")
    parser.add_argument(
        "--query",
        default=os.environ.get("TEST_USER_QUERY", "hello"),
        help='user_query sent to the agent (default: "hello")',
    )
    parser.add_argument(
        "--session-id",
        default=os.environ.get("TEST_SESSION_ID", ""),
        help="Optional Vertex session id; empty lets the server create one",
    )
    parser.add_argument(
        "--stream-chunks",
        action="store_true",
        help="Use HTTP streaming read (iter_bytes); default is buffered POST until full body is received",
    )
    args = parser.parse_args()

    base = os.environ.get("PROXY_BASE_URL", "http://127.0.0.1:8080").rstrip("/")
    user_id = os.environ.get("TEST_USER_ID", "").strip()
    id_token = os.environ.get("TEST_FIREBASE_ID_TOKEN", "").strip()

    if not user_id:
        print("Set TEST_USER_ID to a real Firebase user uid", file=sys.stderr)
        return 1
    if not id_token:
        print(
            "Set TEST_FIREBASE_ID_TOKEN to a Firebase ID token (Bearer) for the test user",
            file=sys.stderr,
        )
        return 1

    url = f"{base}/firebase-agent-stream"
    payload = {
        "user_id": user_id,
        "user_query": args.query,
        "session_id": args.session_id,
        "context_doc_uris": [],
        "property_address": "",
    }

    print(f"POST {url}", flush=True)
    print(f"user_id={user_id!r}", flush=True)
    print(f"query={args.query!r}", flush=True)
    if args.stream_chunks:
        print("Mode: streaming read (chunks to stdout, drain until EOF)...", flush=True)
    else:
        print("Mode: buffered POST (wait for full response body)...", flush=True)

    headers = {"Authorization": f"Bearer {id_token}"}
    timeout = httpx.Timeout(300.0, connect=30.0)
    try:
        with httpx.Client(timeout=timeout) as client:
            if args.stream_chunks:
                with client.stream("POST", url, json=payload, headers=headers) as response:
                    print(f"HTTP {response.status_code}", flush=True)
                    response.raise_for_status()
                    print("--- response body ---", flush=True)
                    n = 0
                    for chunk in response.iter_bytes():
                        if chunk:
                            sys.stdout.buffer.write(chunk)
                            sys.stdout.buffer.flush()
                            n += len(chunk)
                    print(f"\n--- response complete ({n} bytes) ---", flush=True)
            else:
                response = client.post(url, json=payload, headers=headers)
                print(f"HTTP {response.status_code}", flush=True)
                response.raise_for_status()
                print("--- response body ---", flush=True)
                body = response.content
                sys.stdout.buffer.write(body)
                sys.stdout.buffer.flush()
                print(f"\n--- response complete ({len(body)} bytes) ---", flush=True)
    except httpx.HTTPStatusError as e:
        print(f"HTTP error: {e.response.status_code} {e.response.text[:500]}", file=sys.stderr)
        return 1
    except httpx.RequestError as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return 1

    print(
        "\nIf the agent ran successfully, check Firestore: "
        f"llm_token_usage/{user_id} (and proxy logs for token usage lines).",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
