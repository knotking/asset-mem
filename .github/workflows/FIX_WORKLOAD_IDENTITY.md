# Fix Workload Identity Federation Attribute Condition Error

## Problem

The error `"The given credential is rejected by the attribute condition"` occurs when the repository name in your GitHub Actions workflow doesn't match the attribute condition configured in the Workload Identity Provider.

## Current Configuration

The Workload Identity Provider is currently configured with:
- **Attribute Condition**: `attribute.repository=='BuildGeekAI/HomeApp'`
- **Service Account**: `firebase-apphosting-deployer@homegeekdemo.iam.gserviceaccount.com`

## Solution

You need to update the attribute condition to match your actual GitHub repository name.

### Step 1: Identify Your Repository Name

Your repository name should be in the format: `OWNER/REPO_NAME`

You can find it by:
- Checking the GitHub Actions workflow logs (look for `github.repository`)
- Or running this in your workflow to see the value:
  ```yaml
  - name: Debug repository name
    run: echo "Repository: ${{ github.repository }}"
  ```

### Step 2: Check Current Provider Configuration

```bash
export PROJECT_ID="homegeekdemo"

# Check current attribute condition
gcloud iam workload-identity-pools providers describe github-provider \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="yaml(attributeMapping,attributeCondition)"
```

### Step 3: Update the Attribute Condition

Replace `YOUR_ORG/YOUR_REPO` with your actual repository name (e.g., `prakashbaskaran/HomeApp`):

```bash
export PROJECT_ID="homegeekdemo"
export GITHUB_REPO="YOUR_ORG/YOUR_REPO"  # e.g., "prakashbaskaran/HomeApp"

# Update the provider with the correct repository name
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --attribute-condition="attribute.repository=='${GITHUB_REPO}'"
```

### Step 4: Update Service Account IAM Binding

You also need to update the IAM binding to allow your repository to impersonate the service account:

```bash
export PROJECT_ID="homegeekdemo"
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export GITHUB_REPO="YOUR_ORG/YOUR_REPO"  # e.g., "prakashbaskaran/HomeApp"
export SA_EMAIL="firebase-apphosting-deployer@homegeekdemo.iam.gserviceaccount.com"

# Remove old binding (if it exists for HomeGeekAI/HomeApp)
gcloud iam service-accounts remove-iam-policy-binding $SA_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/HomeGeekAI/HomeApp" \
  2>/dev/null || echo "Old binding not found, continuing..."

# Add new binding for your repository
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO}"
```

### Step 5: Verify the Configuration

```bash
# Verify provider configuration
gcloud iam workload-identity-pools providers describe github-provider \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="yaml(attributeMapping,attributeCondition)"

# Verify service account binding
gcloud iam service-accounts get-iam-policy $SA_EMAIL \
  --project=$PROJECT_ID \
  --format="yaml"
```

## Alternative: Allow Multiple Repositories

If you want to allow multiple repositories, you can use a more flexible attribute condition:

```bash
# Option 1: Allow all repositories in an organization
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --attribute-condition="attribute.repository.startsWith('YOUR_ORG/')"

# Option 2: Remove attribute condition entirely (less secure - allows any GitHub repo)
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --clear-attribute-condition
```

**Note**: Removing the attribute condition is less secure. It's better to specify your repository or organization.

## Quick Fix Scripts

### For Repository Name Change (HomeGeekAI → BuildGeekAI)

If you're changing the repository from `HomeGeekAI/HomeApp` to `BuildGeekAI/HomeApp`, use the dedicated script:

```bash
./.github/workflows/update-repo-name.sh
```

This script:
- Updates the provider attribute condition
- Removes the old repository binding
- Adds the new repository binding
- Includes verification steps
- Reminds you about Firebase Console updates

### For Other Repository Changes

If you need to update to a different repository, use the manual commands in [Step 3](#step-3-update-the-attribute-condition) above, or modify `update-repo-name.sh` with your specific old and new repository names.

## Testing

After updating, trigger your workflow again. The authentication should now succeed.

If you still see errors, check:
1. The repository name matches exactly (case-sensitive)
2. The service account email is correct
3. The Workload Identity Provider path is correct in your GitHub variables

