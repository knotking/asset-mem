#!/usr/bin/env bash
# Prepare BigQuery billing export for homegeek-prod MTD spend in the daily health check.
#
# Usage:
#   ./.github/scripts/apply-prod-billing-export.sh [BQ_PROJECT] [DATASET] [BILLING_ACCOUNT_ID]
#
# Defaults: homegeek-prod, billing_export, 01CB48-B6126A-D1F2D7
#
# Creates the dataset and enables APIs. You must enable the export toggle once in Console
# (no public API for that step). First table rows appear ~4–24h after enabling.

set -euo pipefail

BQ_PROJECT="${1:-homegeek-prod}"
DATASET="${2:-billing_export}"
BILLING_ACCOUNT="${3:-01CB48-B6126A-D1F2D7}"
TABLE_SUFFIX="${BILLING_ACCOUNT//-/_}"
TABLE="${DATASET}.gcp_billing_export_v1_${TABLE_SUFFIX}"

echo "=== BigQuery billing export setup ==="
echo "Storage project: ${BQ_PROJECT}"
echo "Dataset: ${DATASET}"
echo "Billing account: ${BILLING_ACCOUNT}"
echo "Expected table: ${BQ_PROJECT}:${TABLE}"

gcloud services enable bigquery.googleapis.com --project="${BQ_PROJECT}" --quiet

if bq show --project_id="${BQ_PROJECT}" "${DATASET}" >/dev/null 2>&1; then
  echo "✓ Dataset ${BQ_PROJECT}:${DATASET} already exists"
else
  echo "Creating dataset ${BQ_PROJECT}:${DATASET} (US)..."
  bq mk --project_id="${BQ_PROJECT}" --dataset --location=US "${DATASET}"
  echo "✓ Dataset created"
fi

EXPORT_URL="https://console.cloud.google.com/billing/${BILLING_ACCOUNT}/export/bigquery?project=${BQ_PROJECT}"

cat <<EOF

Manual step (once per billing account):
  1. Open: ${EXPORT_URL}
  2. Under "Standard usage cost" → Edit settings
  3. Select project "${BQ_PROJECT}" and dataset "${DATASET}"
  4. Save

After enabling, GCP creates: ${TABLE}
First data usually appears within 4–24 hours.

Grant health-check SA read access (if not already):
  ./.github/scripts/grant-health-check-iam.sh ${BQ_PROJECT}

Verify table (after export is enabled):
  bq show ${BQ_PROJECT}:${TABLE}
EOF
