#!/usr/bin/env bash
# Bundle Playwright Chromium into SOURCE_DIR/ms-playwright for Cloud Functions deploy.
# Run on linux/amd64 (GitHub Actions) so binaries match the Gen2 Python runtime.
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${SOURCE_DIR}"

export PLAYWRIGHT_BROWSERS_PATH="${SOURCE_DIR}/ms-playwright"

python3 -m pip install --quiet "playwright>=1.49.0"
# Headless-only worker — skip full Chromium UI build (~641MB) to stay under CF source limits.
python3 -m playwright install --only-shell chromium

CHROME="$(
  find "${PLAYWRIGHT_BROWSERS_PATH}" \( -name 'chrome-headless-shell' -o -name 'chrome' \) -type f 2>/dev/null | head -1
)"
if [ -z "${CHROME}" ]; then
  echo "Playwright chromium install failed — no browser binary under ${PLAYWRIGHT_BROWSERS_PATH}" >&2
  exit 1
fi

echo "Bundled Playwright Chromium: ${CHROME} ($(du -sh "${PLAYWRIGHT_BROWSERS_PATH}" | cut -f1))"
