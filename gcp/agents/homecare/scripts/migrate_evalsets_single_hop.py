#!/usr/bin/env python3
"""Rewrite legacy evalset trajectories: drop doculink transfer hop, author=property_agent."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

EVALS = Path(__file__).resolve().parents[1] / "property_agent" / "evals"

def _is_transfer_call(event: dict[str, Any]) -> bool:
    parts = (event.get("content") or {}).get("parts") or []
    for part in parts:
        if not isinstance(part, dict):
            continue
        fc = part.get("function_call")
        if isinstance(fc, dict) and fc.get("name") == "transfer_to_agent":
            args = fc.get("args") or {}
            if args.get("agent_name") == "doculink_agent":
                return True
    return False


def _is_transfer_response(event: dict[str, Any]) -> bool:
    parts = (event.get("content") or {}).get("parts") or []
    for part in parts:
        if not isinstance(part, dict):
            continue
        fr = part.get("function_response")
        if isinstance(fr, dict) and fr.get("name") == "transfer_to_agent":
            return True
    return False


def _rewrite_author(event: dict[str, Any]) -> None:
    if event.get("author") == "doculink_agent":
        event["author"] = "property_agent"


def migrate_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    i = 0
    while i < len(events):
        ev = events[i]
        if _is_transfer_call(ev):
            # Drop transfer call + following transfer response if present.
            i += 1
            if i < len(events) and _is_transfer_response(events[i]):
                i += 1
            continue
        if _is_transfer_response(ev):
            i += 1
            continue
        _rewrite_author(ev)
        out.append(ev)
        i += 1
    return out


def migrate_file(path: Path) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = False
    for case in data.get("eval_cases") or []:
        for turn in case.get("conversation") or []:
            mid = turn.get("intermediate_data") or {}
            events = mid.get("invocation_events")
            if not isinstance(events, list):
                continue
            new_events = migrate_events(events)
            if new_events != events:
                mid["invocation_events"] = new_events
                changed = True
    if changed:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return changed


def main() -> int:
    paths = sorted(EVALS.glob("*.evalset.json"))
    for path in paths:
        if migrate_file(path):
            print(f"updated {path.name}")
        else:
            print(f"unchanged {path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
