#!/usr/bin/env bash
# Capture App Store screenshots via Maestro + iOS Simulator.
# Requires: MAESTRO_EMAIL, MAESTRO_PASSWORD (Firebase user with at least one property).
#
# Usage:
#   export MAESTRO_EMAIL='you@example.com'
#   export MAESTRO_PASSWORD='your-password'
#   ./scripts/capture-app-store-screenshots.sh
#
# Output:
#   docs/app-store-screenshots/iphone-6.7/*.png  (1290×2796)
#   docs/app-store-screenshots/ipad-12.9/*.png   (2048×2732)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IPHONE_UDID="D8DBE433-3F85-4B4B-AF5E-EBC161345917"
IPAD_UDID="9BA22E53-FF1D-42B0-A368-3C771F727730"
APP_ID="com.assetmem.staging"
OUT_IPHONE="$ROOT/docs/app-store-screenshots/iphone-6.7"
OUT_IPAD="$ROOT/docs/app-store-screenshots/ipad-12.9"
DEBUG_DIR="$ROOT/.maestro/debug/app-store-screenshots"

if [[ -z "${MAESTRO_EMAIL:-}" || -z "${MAESTRO_PASSWORD:-}" ]]; then
  echo "Set MAESTRO_EMAIL and MAESTRO_PASSWORD to a Firebase account with at least one property."
  exit 1
fi

mkdir -p "$OUT_IPHONE" "$OUT_IPAD" "$DEBUG_DIR"

capture_device() {
  local udid="$1"
  local out_dir="$2"
  local target_w="$3"
  local target_h="$4"

  echo "▶ Booting simulator $udid"
  xcrun simctl boot "$udid" 2>/dev/null || true
  open -a Simulator

  rm -f "$ROOT"/app-store-*.png

  echo "▶ Maestro screenshot flow"
  maestro test .maestro/app-store-screenshots.yaml \
    --config .maestro/config.yaml \
    --platform ios \
    --udid "$udid" \
    --debug-output "$DEBUG_DIR/$udid" \
    -e "APP_ID=$APP_ID" \
    -e "MAESTRO_EMAIL=$MAESTRO_EMAIL" \
    -e "MAESTRO_PASSWORD=$MAESTRO_PASSWORD"

  if ! compgen -G "$ROOT/app-store-*.png" >/dev/null; then
    echo "No Maestro screenshots found (expected app-store-*.png in $ROOT)"
    return 1
  fi

  rm -f "$out_dir"/*.png
  local i=1
  for f in $(ls -1 "$ROOT"/app-store-*.png | sort); do
    local base
    base=$(basename "$f" .png | sed 's/^app-store-[0-9]*-//')
    local dest
    dest=$(printf "%s/%02d-%s.png" "$out_dir" "$i" "$base")
    cp "$f" "$dest"
    sips -z "$target_h" "$target_w" "$dest" >/dev/null
    echo "  ✓ $dest"
    i=$((i + 1))
  done
  rm -f "$ROOT"/app-store-*.png
}

if ! curl -sf http://localhost:8081/status >/dev/null 2>&1; then
  echo "Start Metro first:"
  echo "  cd apps/mapp && PROXY_BASE_URL=https://homecare-agent-proxy-staging-291418967332.us-central1.run.app npx expo start --dev-client"
  exit 1
fi

capture_device "$IPHONE_UDID" "$OUT_IPHONE" 1290 2796
capture_device "$IPAD_UDID" "$OUT_IPAD" 2048 2732

echo "Done. Upload PNGs from docs/app-store-screenshots/ to App Store Connect."
