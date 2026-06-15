#!/usr/bin/env bash
# Audit live GCP hardware against hardware-expectations.yaml for a tier.
set -euo pipefail

ENVIRONMENT="${1:?environment required}"
TIER="${2:?tier required}"
REGION="${GCP_REGION:-us-central1}"
PROJECT="${GCP_PROJECT_ID:?GCP_PROJECT_ID required}"
REPORT="${REPORT_PATH:-hardware-audit-report.md}"
# When false, write report and emit ::warning:: but exit 0 (use after apply mode).
FAIL_ON_MISMATCH="${FAIL_ON_MISMATCH:-true}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pip install -q pyyaml

audit_args=(
  --environment "$ENVIRONMENT"
  --tier "$TIER"
  audit
  --region "$REGION"
  --project "$PROJECT"
  --report "$REPORT"
)
if [ "$FAIL_ON_MISMATCH" != "true" ]; then
  audit_args+=(--no-fail-on-mismatch)
fi

python3 .github/scripts/hardware_tier.py "${audit_args[@]}"

echo "Report written to $REPORT"
