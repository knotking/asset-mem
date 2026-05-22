#!/usr/bin/env bash
# Compact + base64-encode STRIPE_B2C_PRICE_TOKEN_CAPS_JSON for deploy workflows.
# deploy-cloudrun joins env_vars with commas; base64 avoids comma/newline splitting.
# Runtime decodes in common.billing_plans.plans_json_from_env (plain JSON still works locally).
#
# Expects STRIPE_B2C_PRICE_TOKEN_CAPS_JSON_RAW in the environment (from vars.*).
set -euo pipefail

if [ -z "${STRIPE_B2C_PRICE_TOKEN_CAPS_JSON_RAW:-}" ]; then
  {
    echo 'STRIPE_B2C_PRICE_TOKEN_CAPS_JSON<<EOF'
    echo 'EOF'
  } >> "$GITHUB_ENV"
  exit 0
fi

compact=$(printf '%s' "$STRIPE_B2C_PRICE_TOKEN_CAPS_JSON_RAW" | jq -c '.')
encoded=$(printf '%s' "$compact" | base64 | tr -d '\n')
{
  echo 'STRIPE_B2C_PRICE_TOKEN_CAPS_JSON<<EOF'
  printf '%s\n' "$encoded"
  echo 'EOF'
} >> "$GITHUB_ENV"
