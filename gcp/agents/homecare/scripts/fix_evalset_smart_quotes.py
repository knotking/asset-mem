#!/usr/bin/env python3
"""Normalize smart quotes in evalset user_content JSON payloads."""

from __future__ import annotations

import json
import pathlib
import re
import sys

SMART = {
    "\u201c": '"',
    "\u201d": '"',
    "\u2018": "'",
    "\u2019": "'",
}


def normalize_inner_payload(text: str) -> str:
    inner = text
    for old, new in SMART.items():
        inner = inner.replace(old, new)
    # Curly quotes were used beside ASCII escapes; collapse doubled string delimiters.
    inner = re.sub(r':\s*""', ': "', inner)
    inner = re.sub(r'""\s*,', '",', inner)
    inner = re.sub(r'""\s*}', '"}', inner)
    inner = re.sub(r'\[""', '["', inner)
    inner = re.sub(r'""\]', '"]', inner)
    # e.g. [\"“cost”"] → [\"cost\"]
    inner = re.sub(
        r'\[\\"([^\u201c\u201d\\"]+)\u201c([^\u201d\\"]+)\u201d\\"\]',
        r'[\\"\2\\"]',
        inner,
    )
    inner = re.sub(
        r'\[\\"\u201c([^\u201d]+)\u201d\\"\]',
        r'[\\"\1\\"]',
        inner,
    )
    inner = re.sub(
        r'\[\\"\u201c([^\u201d]+)\u201d"\]',
        r'[\\"\1\\"]',
        inner,
    )
    json.loads(inner)
    return inner


def main() -> int:
    evals_dir = pathlib.Path(__file__).resolve().parents[1] / "property_agent" / "evals"
    changed: list[str] = []
    targets = sorted(evals_dir.glob("*.evalset.json"))
    if len(sys.argv) > 1:
        names = set(sys.argv[1:])
        targets = [p for p in targets if p.name in names]
    for path in targets:
        data = json.loads(path.read_text(encoding="utf-8"))
        file_changed = False
        for case in data.get("eval_cases", []):
            for turn in case.get("conversation", []):
                uc = turn.get("user_content") or {}
                for part in uc.get("parts") or []:
                    t = part.get("text")
                    if isinstance(t, str) and t.strip().startswith("{"):
                        fixed = normalize_inner_payload(t)
                        if fixed != t:
                            part["text"] = fixed
                            file_changed = True
        if file_changed:
            path.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            changed.append(path.name)
            print(f"rewrote: {path.name}")

    for path in sorted(evals_dir.glob("*.evalset.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for case in data.get("eval_cases", []):
            for turn in case.get("conversation", []):
                for part in (turn.get("user_content") or {}).get("parts") or []:
                    t = part.get("text") or ""
                    if t.strip().startswith("{"):
                        json.loads(t)

    print("changed:", ", ".join(changed) if changed else "(none)")
    print("all inner payloads valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
