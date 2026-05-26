#!/usr/bin/env python3
"""One-off: replace legacy location_* in eval function_call args with search_location."""

from __future__ import annotations

import json
from pathlib import Path


def _migrate_args(args: dict) -> bool:
    if not isinstance(args, dict):
        return False
    if not any(
        k in args for k in ("location_coordinates", "location_type", "location_radius")
    ):
        return False

    coords = args.pop("location_coordinates", None) or {}
    loc_type = args.pop("location_type", None)
    radius = args.pop("location_radius", 5)

    if loc_type == "location" or (loc_type is None and coords):
        source = "device_gps"
    else:
        source = "property_address"

    search_location: dict = {
        "source": source,
        "radius_miles": radius if radius is not None else 5,
    }
    if source == "device_gps" and isinstance(coords, dict):
        lat, lng = coords.get("lat"), coords.get("lng")
        if lat is not None and lng is not None:
            search_location["coordinates"] = {"lat": lat, "lng": lng}

    args["search_location"] = search_location
    return True


def _walk(node) -> int:
    changed = 0
    if isinstance(node, dict):
        if node.get("name") == "checkpoint_agent" and isinstance(
            node.get("args"), dict
        ):
            if _migrate_args(node["args"]):
                changed += 1
        for v in node.values():
            changed += _walk(v)
    elif isinstance(node, list):
        for item in node:
            changed += _walk(item)
    return changed


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "property_agent" / "evals"
    total = 0
    for path in sorted(root.glob("*.evalset.json")):
        data = json.loads(path.read_text())
        n = _walk(data)
        if n:
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
            print(f"{path.name}: updated {n} function_call args")
            total += n
    print(f"done ({total} blocks)")


if __name__ == "__main__":
    main()
