#!/usr/bin/env python3
"""Load traffic-tier hardware expectations and export for GHA / gcloud audit."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPECTATIONS_PATH = REPO_ROOT / "docs" / "deployment" / "hardware-expectations.yaml"

WORKER_KEYS = {
    "pubsub-checkpoint-analysis": "WORKER_CHECKPOINT_ANALYSIS",
    "pubsub-document-analysis": "WORKER_DOCUMENT_ANALYSIS",
    "pubsub-checkpoint-metrics": "WORKER_CHECKPOINT_METRICS",
    "pubsub-to-user-docs": "WORKER_USER_DOCS",
    "pubsub-report-generation": "WORKER_REPORT_GENERATION",
}


def _load_yaml(path: Path) -> dict[str, Any]:
    if yaml is None:
        raise RuntimeError("PyYAML required: pip install pyyaml")
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def get_tier_config(environment: str, tier: str) -> dict[str, Any]:
    data = _load_yaml(EXPECTATIONS_PATH)
    env_block = data.get(environment)
    if not env_block:
        raise KeyError(f"Unknown environment: {environment}")
    tiers = env_block.get("tiers", {})
    if tier not in tiers:
        raise KeyError(f"Unknown tier {tier!r} for environment {environment!r}")
    return tiers[tier]


def tier_to_env_vars(environment: str, tier: str) -> dict[str, str]:
    cfg = get_tier_config(environment, tier)
    out: dict[str, str] = {"HARDWARE_TIER": tier}

    apphosting = cfg.get("apphosting") or {}
    for key, var in (
        ("cpu", "APPHOSTING_CPU"),
        ("memory_mib", "APPHOSTING_MEMORY_MIB"),
        ("min_instances", "APPHOSTING_MIN_INSTANCES"),
        ("max_instances", "APPHOSTING_MAX_INSTANCES"),
        ("concurrency", "APPHOSTING_CONCURRENCY"),
    ):
        val = apphosting.get(key)
        if val is not None:
            out[var] = str(val)

    proxy = cfg.get("proxy") or {}
    for key, var in (
        ("memory", "PROXY_MEMORY"),
        ("cpu", "PROXY_CPU"),
        ("min_instances", "PROXY_MIN_INSTANCES"),
        ("max_instances", "PROXY_MAX_INSTANCES"),
        ("concurrency", "PROXY_CONCURRENCY"),
        ("timeout_seconds", "PROXY_TIMEOUT"),
    ):
        val = proxy.get(key)
        if val is not None:
            out[var] = str(val)

    agent = cfg.get("agent") or {}
    for key, var in (
        ("min_instances", "AGENT_MIN_INSTANCES"),
        ("max_instances", "AGENT_MAX_INSTANCES"),
        ("resource_cpu", "AGENT_RESOURCE_CPU"),
        ("resource_memory", "AGENT_RESOURCE_MEMORY"),
        ("container_concurrency", "AGENT_CONTAINER_CONCURRENCY"),
    ):
        val = agent.get(key)
        if val is not None and val != "":
            out[var] = str(val)

    workers = cfg.get("workers") or {}
    for worker_name, prefix in WORKER_KEYS.items():
        w = workers.get(worker_name) or {}
        for key, suffix in (
            ("memory", "MEMORY"),
            ("max_instances", "MAX_INSTANCES"),
            ("concurrency", "CONCURRENCY"),
            ("timeout_seconds", "TIMEOUT"),
        ):
            val = w.get(key)
            if val is not None:
                out[f"{prefix}_{suffix}"] = str(val)

    return out


def export_github_env(environment: str, tier: str) -> None:
    for key, value in tier_to_env_vars(environment, tier).items():
        github_env = os.environ.get("GITHUB_ENV")
        if github_env:
            with open(github_env, "a", encoding="utf-8") as fh:
                fh.write(f"{key}={value}\n")
        print(f"export {key}={value!r}")


def export_json(environment: str, tier: str) -> None:
    print(json.dumps(tier_to_env_vars(environment, tier), indent=2))


def set_github_variables(environment: str, tier: str, repo: str) -> None:
    vars_map = tier_to_env_vars(environment, tier)
    for name, value in vars_map.items():
        subprocess.run(
            [
                "gh",
                "variable",
                "set",
                name,
                "--env",
                environment,
                "--body",
                value,
                "--repo",
                repo,
            ],
            check=True,
        )
        print(f"Set {environment} variable {name}={value}")


def proxy_service_name(environment: str) -> str:
    return f"homecare-agent-proxy-{environment}"


def _gcloud_json(args: list[str]) -> dict[str, Any] | None:
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=True)
        return json.loads(result.stdout) if result.stdout.strip() else None
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def _parse_duration_seconds(val: Any) -> int | None:
    if val is None:
        return None
    if isinstance(val, int):
        return val
    s = str(val).strip()
    if not s:
        return None
    if s.endswith("s"):
        num = s[:-1]
        if num.isdigit():
            return int(num)
    if s.isdigit():
        return int(s)
    return None


def _cloud_run_revision_template(
    data: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (template_wrapper, revision_spec) for Cloud Run v2 or Knative JSON."""
    wrapper = data.get("template")
    if not wrapper:
        spec = data.get("spec")
        if isinstance(spec, dict):
            wrapper = spec.get("template")
    if not isinstance(wrapper, dict):
        return {}, {}
    revision_spec = wrapper.get("spec")
    if not isinstance(revision_spec, dict):
        revision_spec = wrapper
    return wrapper, revision_spec


