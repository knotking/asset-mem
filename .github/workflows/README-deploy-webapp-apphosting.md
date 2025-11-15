# Firebase App Hosting Deployment Workflow

This GitHub Actions workflow automates the deployment of the webapp to Firebase App Hosting with support for multiple environments (staging and production).

## Workflow Overview

- **Workflow File**: [deploy-webapp-apphosting.yaml](./deploy-webapp-apphosting.yaml)
- **Supported Environments**: `staging`, `production`
- **Trigger**: Automatic on push to `main` or `firebase_project_migration` branches, or manual via workflow dispatch

## Quick Setup Guide

**Recommended approach:** Create a dedicated service account for CI/CD deployments.

### Step 1: Create Service Account

```bash
export PROJECT_ID="homegeekdemo"
export SA_NAME="firebase-apphosting-deployer"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Create the service account
gcloud iam service-accounts create $SA_NAME \
  --project=$PROJECT_ID \
  --display-name="Firebase App Hosting Deployer" \
  --description="Service account for GitHub Actions to deploy to Firebase App Hosting"
```

### Step 2: Grant Required Permissions

```bash
# Firebase App Hosting Admin (for creating and managing rollouts)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/firebaseapphosting.admin"

# Developer Connect Admin (for Git repository access and fetching refs)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/developerconnect.admin"

# Developer Connect Read Token Accessor (Beta) - Required for fetchReadToken
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/developerconnect.readTokenAccessor"

# Service Usage Consumer (for checking API status)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/serviceusage.serviceUsageConsumer"

# Storage Object Viewer (for reading build artifacts - optional but recommended)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectViewer"
```

### Step 3: Configure Workload Identity Federation

```bash
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export GITHUB_ORG="HomeGeekAI"  # Replace with your GitHub org/username
export GITHUB_REPO="HomeApp"

# Allow GitHub Actions to impersonate this service account
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"
```

### Step 4: Update GitHub Environment Variables

Set `FIREBASE_SERVICE_ACCOUNT_EMAIL` in both staging and production environments:

```
FIREBASE_SERVICE_ACCOUNT_EMAIL=firebase-apphosting-deployer@homegeekdemo.iam.gserviceaccount.com
```

