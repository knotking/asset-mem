#!/usr/bin/env bash
# Grant the proxy Cloud Run runtime SA permission to mint Firebase custom tokens
# (mobile app → web auth handoff via auth.create_custom_token → IAM signBlob).
#
# Usage:
#   ./gcp/proxy/scripts/grant-auth-handoff-iam.sh homegeek-staging
#   ./gcp/proxy/scripts/grant-auth-handoff-iam.sh homegeek-staging githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com
#
# Run once per GCP project (or after create-environment on older envs that predated this grant).

set -euo pipefail

PROJECT_ID="${1:?Usage: $0 PROJECT_ID [RUNTIME_SERVICE_ACCOUNT_EMAIL]}"
RUNTIME_SA="${2:-githubworkflowdeployment@${PROJECT_ID}.iam.gserviceaccount.com}"

echo "Project:    ${PROJECT_ID}"
echo "Runtime SA: ${RUNTIME_SA}"
echo "Granting roles/iam.serviceAccountTokenCreator (self) for Firebase custom tokens…"

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project="${PROJECT_ID}" \
  --quiet

echo "✓ Done. Mobile web handoff (/auth/mobile-web-handoff) can now call create_custom_token."
