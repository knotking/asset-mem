# Fix Organization-Level Workload Identity Provider

## Problem

The `create-environment.yaml` workflow uses an organization-level Workload Identity Provider (`ORG_WIF_PROVIDER`) to authenticate and create GCP projects. If this provider is configured for the old repository name (`AssetMem/HomeApp`), it will fail with the same attribute condition error.

## Solution

You need to update the organization-level Workload Identity Provider that's referenced by the `ORG_WIF_PROVIDER` secret.

## Steps to Fix

### Step 1: Identify the Organization Project

The `ORG_WIF_PROVIDER` secret contains a path like:
```
projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{POOL_ID}/providers/{PROVIDER_ID}
```

Extract the project number from this path. This is your **organization/admin project**.

### Step 2: Update the Organization Provider

Run these commands to update the organization-level provider:

```bash
# Set your organization project ID (extract from ORG_WIF_PROVIDER path)
export ORG_PROJECT_ID="your-org-project-id"  # e.g., "homegeek-org-admin"
export NEW_REPO="BuildGeekAI/HomeApp"
export OLD_REPO="AssetMem/HomeApp"

# Get project number
export ORG_PROJECT_NUMBER=$(gcloud projects describe $ORG_PROJECT_ID --format="value(projectNumber)")

# Update the provider attribute condition
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --project=$ORG_PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --attribute-condition="attribute.repository=='${NEW_REPO}'"
```

### Step 3: Update Service Account Bindings

Update the IAM bindings for your organization admin service account:

```bash
# Set your organization admin service account
export ORG_ADMIN_SA="your-admin-sa@${ORG_PROJECT_ID}.iam.gserviceaccount.com"

# Remove old binding
gcloud iam service-accounts remove-iam-policy-binding $ORG_ADMIN_SA \
  --project=$ORG_PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${ORG_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${OLD_REPO}" \
  2>/dev/null || echo "Old binding not found"

# Add new binding
gcloud iam service-accounts add-iam-policy-binding $ORG_ADMIN_SA \
  --project=$ORG_PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${ORG_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${NEW_REPO}"
```

### Step 4: Verify

```bash
# Verify provider attribute condition
gcloud iam workload-identity-pools providers describe github-provider \
  --project=$ORG_PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(attributeCondition)"

# Verify service account bindings
gcloud iam service-accounts get-iam-policy $ORG_ADMIN_SA \
  --project=$ORG_PROJECT_ID \
  --format="table(bindings.role,bindings.members)" | grep -A 5 "workloadIdentityUser"
```

## Quick Script

Save this as `fix-org-wif-provider.sh`:

```bash
#!/bin/bash
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <ORG_PROJECT_ID> <ORG_ADMIN_SERVICE_ACCOUNT_EMAIL>"
  echo "Example: $0 homegeek-org-admin admin-sa@homegeek-org-admin.iam.gserviceaccount.com"
  exit 1
fi

ORG_PROJECT_ID="$1"
ORG_ADMIN_SA="$2"
OLD_REPO="AssetMem/HomeApp"
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
echo "You can now retry the create-environment.yaml workflow"
```

Run it:
```bash
chmod +x fix-org-wif-provider.sh
./fix-org-wif-provider.sh YOUR_ORG_PROJECT_ID YOUR_ADMIN_SA_EMAIL
```

## Finding Your Organization Project

If you're not sure which project contains the organization provider:

1. Check the `ORG_WIF_PROVIDER` secret value in GitHub
2. Extract the project number from the path
3. Find the project ID:
   ```bash
   gcloud projects list --format="table(projectId,projectNumber)" | grep YOUR_PROJECT_NUMBER
   ```

## Note

The organization-level provider is separate from the project-level providers. You need to update:
- ✅ Project-level providers (handled by `update-repo-name.sh`)
- ✅ Organization-level provider (this guide)

Both need to be updated for the repository name change.

