#!/usr/bin/env bash
# Debug STRIPE_B2C_PRICE_TOKEN_CAPS_JSON prepare (jq compact + base64) and runtime decode.
#
# Usage:
#   ./gcp/proxy/scripts/debug-stripe-b2c-caps-deploy-env.sh path/to/caps.json
#   STRIPE_B2C_PRICE_TOKEN_CAPS_JSON_RAW="$(gh variable get ...)" ./gcp/proxy/scripts/debug-stripe-b2c-caps-deploy-env.sh
#   ./gcp/proxy/scripts/debug-stripe-b2c-caps-deploy-env.sh   # reads caps from stdin

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

usage() {
  sed -n '2,7p' "$0" | sed 's/^# \?//'
  exit "${1:-0}"
}

CAPS_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    *) CAPS_FILE="$1"; shift ;;
  esac
done

read_raw_caps() {
  if [[ -n "${STRIPE_B2C_PRICE_TOKEN_CAPS_JSON_RAW:-}" ]]; then
    printf '%s' "$STRIPE_B2C_PRICE_TOKEN_CAPS_JSON_RAW"
    return
  fi
  if [[ -n "${CAPS_FILE:-}" ]]; then
    cat "$CAPS_FILE"
    return
  fi
  if [[ ! -t 0 ]]; then
    cat
    return
  fi
  echo "Provide caps via file, STRIPE_B2C_PRICE_TOKEN_CAPS_JSON_RAW, or stdin." >&2
  usage 1
}

simulate_deploy_cloudrun_comma_join() {
  local -a lines=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] && lines+=("$line")
  done <<<"$1"
  local joined
  joined=$(IFS=,; echo "${lines[*]}")
  echo "--- deploy-cloudrun → gcloud --update-env-vars ^,^ ---"
  echo "  joined length: ${#joined}"
  local n=0
  local part
  for part in ${joined//,/ }; do
    n=$((n + 1))
    if [[ "$part" == *"="* ]]; then
      key="${part%%=*}"
      echo "  entry $n: key='${key}'"
    else
      echo "  entry $n: (fragment) ${part:0:60}"
    fi
  done
  echo "  entry count (split on comma): $n"
}

RAW="$(read_raw_caps)"
echo "== Input =="
echo "  char count: ${#RAW}"
echo "  line count: $(printf '%s' "$RAW" | wc -l | tr -d ' ')"

if [[ -z "$RAW" ]]; then
  echo "  (empty)"
  exit 0
fi

COMPACT=$(printf '%s' "$RAW" | jq -c '.')
ENCODED=$(printf '%s' "$COMPACT" | base64 | tr -d '\n')

echo ""
echo "== Workflow prepare (jq -c + base64) =="
echo "  compact chars: ${#COMPACT}"
echo "  encoded chars: ${#ENCODED}"
echo "  encoded preview: ${ENCODED:0:80}..."

echo ""
echo "== Broken: plain compact JSON in deploy-cloudrun env_vars =="
simulate_deploy_cloudrun_comma_join "GCP_PROJECT_ID=example
STRIPE_B2C_PRICE_TOKEN_CAPS_JSON=${COMPACT}
BILLING_PUBLIC_APP_BASE_URL=https://example.com"

echo ""
echo "== Fixed: base64 in deploy-cloudrun env_vars =="
simulate_deploy_cloudrun_comma_join "GCP_PROJECT_ID=example
STRIPE_B2C_PRICE_TOKEN_CAPS_JSON=${ENCODED}
BILLING_PUBLIC_APP_BASE_URL=https://example.com"

echo ""
echo "== Runtime decode (plans_json_from_env) =="
STRIPE_B2C_PRICE_TOKEN_CAPS_JSON="$ENCODED" PYTHONPATH="${REPO_ROOT}/gcp" python3 - <<'PY'
from common.billing_plans import free_tier_plan, plans_json_from_env, stripe_price_id_for_tier

decoded = plans_json_from_env()
if not decoded.startswith("{"):
    print("  ERROR: decode did not yield JSON object")
    raise SystemExit(1)

free = free_tier_plan(decoded)
print(f"  free tier tokens: {free.monthly_token_limit if free else 'MISSING'}")
print(f"  plus price id: {stripe_price_id_for_tier(decoded, 'plus')!r}")
print("  OK: base64 env decodes and parses")
PY
