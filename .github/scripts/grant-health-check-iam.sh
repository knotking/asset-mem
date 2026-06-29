#!/usr/bin/env bash
# Provision a dedicated read-only GCP SA for the daily prod health check (WIF, no JSON keys).
#
# Usage:
#   ./.github/scripts/grant-health-check-iam.sh homegeek-prod [github-org/repo]
#
# Creates (if missing): github-health-check@PROJECT_ID.iam.gserviceaccount.com
# Grants read-only observability roles + logging.logWriter (token audit) + aiplatform.user (Vertex summary).
# Binds GitHub WIF principal (roles/iam.workloadIdentityUser) on the SA.
#
# After running, set on the prod GitHub environment:
#   GCP_HEALTH_CHECK_SERVICE_ACCOUNT_EMAIL=github-health-check@homegeek-prod.iam.gserviceaccount.com

set -euo pipefail

PROJECT_ID="${1:?project id required}"
GITHUB_REPO="${2:-BuildGeekAI/HomeApp}"
BILLING_ACCOUNT="${3:-01CB48-B6126A-D1F2D7}"
SA_ID="github-health-check"
SA_EMAIL="${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
WIF_MEMBER="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO}"

bind_role() {
  local role="$1"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null
  echo "  + ${role}"
}

echo "Project: ${PROJECT_ID} (${PROJECT_NUMBER})"
echo "Service account: ${SA_EMAIL}"

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating service account ${SA_ID}..."
  gcloud iam service-accounts create "$SA_ID" \
    --project="$PROJECT_ID" \
    --display-name="GitHub daily prod health check (read-only)"
else
  echo "Service account already exists."
fi

echo "Granting read-only + audit roles:"
bind_role "roles/run.viewer"
bind_role "roles/logging.viewer"
bind_role "roles/logging.logWriter"
bind_role "roles/datastore.viewer"
bind_role "roles/aiplatform.user"

echo "Granting billing account read access (Budget API):"
gcloud billing accounts add-iam-policy-binding "$BILLING_ACCOUNT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/billing.viewer" \
  --quiet >/dev/null
echo "  + roles/billing.viewer on billingAccounts/${BILLING_ACCOUNT}"

BQ_DATASET="${4:-billing_export}"
echo "Granting BigQuery read access for billing export (${BQ_DATASET}):"
bind_role "roles/bigquery.jobUser"
bind_role "roles/bigquery.dataViewer"
echo "  (project-level dataViewer; dataset IAM requires GCP allowlist)"

echo "Binding WIF principal for ${GITHUB_REPO}:"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="$WIF_MEMBER" \
  --quiet >/dev/null
echo "  + roles/iam.workloadIdentityUser → ${WIF_MEMBER}"

cat <<EOF

Done.

Set on GitHub → Environments → prod:
  GCP_HEALTH_CHECK_SERVICE_ACCOUNT_EMAIL=${SA_EMAIL}

Optional Firestore history (off by default): add roles/datastore.user and set
  HEALTH_CHECK_PERSIST_FIRESTORE=true
on the workflow job if you want ops_daily_health_checks/{runId} documents.

Create the prod billing budget (once):
  ./.github/scripts/apply-prod-billing-budget.sh ${PROJECT_ID} ${BILLING_ACCOUNT}

Enable BigQuery billing export (once):
  ./.github/scripts/apply-prod-billing-export.sh ${PROJECT_ID} ${BQ_DATASET} ${BILLING_ACCOUNT}
EOF