def _parse_proxy_from_describe(data: dict[str, Any]) -> dict[str, Any] | dict[str, str]:
    template_root, revision_spec = _cloud_run_revision_template(data)
    if not template_root and not revision_spec:
        return {"error": "Could not parse Cloud Run template"}

    containers = revision_spec.get("containers") or template_root.get("containers") or [{}]
    container = containers[0] if containers else {}
    resources = container.get("resources", {}).get("limits", {})
    annotations = (
        template_root.get("metadata", {}).get("annotations")
        or data.get("metadata", {}).get("annotations")
        or {}
    )
    scaling = template_root.get("scaling") or revision_spec.get("scaling") or {}

    min_inst = scaling.get("minInstanceCount")
    if min_inst is None:
        min_inst = annotations.get("autoscaling.knative.dev/minScale", "0")

    max_inst = scaling.get("maxInstanceCount")
    if max_inst is None:
        max_inst = annotations.get("autoscaling.knative.dev/maxScale")

    concurrency = revision_spec.get("containerConcurrency")
    if concurrency is None:
        concurrency = template_root.get("maxInstanceRequestConcurrency")

    timeout_raw = revision_spec.get("timeoutSeconds")
    if timeout_raw is None:
        timeout_raw = template_root.get("timeout")

    return {
        "memory": resources.get("memory"),
        "cpu": resources.get("cpu"),
        "min_instances": str(min_inst) if min_inst is not None else None,
        "max_instances": max_inst,
        "concurrency": concurrency,
        "timeout_seconds": _parse_duration_seconds(timeout_raw),
    }


def fetch_live_proxy(region: str, project: str, environment: str) -> dict[str, Any]:
    name = proxy_service_name(environment)
    data = _gcloud_json(
        [
            "gcloud",
            "run",
            "services",
            "describe",
            name,
            "--region",
            region,
            "--project",
            project,
            "--format=json",
        ]
    )
    if not data:
        return {"error": f"Could not describe Cloud Run service {name}"}
    parsed = _parse_proxy_from_describe(data)
    if "error" in parsed:
        return {"error": f"Could not parse Cloud Run service {name}"}
    return parsed


def fetch_live_function(
    region: str, project: str, function_name: str
) -> dict[str, Any]:
    data = _gcloud_json(
        [
            "gcloud",
            "functions",
            "describe",
            function_name,
            "--gen2",
            "--region",
            region,
            "--project",
            project,
            "--format=json",
        ]
    )
    if not data:
        return {"error": f"Could not describe function {function_name}"}
    service_config = data.get("serviceConfig") or {}
    return {
        "memory": service_config.get("availableMemory"),
        "max_instances": service_config.get("maxInstanceCount"),
        "concurrency": service_config.get("maxInstanceRequestConcurrency"),
        "timeout_seconds": service_config.get("timeoutSeconds"),
    }


def _normalize_memory(val: str | None) -> str | None:
    if val is None:
        return None
    v = str(val).strip()
    if v.endswith("Mi") or v.endswith("Gi"):
        return v
    if v.endswith("M"):
        return v[:-1] + "Mi"
    if v.endswith("G"):
        return v[:-1] + "Gi"
    return v


