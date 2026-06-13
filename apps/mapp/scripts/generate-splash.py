#!/usr/bin/env python3
"""Generate splash.png for expo-splash-screen (1024x1024, opaque, landing background).

Requires Pillow: python3 -m venv .venv && .venv/bin/pip install Pillow
Then: .venv/bin/python scripts/generate-splash.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
ICON_PATH = ASSETS / "icon.png"
SPLASH_PATH = ASSETS / "splash.png"

CANVAS_SIZE = 1024
# Visible logo diameter on the 1024 canvas (~180 logical px at imageWidth 180).
LOGO_DIAMETER = 768
LANDING_BACKGROUND = (10, 10, 15)  # #0a0a0f


def main() -> None:
    icon = Image.open(ICON_PATH).convert("RGBA")
    canvas = Image.new("RGB", (CANVAS_SIZE, CANVAS_SIZE), LANDING_BACKGROUND)

    logo = icon.resize((LOGO_DIAMETER, LOGO_DIAMETER), Image.Resampling.LANCZOS)
    mask = Image.new("L", (LOGO_DIAMETER, LOGO_DIAMETER), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, LOGO_DIAMETER, LOGO_DIAMETER), fill=255)

    offset = (CANVAS_SIZE - LOGO_DIAMETER) // 2
    canvas.paste(logo, (offset, offset), mask)
    canvas.save(SPLASH_PATH, "PNG", optimize=True)
    print(f"Wrote {SPLASH_PATH} ({CANVAS_SIZE}x{CANVAS_SIZE}, bg #0a0a0f, logo {LOGO_DIAMETER}px)")


if __name__ == "__main__":
    main()
