#!/usr/bin/env bash
# Audit live GCP hardware against hardware-expectations.yaml for a tier.
set -euo pipefail

ENVIRONMENT="${1:?environment required}"
TIER="${2:?tier required}"
REGION="${GCP_REGION:-us-central1}"
PROJECT="${GCP_PROJECT_ID:?GCP_PROJECT_ID required}"
REPORT="${REPORT_PATH:-hardware-audit-report.md}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pip install -q pyyaml
python3 .github/scripts/hardware_tier.py \
  --environment "$ENVIRONMENT" \
  --tier "$TIER" \
  audit \
  --region "$REGION" \
  --project "$PROJECT" \
  --report "$REPORT"

echo "Report written to $REPORT"
