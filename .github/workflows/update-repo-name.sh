#!/bin/bash
set -e

# Configuration
PROJECT_ID="homegeekdemo"
OLD_REPO="HomeGeekAI/HomeApp"
NEW_REPO="BuildGeekAI/HomeApp"
FIREBASE_SA_EMAIL="firebase-apphosting-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
GITHUB_SA_EMAIL="githubworkflowdeployment@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

echo "=========================================="
echo "Updating Workload Identity Provider"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Old Repository: $OLD_REPO"
echo "New Repository: $NEW_REPO"
echo "Service Accounts:"
echo "  - $FIREBASE_SA_EMAIL"
echo "  - $GITHUB_SA_EMAIL"
echo ""

# Step 1: Update provider attribute condition
echo "Step 1: Updating provider attribute condition..."
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --attribute-condition="attribute.repository=='${NEW_REPO}'"

echo "✓ Provider attribute condition updated"
echo ""

# Step 2: Remove old service account bindings
echo "Step 2: Removing old service account bindings for $OLD_REPO..."
OLD_MEMBER="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${OLD_REPO}"

# Function to remove old binding for a service account
remove_old_binding() {
  local SA_EMAIL=$1
  local SA_NAME=$2
  
  OLD_BINDING=$(gcloud iam service-accounts get-iam-policy $SA_EMAIL \
    --project=$PROJECT_ID \
    --format=json | jq -e ".bindings[] | select(.role==\"roles/iam.workloadIdentityUser\") | .members[] | select(. == \"$OLD_MEMBER\")" 2>/dev/null || echo "")
  
  if [ -n "$OLD_BINDING" ]; then
    gcloud iam service-accounts remove-iam-policy-binding $SA_EMAIL \
      --project=$PROJECT_ID \
      --role="roles/iam.workloadIdentityUser" \
      --member="$OLD_MEMBER" || echo "⚠️  Could not remove old binding for $SA_NAME"
    echo "✓ Old binding removed for $SA_NAME"
  else
    echo "ℹ️  Old binding not found for $SA_NAME (may have been removed already)"
  fi
}

remove_old_binding "$FIREBASE_SA_EMAIL" "firebase-apphosting-deployer"
remove_old_binding "$GITHUB_SA_EMAIL" "githubworkflowdeployment"
echo ""

# Step 3: Add new service account bindings
echo "Step 3: Adding new service account bindings for $NEW_REPO..."
NEW_MEMBER="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${NEW_REPO}"

# Function to add new binding for a service account
add_new_binding() {
  local SA_EMAIL=$1
  local SA_NAME=$2
  
  NEW_BINDING=$(gcloud iam service-accounts get-iam-policy $SA_EMAIL \
    --project=$PROJECT_ID \
    --format=json | jq -e ".bindings[] | select(.role==\"roles/iam.workloadIdentityUser\") | .members[] | select(. == \"$NEW_MEMBER\")" 2>/dev/null || echo "")
  
  if [ -n "$NEW_BINDING" ]; then
    echo "✓ New binding already exists for $SA_NAME"
  else
    gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
      --project=$PROJECT_ID \
      --role="roles/iam.workloadIdentityUser" \
      --member="$NEW_MEMBER"
    echo "✓ New binding added for $SA_NAME"
  fi
}

add_new_binding "$FIREBASE_SA_EMAIL" "firebase-apphosting-deployer"
add_new_binding "$GITHUB_SA_EMAIL" "githubworkflowdeployment"

echo ""
echo "=========================================="
echo "✓ Configuration updated successfully!"
echo "=========================================="
echo ""
echo "Verification:"
echo ""
echo "1. Provider attribute condition:"
gcloud iam workload-identity-pools providers describe github-provider \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(attributeCondition)"
echo ""
echo "2. Firebase App Hosting Deployer bindings:"
gcloud iam service-accounts get-iam-policy $FIREBASE_SA_EMAIL \
  --project=$PROJECT_ID \
  --format="table(bindings.role,bindings.members)" | grep -A 5 "workloadIdentityUser" || echo "No bindings found"
echo ""
echo "3. GitHub Workflow Deployment bindings:"
gcloud iam service-accounts get-iam-policy $GITHUB_SA_EMAIL \
  --project=$PROJECT_ID \
  --format="table(bindings.role,bindings.members)" | grep -A 5 "workloadIdentityUser" || echo "No bindings found"
echo ""
echo "=========================================="
echo "⚠️  IMPORTANT: Firebase Console Update Required"
echo "=========================================="
echo ""
echo "You also need to update the repository connection in Firebase Console:"
echo ""
echo "1. Go to: https://console.firebase.google.com/project/homegeekdemo/apphosting"
echo "2. For each backend (staging, prod, etc.):"
echo "   - Click on the backend"
echo "   - Go to Settings/Configuration"
echo "   - Update GitHub Repository to: BuildGeekAI/HomeApp"
echo "   - Save changes"
echo ""
echo "See .github/workflows/FIREBASE_CONSOLE_UPDATE.md for detailed instructions"
echo ""
echo "=========================================="
echo "✓ GCP Workload Identity updated successfully!"
echo "=========================================="
echo ""
echo "You can now retry your GitHub Actions workflow!"