For detailed setup instructions, see the [Prerequisites](#prerequisites) section below.

---

## Triggers

### Automatic Deployment
The workflow runs automatically when changes are pushed to:
- Branches: `main` or `firebase_project_migration`
- Paths:
  - `apps/webapp/**`
  - `apps/common/**`
  - `.github/workflows/deploy-webapp-apphosting.yaml`

**Default Environment**: `staging`

### Manual Deployment
You can manually trigger deployments via GitHub Actions UI:
1. Go to **Actions** → **Deploy Webapp - AppHosting**
2. Click **Run workflow**
3. Select environment: `staging` or `production`

## Prerequisites

### 1. GitHub Environment Configuration

Create two environments in your GitHub repository:

**Settings → Environments → New environment**

Create:
- `staging`
- `production`

### 2. Required Environment Variables

For **each environment** (staging and production), configure these variables:

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `GCP_PROJECT_ID` | Google Cloud Project ID | `homegeekdemo` |
| `GCP_REGION` | GCP region for deployment | `us-central1` |
| `WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider resource name | `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `FIREBASE_SERVICE_ACCOUNT_EMAIL` | Service account email for authentication | `firebase-apphosting-deployer@homegeekdemo.iam.gserviceaccount.com` |

**How to set these:**
1. Go to **Settings → Environments → [staging/production]**
2. Under **Environment variables**, click **Add variable**
3. Add each variable with its value

### 3. Service Account Setup

You have two options for the service account:

#### Option A: Create a Dedicated Service Account (Recommended)

Create a dedicated service account specifically for Firebase App Hosting deployments. This follows the principle of least privilege and keeps deployment permissions separate from runtime permissions.

**Create the service account:**

```bash
export PROJECT_ID="homegeekdemo"
export SA_NAME="firebase-apphosting-deployer"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Create service account
gcloud iam service-accounts create $SA_NAME \
  --project=$PROJECT_ID \
  --display-name="Firebase App Hosting Deployer" \
  --description="Service account for GitHub Actions to deploy to Firebase App Hosting"
```

**Grant required IAM roles:**

```bash
# Firebase App Hosting Admin (for creating and managing rollouts)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/firebaseapphosting.admin"

# Developer Connect Admin (for Git repository access and fetching refs)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/developerconnect.admin"

# Developer Connect Read Token Accessor (Beta) - Required for fetchReadToken
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/developerconnect.readTokenAccessor"

# Service Usage Consumer (for checking API status)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/serviceusage.serviceUsageConsumer"

# Storage Object Viewer (for reading build artifacts - optional but recommended)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectViewer"

# Service Account User on the compute service account (required to act as the compute SA during builds)
COMPUTE_SA="firebase-app-hosting-compute@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding $COMPUTE_SA \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountUser"
```

**Summary of required roles:**
- ✅ **Firebase App Hosting Admin** - Create and manage rollouts
- ✅ **Developer Connect Admin** - Access Git repository connections and fetch refs
- ✅ **Developer Connect Read Token Accessor (Beta)** - Fetch read tokens for repository access
- ✅ **Service Usage Consumer** - Check if APIs are enabled
- ✅ **Storage Object Viewer** - Read build artifacts (optional but recommended)
- ✅ **Service Account User** (on compute SA) - Allows deployer to impersonate the compute service account during builds

Then set `FIREBASE_SERVICE_ACCOUNT_EMAIL=firebase-apphosting-deployer@homegeekdemo.iam.gserviceaccount.com` in your GitHub Environment variables.

#### Option B: Use Firebase App Hosting's Default Compute Service Account

You can use the existing `firebase-app-hosting-compute@{PROJECT_ID}.iam.gserviceaccount.com` service account, but you'll need to add additional roles:

```bash
export PROJECT_ID="homegeekdemo"
export SERVICE_ACCOUNT_EMAIL="firebase-app-hosting-compute@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant Firebase App Hosting Admin role (required for creating rollouts)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/firebaseapphosting.admin"

# Grant Developer Connect Admin role (required for fetching Git refs)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/developerconnect.admin"
```

**Note:** This service account already has Service Usage Consumer, Storage Object Viewer, and other runtime permissions. Option A (dedicated service account) is recommended for better security and separation of concerns.

### 4. Workload Identity Federation Setup

If you haven't set up Workload Identity Federation yet, follow these steps to allow GitHub Actions to authenticate as your service account.

#### Step 1: Get Your Project Number

```bash
export PROJECT_ID="homegeekdemo"
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"
```

#### Step 2: Set Your Service Account

Choose one of these based on which option you selected in [Service Account Setup](#3-service-account-setup):

```bash
# Option A: Dedicated deployer service account (recommended)
export SERVICE_ACCOUNT_EMAIL="firebase-apphosting-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# Option B: Firebase App Hosting's default compute service account
export SERVICE_ACCOUNT_EMAIL="firebase-app-hosting-compute@${PROJECT_ID}.iam.gserviceaccount.com"
```

#### Step 3: Set Your GitHub Repository

```bash
# Replace with your GitHub organization/username
export GITHUB_ORG="HomeGeekAI"
export GITHUB_REPO="HomeApp"
```

#### Step 4: Create Workload Identity Pool

```bash
# Create Workload Identity Pool
gcloud iam workload-identity-pools create github-pool \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"
```

#### Step 5: Create Workload Identity Provider

```bash
# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

#### Step 6: Allow GitHub to Impersonate the Service Account

```bash
# Allow the GitHub repo to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"
```

#### Step 7: Get the Workload Identity Provider Resource Name

```bash
# Get the full provider resource name for your GitHub variables
gcloud iam workload-identity-pools providers describe github-provider \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)"
```

Save this output - it's your `WORKLOAD_IDENTITY_PROVIDER` value for GitHub Environment variables.

**Example output:**
```
projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

## Firebase App Hosting Configuration

The workflow uses environment-specific configuration files:

### Configuration Files Structure

```
apps/webapp/
├── apphosting.yaml                    # Base configuration
├── apphosting.staging.yaml            # Staging overrides
└── apphosting.prod.yaml               # Production overrides
```

### Backend ID Mapping

| Environment | Backend ID | Config File |
|------------|-----------|-------------|
| staging | `staging` | `apphosting.staging.yaml` |
| production | `prod` | `apphosting.prod.yaml` |

Firebase automatically merges the base `apphosting.yaml` with the environment-specific file.

### Example Configuration Files

**apphosting.yaml** (Base):
```yaml
runConfig:
  minInstances: 0
  maxInstances: 2
  cpu: 1
  memoryMiB: 512
```

**apphosting.staging.yaml**:
```yaml
runConfig:
  minInstances: 0
  maxInstances: 1
  concurrency: 50
env:
  - variable: NODE_ENV
    value: staging
```

**apphosting.prod.yaml**:
```yaml
runConfig:
  minInstances: 1
  maxInstances: 5
  concurrency: 100
env:
  - variable: NODE_ENV
    value: production
```

## Workflow Steps

1. **Set Environment Variables** - Determines target environment and backend ID
2. **Validate Configuration** - Checks all required GitHub variables are set
3. **Checkout Code** - Clones the repository
4. **Google Auth** - Authenticates using Workload Identity Federation
5. **Setup Cloud SDK** - Installs Google Cloud CLI
6. **Setup Node.js** - Installs Node.js 20
7. **Install Firebase CLI** - Installs latest Firebase tools
8. **Deploy to App Hosting** - Creates a new rollout for the specified backend
9. **Deployment Summary** - Generates summary with deployment details and URLs

## Deployment URLs

After successful deployment, access your app at:

- **Staging**: `https://staging--{PROJECT_ID}.{REGION}.hosted.app`
- **Production**: `https://prod--{PROJECT_ID}.{REGION}.hosted.app`

## Troubleshooting

### Error: Permission denied to get service [firebaseapphosting.googleapis.com]

**Cause**: Service account lacks Service Usage Consumer permissions.

**Solution**: Grant the `roles/serviceusage.serviceUsageConsumer` role:

```bash
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:firebase-app-hosting-compute@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer"
```

This permission allows the service account to check if Firebase App Hosting API is enabled.

### Error: Permission 'firebaseapphosting.backends.list' denied

**Cause**: Service account lacks Firebase App Hosting permissions.

**Solution**: Grant the `roles/firebaseapphosting.admin` role to your service account (see [Service Account Setup](#3-service-account-setup)).

### Error: Permission 'developerconnect.gitRepositoryLinks.get' denied

**Cause**: Service account lacks Developer Connect permissions to access GitHub repository connections.

**Solution**: Grant the `roles/developerconnect.admin` role to your service account:

```bash
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:firebase-app-hosting-compute@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/developerconnect.admin"
```

This permission is required because Firebase App Hosting uses Developer Connect to manage the GitHub repository connection.

### Error: Permission 'developerconnect.gitRepositoryLinks.fetchGitRefs' denied

**Cause**: Service account lacks permission to fetch Git references (branches/tags) from the Developer Connect Git repository link.

**Solution**: The "Developer Connect Read Token Accessor (Beta)" role is insufficient. Grant the full `roles/developerconnect.admin` role:

```bash
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:firebase-app-hosting-compute@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/developerconnect.admin"
```

This role includes permissions for:
- `developerconnect.gitRepositoryLinks.get`
- `developerconnect.gitRepositoryLinks.fetchReadToken`
- `developerconnect.gitRepositoryLinks.fetchGitRefs`

### Error: Request to fetchReadToken had HTTP Error: 403

**Cause**: Service account lacks permission to fetch read tokens from the Developer Connect Git repository link.

**Solution**: This should be covered by the `roles/developerconnect.admin` role. If you're still getting this error after adding that role:

1. **Verify the role was applied**:
   ```bash
   gcloud projects get-iam-policy homegeekdemo \
     --flatten="bindings[].members" \
     --filter="bindings.members:serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL"
   ```

2. **Wait a few minutes** for IAM permissions to propagate (can take up to 5 minutes)

3. **Re-run the workflow** after permissions have propagated

4. **Alternative: Use a custom role** with only the required permissions:
   ```bash
   # Create custom role with minimal permissions
   gcloud iam roles create FirebaseAppHostingDeployer \
     --project=homegeekdemo \
     --title="Firebase App Hosting Deployer" \
     --description="Minimal permissions for App Hosting deployment" \
     --permissions=firebaseapphosting.backends.get,firebaseapphosting.backends.list,firebaseapphosting.rollouts.create,developerconnect.gitRepositoryLinks.get,developerconnect.gitRepositoryLinks.fetchReadToken \
     --stage=GA

   # Assign the custom role
   gcloud projects add-iam-policy-binding homegeekdemo \
     --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
     --role="projects/homegeekdemo/roles/FirebaseAppHostingDeployer"
   ```

### Error: Permission "iam.serviceAccounts.actAs" denied

**Full Error**: `Permission "iam.serviceAccounts.actAs" denied on "firebase-app-hosting-compute@{PROJECT_ID}.iam.gserviceaccount.com"`

**Cause**: The deployer service account needs permission to impersonate the compute service account during the build process.

**Solution**: Grant the Service Account User role on the compute service account:

```bash
export PROJECT_ID="homegeekdemo"
export DEPLOYER_SA="firebase-apphosting-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
export COMPUTE_SA="firebase-app-hosting-compute@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding $COMPUTE_SA \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/iam.serviceAccountUser"
```

This is required because Firebase App Hosting uses the compute service account to run builds, and the deployer service account needs permission to act as the compute service account.

### Error: Missing required GitHub variables

**Cause**: Environment variables not configured or configured at wrong level.

**Solution**:
- Ensure variables are set in **Settings → Environments → [staging/production] → Variables**
- NOT in repository-level variables or secrets
- Variables must exist for both `staging` and `production` environments

### Error: Workload Identity authentication failed

**Cause**: Workload Identity Federation not properly configured.

**Solution**:
- Verify the `WORKLOAD_IDENTITY_PROVIDER` value is correct
- Ensure the service account has `roles/iam.workloadIdentityUser` for your GitHub repository
- Check the attribute mapping includes `attribute.repository`

### Backend not found

**Cause**: Backend doesn't exist in Firebase App Hosting.

**Solution**: Create the backend first:
```bash
firebase apphosting:backends:create staging \
  --project=homegeekdemo \
  --location=us-central1
```

## Monitoring

- **GitHub Actions**: View workflow runs in the Actions tab
- **Firebase Console**: Monitor deployments at [Firebase App Hosting Console](https://console.firebase.google.com/project/homegeekdemo/apphosting)
- **Logs**: Access deployment logs via Cloud Logging in GCP Console

## Additional Resources

- [Firebase App Hosting Documentation](https://firebase.google.com/docs/app-hosting)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [GitHub Actions Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
