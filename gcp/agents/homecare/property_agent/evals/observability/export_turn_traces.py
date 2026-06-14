"""
Export normalized turn traces from saved ``adk web`` stdout logs.

Usage:
    uv run python -m property_agent.evals.observability.export_turn_traces web-log*
    uv run python -m property_agent.evals.observability.export_turn_traces \\
        web-log-session-1 --out property_agent/evals/observability/baselines/traces.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from property_agent.evals.observability.turn_trace import export_traces_from_logs

DEFAULT_OUT = (
    Path(__file__).resolve().parent / "baselines" / "turn_traces_sample.json"
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Export turn traces from adk web logs")
    parser.add_argument("logs", nargs="+", help="Paths or globs to adk web stdout captures")
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args(argv)

    paths: list[Path] = []
    for pattern in args.logs:
        expanded = list(Path().glob(pattern))
        if expanded:
            paths.extend(expanded)
        else:
            paths.append(Path(pattern))

    report = export_traces_from_logs(paths)
    payload = json.dumps(report, indent=2, sort_keys=True)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload + "\n", encoding="utf-8")
        print(f"Wrote {args.out} ({report['total_traces']} traces)")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