def _normalize_cpu(val: str | None) -> str | None:
    if val is None:
        return None
    v = str(val).strip()
    if v.endswith("m") and v[:-1].isdigit():
        millicores = int(v[:-1])
        if millicores % 1000 == 0:
            return str(millicores // 1000)
    return v


def _compare_field(label: str, expected: Any, actual: Any, mismatches: list[str]) -> None:
    if expected is None:
        return
    exp = str(expected)
    act = str(actual) if actual is not None else "MISSING"
    if ".cpu" in label:
        if _normalize_cpu(exp) == _normalize_cpu(act):
            return
    if _normalize_memory(exp) == _normalize_memory(act) or exp == act:
        return
    mismatches.append(f"{label}: expected {exp}, got {act}")


def audit_live(
    environment: str, tier: str, region: str, project: str
) -> tuple[list[str], str]:
    cfg = get_tier_config(environment, tier)
    mismatches: list[str] = []
    lines = [f"# Hardware audit: {environment} / tier={tier}", ""]

    proxy_exp = cfg.get("proxy") or {}
    proxy_live = fetch_live_proxy(region, project, environment)
    lines.append("## Proxy")
    lines.append(f"```json\n{json.dumps(proxy_live, indent=2)}\n```")
    if "error" not in proxy_live:
        _compare_field("proxy.memory", proxy_exp.get("memory"), proxy_live.get("memory"), mismatches)
        _compare_field("proxy.cpu", proxy_exp.get("cpu"), proxy_live.get("cpu"), mismatches)
        _compare_field(
            "proxy.min_instances",
            proxy_exp.get("min_instances"),
            proxy_live.get("min_instances"),
            mismatches,
        )
        _compare_field(
            "proxy.max_instances",
            proxy_exp.get("max_instances"),
            proxy_live.get("max_instances"),
            mismatches,
        )
        _compare_field(
            "proxy.concurrency",
            proxy_exp.get("concurrency"),
            proxy_live.get("concurrency"),
            mismatches,
        )
        _compare_field(
            "proxy.timeout_seconds",
            proxy_exp.get("timeout_seconds"),
            proxy_live.get("timeout_seconds"),
            mismatches,
        )
    else:
        mismatches.append(proxy_live["error"])

    workers_exp = cfg.get("workers") or {}
    lines.append("")
    lines.append("## Workers")
    for worker_name in WORKER_KEYS:
        fn = f"{worker_name}-{environment}"
        w_exp = workers_exp.get(worker_name) or {}
        w_live = fetch_live_function(region, project, fn)
        lines.append(f"### {fn}")
        lines.append(f"```json\n{json.dumps(w_live, indent=2)}\n```")
        if "error" in w_live:
            mismatches.append(w_live["error"])
            continue
        prefix = worker_name
        _compare_field(
            f"{prefix}.memory", w_exp.get("memory"), w_live.get("memory"), mismatches
        )
        _compare_field(
            f"{prefix}.max_instances",
            w_exp.get("max_instances"),
            w_live.get("max_instances"),
            mismatches,
        )
        _compare_field(
            f"{prefix}.concurrency",
            w_exp.get("concurrency"),
            w_live.get("concurrency"),
            mismatches,
        )
        _compare_field(
            f"{prefix}.timeout_seconds",
            w_exp.get("timeout_seconds"),
            w_live.get("timeout_seconds"),
            mismatches,
        )

    lines.append("")
    lines.append("## Agent Engine")
    lines.append(
        "Agent resource limits are applied via deploy-homecare-agent; "
        "live describe may be limited — verify deploy workflow env AGENT_* vars."
    )

    apphosting = cfg.get("apphosting") or {}
    lines.append("")
    lines.append("## App Hosting")
    lines.append(
        f"Expected runConfig: ```json\n{json.dumps(apphosting, indent=2)}\n```\n"
        "Live App Hosting runConfig: apply via gcloud run update on backend service "
        "or commit apphosting overlay + rollout."
    )

    if mismatches:
        lines.append("")
        lines.append("## Mismatches")
        for m in mismatches:
            lines.append(f"- {m}")

    return mismatches, "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Hardware tier utilities")
    parser.add_argument("--environment", "-e", required=True, choices=["staging", "prod"])
    parser.add_argument(
        "--tier",
        "-t",
        required=True,
        choices=["idle", "warm", "ph", "scale_10x", "scale_100x"],
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("export-env", help="Write GITHUB_ENV / print export lines")
    sub.add_parser("export-json", help="Print JSON map of env vars")

    p_gh = sub.add_parser("set-github-vars", help="Set GitHub environment variables via gh CLI")
    p_gh.add_argument("--repo", required=True, help="owner/repo")

    p_audit = sub.add_parser("audit", help="Compare live GCP to expectations")
    p_audit.add_argument("--region", default=os.environ.get("GCP_REGION", "us-central1"))
    p_audit.add_argument("--project", default=os.environ.get("GCP_PROJECT_ID", ""))
    p_audit.add_argument("--report", help="Write markdown report to file")
    p_audit.add_argument(
        "--fail-on-mismatch",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Exit 1 when live GCP differs from tier (default: true). "
        "Use --no-fail-on-mismatch for report-only runs.",
    )

    args = parser.parse_args()

    if args.command == "export-env":
        export_github_env(args.environment, args.tier)
        return 0
    if args.command == "export-json":
        export_json(args.environment, args.tier)
        return 0
    if args.command == "set-github-vars":
        set_github_variables(args.environment, args.tier, args.repo)
        return 0
    if args.command == "audit":
        if not args.project:
            print("GCP_PROJECT_ID or --project required", file=sys.stderr)
            return 1
        mismatches, report = audit_live(args.environment, args.tier, args.region, args.project)
        if args.report:
            Path(args.report).write_text(report, encoding="utf-8")
        else:
            print(report)
        for mismatch in mismatches:
            print(f"::warning title=Hardware mismatch::{mismatch}")
        if mismatches and args.fail_on_mismatch:
            print(
                f"::error::{len(mismatches)} hardware mismatch(es); "
                "see report artifact or use --no-fail-on-mismatch for report-only",
                file=sys.stderr,
            )
            return 1
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
