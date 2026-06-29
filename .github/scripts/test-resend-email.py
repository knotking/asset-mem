#!/usr/bin/env python3
"""Send a one-off test email via Resend (local smoke test)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

RESEND_API_URL = "https://api.resend.com/emails"
USER_AGENT = "HomeApp-daily-health-check/1.0 (BuildGeekAI/HomeApp)"
DEFAULT_FROM = "onboarding@resend.dev"
DEFAULT_TO = "prakashbask@buildgeek.ai"


def main() -> int:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        print("Set RESEND_API_KEY in the environment.", file=sys.stderr)
        return 1

    from_addr = os.environ.get("HEALTH_CHECK_EMAIL_FROM", DEFAULT_FROM).strip()
    to_addr = os.environ.get("HEALTH_CHECK_EMAIL_TO", DEFAULT_TO).strip()

    payload = {
        "from": from_addr,
        "to": [to_addr],
        "subject": "Resend smoke test — homegeek-prod health check",
        "html": (
            "<p>This is a local smoke test from "
            "<code>.github/scripts/test-resend-email.py</code>.</p>"
        ),
    }
    request = urllib.request.Request(
        RESEND_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
        print(f"OK ({response.status}): {body}")
        return 0
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"FAILED ({exc.code}): {detail}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
