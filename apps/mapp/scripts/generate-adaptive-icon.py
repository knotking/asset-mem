#!/usr/bin/env python3
"""Generate adaptive-icon.png Android foreground (1024x1024, transparent, safe-zone logo).

Requires Pillow: python3 -m venv .venv && .venv/bin/pip install Pillow
Then: .venv/bin/python scripts/generate-adaptive-icon.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
ICON_PATH = ASSETS / "icon.png"
ADAPTIVE_PATH = ASSETS / "adaptive-icon.png"

CANVAS_SIZE = 1024
# Android adaptive icon safe zone ≈ 66% of canvas (72/108 dp).
LOGO_DIAMETER = int(CANVAS_SIZE * 66 / 108)


def main() -> None:
    icon = Image.open(ICON_PATH).convert("RGBA")
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))

    logo = icon.resize((LOGO_DIAMETER, LOGO_DIAMETER), Image.Resampling.LANCZOS)
    mask = Image.new("L", (LOGO_DIAMETER, LOGO_DIAMETER), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, LOGO_DIAMETER, LOGO_DIAMETER), fill=255)

    offset = (CANVAS_SIZE - LOGO_DIAMETER) // 2
    canvas.paste(logo, (offset, offset), mask)
    canvas.save(ADAPTIVE_PATH, "PNG", optimize=True)
    print(
        f"Wrote {ADAPTIVE_PATH} ({CANVAS_SIZE}x{CANVAS_SIZE}, transparent bg, "
        f"logo {LOGO_DIAMETER}px safe zone)"
    )


if __name__ == "__main__":
    main()
