#!/usr/bin/env bash
# Create (or verify) a monthly GCP billing budget scoped to homegeek-prod.
#
# Usage:
#   ./.github/scripts/apply-prod-billing-budget.sh [PROJECT_ID] [BILLING_ACCOUNT_ID] [MONTHLY_USD]
#
# Defaults: homegeek-prod, 01CB48-B6126A-D1F2D7, 200 USD/month, display name "homegeek-prod".

set -euo pipefail

PROJECT_ID="${1:-homegeek-prod}"
BILLING_ACCOUNT="${2:-01CB48-B6126A-D1F2D7}"
MONTHLY_USD="${3:-200}"
DISPLAY_NAME="homegeek-prod"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
PROJECT_REF="projects/${PROJECT_NUMBER}"

echo "=== Billing budget: ${DISPLAY_NAME} ==="
echo "Project: ${PROJECT_ID} (${PROJECT_REF})"
echo "Billing account: ${BILLING_ACCOUNT}"
echo "Monthly limit: ${MONTHLY_USD} USD"

gcloud services enable billingbudgets.googleapis.com cloudbilling.googleapis.com \
  --project="$PROJECT_ID" \
  --quiet

EXISTING_ID="$(gcloud billing budgets list \
  --billing-account="$BILLING_ACCOUNT" \
  --format="value(name)" \
  --filter="displayName=${DISPLAY_NAME}" 2>/dev/null | head -1 | awk -F/ '{print $NF}')"

if [ -n "$EXISTING_ID" ]; then
  echo "Budget already exists: ${DISPLAY_NAME} (${EXISTING_ID})"
  gcloud billing budgets describe "$EXISTING_ID" \
    --billing-account="$BILLING_ACCOUNT" \
    --format="yaml(displayName,amount,budgetFilter,thresholdRules)"
  exit 0
fi

gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="$DISPLAY_NAME" \
  --budget-amount="${MONTHLY_USD}USD" \
  --filter-projects="$PROJECT_REF" \
  --calendar-period=MONTH \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0

echo "✓ Created budget ${DISPLAY_NAME} for ${PROJECT_ID}"
