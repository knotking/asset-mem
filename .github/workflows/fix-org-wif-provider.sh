#!/bin/bash
set -e

# Configuration
ORG_PROJECT_ID="homegeek-admin"
ORG_ADMIN_SA="githubworkflow-project-creator@homegeek-admin.iam.gserviceaccount.com"
OLD_REPO="HomeGeekAI/HomeApp"
NEW_REPO="BuildGeekAI/HomeApp"

echo "=========================================="
echo "Updating Organization Workload Identity Provider"
echo "=========================================="
echo "Organization Project: $ORG_PROJECT_ID"
echo "Admin Service Account: $ORG_ADMIN_SA"
echo "Old Repository: $OLD_REPO"
echo "New Repository: $NEW_REPO"
echo ""

# Get project number
ORG_PROJECT_NUMBER=$(gcloud projects describe $ORG_PROJECT_ID --format="value(projectNumber)")

# Step 1: Update provider attribute condition
echo "Step 1: Updating provider attribute condition..."
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --project=$ORG_PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --attribute-condition="attribute.repository=='${NEW_REPO}'"

echo "✓ Provider updated"
echo ""

# Step 2: Remove old binding
echo "Step 2: Removing old binding..."
OLD_MEMBER="principalSet://iam.googleapis.com/projects/${ORG_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${OLD_REPO}"

OLD_BINDING=$(gcloud iam service-accounts get-iam-policy $ORG_ADMIN_SA \
  --project=$ORG_PROJECT_ID \
  --format=json | jq -e ".bindings[] | select(.role==\"roles/iam.workloadIdentityUser\") | .members[] | select(. == \"$OLD_MEMBER\")" 2>/dev/null || echo "")

if [ -n "$OLD_BINDING" ]; then
  gcloud iam service-accounts remove-iam-policy-binding $ORG_ADMIN_SA \
    --project=$ORG_PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="$OLD_MEMBER"
  echo "✓ Old binding removed"
else
  echo "ℹ️  Old binding not found"
fi
echo ""

# Step 3: Add new binding
echo "Step 3: Adding new binding..."
NEW_MEMBER="principalSet://iam.googleapis.com/projects/${ORG_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${NEW_REPO}"

NEW_BINDING=$(gcloud iam service-accounts get-iam-policy $ORG_ADMIN_SA \
  --project=$ORG_PROJECT_ID \
  --format=json | jq -e ".bindings[] | select(.role==\"roles/iam.workloadIdentityUser\") | .members[] | select(. == \"$NEW_MEMBER\")" 2>/dev/null || echo "")

if [ -n "$NEW_BINDING" ]; then
  echo "✓ New binding already exists"
else
  gcloud iam service-accounts add-iam-policy-binding $ORG_ADMIN_SA \
    --project=$ORG_PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="$NEW_MEMBER"
  echo "✓ New binding added"
fi

echo ""
echo "=========================================="
echo "✓ Organization WIF Provider updated!"
echo "=========================================="
echo ""
echo "Verification:"
echo ""
echo "1. Provider attribute condition:"
gcloud iam workload-identity-pools providers describe github-provider \
  --project=$ORG_PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(attributeCondition)"
echo ""
echo "2. Service account bindings:"
gcloud iam service-accounts get-iam-policy $ORG_ADMIN_SA \
  --project=$ORG_PROJECT_ID \
  --format="table(bindings.role,bindings.members)" | grep -A 5 "workloadIdentityUser" || echo "No bindings found"
echo ""
echo "You can now retry the create-environment.yaml workflow"

