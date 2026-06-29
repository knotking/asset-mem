#!/usr/bin/env python3
"""Collect homegeek-prod health signals, summarize with Vertex AI, log token usage."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

FIRESTORE_COLLECTION = "ops_daily_health_checks"
DEFAULT_MODEL = "gemini-3.1-flash-lite"
DEFAULT_REGION = "us-central1"
DEFAULT_VERTEX_LOCATION = "global"
DEFAULT_WINDOW_HOURS = 24
DEFAULT_EMAIL_TO = "prakashbask@buildgeek.ai"
DEFAULT_EMAIL_FROM = "AssetMem Ops <ops@buildgeek.ai>"
RESEND_API_URL = "https://api.resend.com/emails"

WEBAPP_URL = "https://prod--homegeek-prod.us-central1.hosted.app/"
PROXY_HEALTH_URL = "https://homecare-agent-proxy-prod-7qzcsllbxq-uc.a.run.app/health"


def env_or_default(name: str, default: str) -> str:
    value = os.environ.get(name)
    if value is None or not str(value).strip():
        return default
    return str(value).strip()


def run_cmd(args: list[str], *, check: bool = True) -> str:
    result = subprocess.run(
        args,
        capture_output=True,
        text=True,
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {' '.join(args)}\n"
            f"{result.stderr.strip() or result.stdout.strip()}"
        )
    return result.stdout.strip()


def http_probe(url: str, timeout: float = 15.0) -> dict[str, Any]:
    started = datetime.now(timezone.utc)
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(512)
            return {
                "url": url,
                "status": resp.status,
                "ok": 200 <= resp.status < 300,
                "latencyMs": int(
                    (datetime.now(timezone.utc) - started).total_seconds() * 1000
                ),
                "bytes": len(body),
            }
    except urllib.error.HTTPError as exc:
        return {
            "url": url,
            "status": exc.code,
            "ok": False,
            "latencyMs": int(
                (datetime.now(timezone.utc) - started).total_seconds() * 1000
            ),
            "error": str(exc),
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "url": url,
            "status": None,
            "ok": False,
            "latencyMs": int(
                (datetime.now(timezone.utc) - started).total_seconds() * 1000
            ),
            "error": str(exc),
        }


def gcloud_logging_count(
    project_id: str, filter_expr: str, limit: int = 10_000
) -> int:
    out = run_cmd(
        [
            "gcloud",
            "logging",
            "read",
            filter_expr,
            f"--project={project_id}",
            f"--limit={limit}",
            "--format=value(insertId)",
        ],
        check=False,
    )
    if not out:
        return 0
    return len([line for line in out.splitlines() if line.strip()])


def collect_cloud_run_status(project_id: str, region: str) -> list[dict[str, Any]]:
    out = run_cmd(
        [
            "gcloud",
            "run",
            "services",
            "list",
            f"--project={project_id}",
            f"--region={region}",
            "--format=json(name,status.conditions)",
        ]
    )
    services = json.loads(out or "[]")
    rows: list[dict[str, Any]] = []
    for svc in services:
        name = svc.get("name", "")
        conditions = svc.get("status", {}).get("conditions", [])
        ready = any(
            c.get("type") == "Ready" and c.get("status") == "True" for c in conditions
        )
        rows.append({"name": name, "ready": ready})
    return rows


def collect_http_log_stats(
    project_id: str, service_name: str, since_iso: str
) -> dict[str, Any]:
    base = (
        f'resource.type="cloud_run_revision" '
        f'AND resource.labels.service_name="{service_name}" '
        f'AND httpRequest.status>0 AND timestamp>="{since_iso}"'
    )
    statuses: Counter[str] = Counter()
    out = run_cmd(
        [
            "gcloud",
            "logging",
            "read",
            base,
            f"--project={project_id}",
            "--limit=5000",
            "--format=value(httpRequest.status)",
        ],
        check=False,
    )
    for line in out.splitlines():
        line = line.strip()
        if line.isdigit():
            statuses[line] += 1
    return {
        "service": service_name,
        "httpStatusCounts": dict(statuses),
        "sampledRequests": sum(statuses.values()),
    }


def collect_proxy_activity(project_id: str, since_iso: str) -> dict[str, Any]:
    out = run_cmd(
        [
            "gcloud",
            "logging",
            "read",
            (
                f'resource.type="cloud_run_revision" '
                f'AND resource.labels.service_name="homecare-agent-proxy-prod" '
                f'AND timestamp>="{since_iso}"'
            ),
            f"--project={project_id}",
            "--limit=5000",
            "--format=value(textPayload,httpRequest.requestUrl,httpRequest.status,httpRequest.latency)",
        ],
        check=False,
    )
    users: set[str] = set()
    streams = 0
    sessions = 0
    stream_latencies: list[float] = []
    for line in out.splitlines():
        m = re.search(r"auth_uid=([A-Za-z0-9_-]+)", line)
        if m and m.group(1) != "-":
            users.add(m.group(1))
        if "POST /agent-session" in line and "200 OK" in line:
            sessions += 1
        if "/firebase-agent-stream" in line:
            parts = line.split("\t")
            if parts and parts[-1].isdigit() and parts[-1] == "200":
                streams += 1
            if len(parts) >= 2 and parts[-1].endswith("s"):
                try:
                    stream_latencies.append(float(parts[-1][:-1]))
                except ValueError:
                    pass
    return {
        "uniqueAuthUsers": len(users),
        "agentSessionCreates": sessions,
        "agentStreams200": streams,
        "streamLatencySeconds": {
            "count": len(stream_latencies),
            "max": max(stream_latencies) if stream_latencies else None,
            "avg": (
                round(sum(stream_latencies) / len(stream_latencies), 2)
                if stream_latencies
                else None
            ),
        },
    }


def count_support_requests(project_id: str, since: datetime) -> dict[str, Any]:
    try:
        from google.cloud import firestore
    except ImportError as exc:
        return {"error": f"firestore client unavailable: {exc}"}

    db = firestore.Client(project=project_id)
    users = list(db.collection("support_requests").stream())
    new_messages = 0
    for user_doc in users:
        for msg in user_doc.reference.collection("messages").stream():
            data = msg.to_dict() or {}
            created = data.get("createdAt")
            if hasattr(created, "timestamp"):
                created_at = datetime.fromtimestamp(
                    created.timestamp(), tz=timezone.utc
                )
                if created_at >= since:
                    new_messages += 1
    return {
        "usersWithThreads": len(users),
        "newMessagesInWindow": new_messages,
    }


def collect_github_actions(repo: str, since_iso: str) -> dict[str, Any]:
    if not repo:
        return {"skipped": True, "reason": "GITHUB_REPOSITORY unset"}
    out = run_cmd(
        [
            "gh",
            "run",
            "list",
            "--repo",
            repo,
            "--limit",
            "40",
            "--json",
            "conclusion,displayTitle,createdAt,workflowName,event",
        ],
        check=False,
    )
    if not out:
        return {"failedRuns": [], "totalRecent": 0}
    runs = json.loads(out)
    failed = [
        r
        for r in runs
        if r.get("createdAt", "") >= since_iso.replace("Z", "")
        and r.get("conclusion") not in (None, "success", "skipped", "cancelled")
    ]
    return {
        "totalRecent": len(runs),
        "failedRunsInWindow": len(failed),
        "failedRuns": failed[:10],
    }


def collect_metrics(
    project_id: str, region: str, window_hours: int, repo: str
) -> dict[str, Any]:
    since = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    since_iso = since.strftime("%Y-%m-%dT%H:%M:%SZ")

    metrics: dict[str, Any] = {
        "projectId": project_id,
        "region": region,
        "windowHours": window_hours,
        "windowStart": since_iso,
        "collectedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "probes": [
            http_probe(WEBAPP_URL),
            http_probe(PROXY_HEALTH_URL),
        ],
        "cloudRun": collect_cloud_run_status(project_id, region),
        "httpLogs": [
            collect_http_log_stats(project_id, "prod", since_iso),
            collect_http_log_stats(project_id, "homecare-agent-proxy-prod", since_iso),
        ],
        "errors": {
            "http5xx": gcloud_logging_count(
                project_id,
                (
                    f'resource.type="cloud_run_revision" AND httpRequest.status>=500 '
                    f'AND timestamp>="{since_iso}"'
                ),
            ),
            "severityError": gcloud_logging_count(
                project_id,
                (
                    f'severity>=ERROR AND NOT logName=~"cloudaudit" '
                    f'AND timestamp>="{since_iso}"'
                ),
            ),
        },
        "proxyActivity": collect_proxy_activity(project_id, since_iso),
        "supportRequests": count_support_requests(project_id, since),
        "githubActions": collect_github_actions(repo, since_iso),
        "githubRunId": os.environ.get("GITHUB_RUN_ID"),
        "githubRunUrl": os.environ.get("GITHUB_SERVER_URL", "")
        and os.environ.get("GITHUB_REPOSITORY")
        and (
            f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}/"
            f"actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"
        ),
    }
    return metrics


def summarize_with_vertex(
    metrics: dict[str, Any],
    *,
    project_id: str,
    location: str,
    model: str,
) -> tuple[str, dict[str, Any]]:
    from google import genai

    model = (model or DEFAULT_MODEL).strip()
    if not model:
        raise ValueError("Vertex model is required")

    client = genai.Client(vertexai=True, project=project_id, location=location)
    prompt = (
        "You are an SRE writing a daily production health brief for homegeek-prod "
        "(AssetMem AI). Use ONLY the JSON metrics below. Be concise (markdown, "
        "under 400 words). Sections: Overall status (one line), What went well, "
        "Issues / risks, Real user activity, Noise to ignore (bots/scanners), "
        "Action items (only if needed). Do not invent data.\n\n"
        f"METRICS_JSON:\n{json.dumps(metrics, indent=2, default=str)}"
    )
    response = client.models.generate_content(model=model, contents=prompt)
    summary = (response.text or "").strip()
    usage = response.usage_metadata
    token_usage = {
        "model": model,
        "promptTokenCount": getattr(usage, "prompt_token_count", None),
        "candidatesTokenCount": getattr(usage, "candidates_token_count", None),
        "totalTokenCount": getattr(usage, "total_token_count", None),
    }
    if token_usage["totalTokenCount"] is None:
        prompt_n = token_usage["promptTokenCount"] or 0
        cand_n = token_usage["candidatesTokenCount"] or 0
        token_usage["totalTokenCount"] = prompt_n + cand_n
    return summary, token_usage


def persist_run(
    project_id: str,
    *,
    metrics: dict[str, Any],
    summary: str,
    token_usage: dict[str, Any],
) -> str:
    run_id = os.environ.get("GITHUB_RUN_ID") or datetime.now(timezone.utc).strftime(
        "%Y%m%dT%H%M%SZ"
    )
    doc = {
        "workflow": "daily-prod-health-check",
        "projectId": project_id,
        "runId": run_id,
        "createdAt": datetime.now(timezone.utc),
        "metrics": metrics,
        "summary": summary,
        "llm": token_usage,
    }

    persist_firestore = os.environ.get(
        "HEALTH_CHECK_PERSIST_FIRESTORE", ""
    ).lower() in ("1", "true", "yes")
    if persist_firestore:
        try:
            from google.cloud import firestore

            db = firestore.Client(project=project_id)
            db.collection(FIRESTORE_COLLECTION).document(str(run_id)).set(doc)
        except Exception as exc:  # noqa: BLE001
            print(f"::warning::Firestore persist failed: {exc}", file=sys.stderr)
    else:
        print(
            "Skipping Firestore persist (read-only SA). "
            "Set HEALTH_CHECK_PERSIST_FIRESTORE=true + roles/datastore.user to enable.",
            file=sys.stderr,
        )

    log_payload = {
        "workflow": "daily-prod-health-check",
        "runId": run_id,
        "projectId": project_id,
        "summary": summary,
        "llm": token_usage,
        "windowHours": metrics.get("windowHours"),
        "errors": metrics.get("errors"),
        "proxyActivity": metrics.get("proxyActivity"),
    }
    run_cmd(
        [
            "gcloud",
            "logging",
            "write",
            "homeapp-daily-health-check",
            json.dumps(log_payload),
            f"--project={project_id}",
            "--severity=INFO",
            "--payload-type=json",
        ],
        check=False,
    )
    return str(run_id)


def parse_email_recipients(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def send_resend_email(
    *,
    api_key: str,
    from_addr: str,
    to_addrs: list[str],
    subject: str,
    summary: str,
    token_usage: dict[str, Any],
    run_url: str | None,
) -> None:
    if not to_addrs:
        print("No email recipients configured; skipping Resend.", file=sys.stderr)
        return
    if not api_key:
        print("::warning::RESEND_API_KEY not set; skipping email", file=sys.stderr)
        return
    if not from_addr:
        print("::warning::HEALTH_CHECK_EMAIL_FROM not set; skipping email", file=sys.stderr)
        return

    safe_summary = html.escape(summary)
    token_lines = [
        f"Model: {token_usage.get('model')}",
        f"Prompt tokens: {token_usage.get('promptTokenCount')}",
        f"Output tokens: {token_usage.get('candidatesTokenCount')}",
        f"Total tokens: {token_usage.get('totalTokenCount')}",
    ]
    token_html = "<br>".join(html.escape(line) for line in token_lines)
    run_link = (
        f'<p><a href="{html.escape(run_url)}">View GitHub Actions run</a></p>'
        if run_url
        else ""
    )
    body_html = (
        f"<h2>HomeGeek Prod Daily Health Check</h2>"
        f"<pre style=\"white-space:pre-wrap;font-family:monospace\">{safe_summary}</pre>"
        f"<h3>LLM token usage</h3><p>{token_html}</p>{run_link}"
    )

    payload = {
        "from": from_addr,
        "to": to_addrs,
        "subject": subject,
        "html": body_html,
    }
    request = urllib.request.Request(
        RESEND_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
        print(f"Sent health summary email to {', '.join(to_addrs)} via Resend.")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Resend API error ({exc.code}): {detail}") from exc


def write_github_step_summary(summary: str, token_usage: dict[str, Any]) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("## HomeGeek Prod Daily Health Check\n\n")
        fh.write(summary)
        fh.write("\n\n### LLM token usage\n\n")
        fh.write(f"- Model: `{token_usage.get('model')}`\n")
        fh.write(f"- Prompt tokens: {token_usage.get('promptTokenCount')}\n")
        fh.write(f"- Output tokens: {token_usage.get('candidatesTokenCount')}\n")
        fh.write(f"- Total tokens: {token_usage.get('totalTokenCount')}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Daily prod health check + Vertex summary")
    parser.add_argument("--project-id", default=os.environ.get("GCP_PROJECT_ID"))
    parser.add_argument("--region", default=os.environ.get("GCP_REGION", DEFAULT_REGION))
    parser.add_argument("--window-hours", type=int, default=DEFAULT_WINDOW_HOURS)
    parser.add_argument("--model", default=env_or_default("HEALTH_CHECK_LLM_MODEL", DEFAULT_MODEL))
    parser.add_argument(
        "--vertex-location",
        default=env_or_default("VERTEX_LOCATION", DEFAULT_VERTEX_LOCATION),
    )
    parser.add_argument("--skip-vertex", action="store_true")
    parser.add_argument("--skip-email", action="store_true")
    parser.add_argument(
        "--email-to",
        default=env_or_default("HEALTH_CHECK_EMAIL_TO", DEFAULT_EMAIL_TO),
        help="Comma-separated Resend recipients (empty to disable)",
    )
    parser.add_argument(
        "--email-from",
        default=env_or_default("HEALTH_CHECK_EMAIL_FROM", DEFAULT_EMAIL_FROM),
    )
    parser.add_argument(
        "--artifact-path",
        default=os.environ.get("HEALTH_CHECK_ARTIFACT_PATH"),
        help="Optional path to write full run JSON for CI artifacts",
    )
    args = parser.parse_args()
    args.model = (args.model or DEFAULT_MODEL).strip()

    if not args.project_id:
        print("::error::GCP_PROJECT_ID is required", file=sys.stderr)
        return 1

    print(f"Collecting metrics for {args.project_id} (last {args.window_hours}h)...")
    metrics = collect_metrics(
        args.project_id,
        args.region,
        args.window_hours,
        os.environ.get("GITHUB_REPOSITORY", ""),
    )

    if args.skip_vertex:
        summary = json.dumps(metrics, indent=2)
        token_usage = {"model": None, "skipped": True}
    else:
        print(f"Summarizing with Vertex model {args.model}...")
        summary, token_usage = summarize_with_vertex(
            metrics,
            project_id=args.project_id,
            location=args.vertex_location,
            model=args.model,
        )

    run_id = persist_run(
        args.project_id, metrics=metrics, summary=summary, token_usage=token_usage
    )
    if args.artifact_path:
        artifact = {
            "runId": run_id,
            "metrics": metrics,
            "summary": summary,
            "llm": token_usage,
        }
        with open(args.artifact_path, "w", encoding="utf-8") as fh:
            json.dump(artifact, fh, indent=2, default=str)

    write_github_step_summary(summary, token_usage)

    if not args.skip_email:
        recipients = parse_email_recipients(args.email_to)
        date_label = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        send_resend_email(
            api_key=os.environ.get("RESEND_API_KEY", "").strip(),
            from_addr=(args.email_from or DEFAULT_EMAIL_FROM).strip(),
            to_addrs=recipients,
            subject=f"homegeek-prod daily health — {date_label}",
            summary=summary,
            token_usage=token_usage,
            run_url=metrics.get("githubRunUrl"),
        )

    print("\n--- SUMMARY ---\n")
    print(summary)
    print("\n--- TOKEN USAGE ---")
    print(json.dumps(token_usage, indent=2))
    print(f"\nPersisted run id: {run_id} (Cloud Logging: homeapp-daily-health-check)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
