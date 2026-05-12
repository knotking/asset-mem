# GitHub Environment Setup

## Prerequisites

The `create-environment.yaml` workflow requires several secrets to be configured for full functionality.

### Required Secrets

#### 1. GitHub Environment Management
- **`GH_PAT_ENV_ADMIN`**: Personal Access Token with permissions to create and manage GitHub environments
  - Required for: Creating GitHub environments and setting environment variables
  - Scopes needed: `repo` (Full control of private repositories)

#### 2. GCP Project Creation (Required if creating new projects)

If you plan to use the workflow to create new GCP projects, configure these organization-level secrets:

- **`ORG_WIF_PROVIDER`**: Workload Identity Provider for GitHub Actions at the organization level
  - Format: `projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{POOL_ID}/providers/{PROVIDER_ID}`
  - Required for: Authenticating GitHub Actions to create GCP projects

- **`ORG_ADMIN_SERVICE_ACCOUNT`**: Service account email with permissions to create GCP projects
  - Format: `admin-sa@organization-project.iam.gserviceaccount.com`
  - Required roles: `roles/resourcemanager.projectCreator`, `roles/billing.user`

- **`BILLING_ACCOUNT_ID`**: GCP Billing Account ID to link with new projects
  - Format: `XXXXXX-XXXXXX-XXXXXX`
  - Find at: [GCP Billing Console](https://console.cloud.google.com/billing)

- **`ORGANIZATION_ID`**: Google Cloud Organization ID
  - Format: Numeric ID (e.g., `123456789012`)
  - Find at: [GCP Resource Manager](https://console.cloud.google.com/cloud-resource-manager)
  - Note: Projects must be created under an organization for proper governance

**Note**: If you're using existing GCP projects, you only need `GH_PAT_ENV_ADMIN`. The organization-level secrets are only required when using the `create_project: true` workflow input.

## Workflow Capabilities

The `create-environment.yaml` workflow automatically provisions and configures:

### Infrastructure Components

1. **GCP Project** (optional)
   - Creates new GCP project with billing linked
   - Supports organization and folder hierarchy
   - Idempotent: safe to rerun if project exists

2. **IAM & Service Accounts**
   - GitHub workflow deployment service account: `githubworkflowdeployment@{PROJECT_ID}.iam.gserviceaccount.com`
     - Roles: Cloud Run, Artifact Registry, Cloud Build, Storage Admin, Pub/Sub, AI Platform, Cloud Functions, Secret Manager
     - Firebase-specific roles: `roles/firebasehosting.admin`, `roles/firebaserules.admin`, `roles/firebase.admin`, `roles/firebasestorage.admin`
   - Firebase App Hosting deployer service account: `firebase-apphosting-deployer@{PROJECT_ID}.iam.gserviceaccount.com`
     - Roles: Developer Connect Admin, Firebase App Hosting Admin, Storage Object Viewer
   - Cloud Build service account with proper permissions
   - Compute Engine service account configuration
   - Workload Identity Pool and Provider for keyless authentication

3. **APIs Enabled**
   - Cloud Resource Manager, IAM, IAM Credentials, STS
   - Artifact Registry, Cloud Build, Cloud Run
   - AI Platform, Pub/Sub, Storage, Secret Manager
   - Cloud Functions, Eventarc
   - Firebase, Firestore, Firebase Rules, Firebase Storage, Identity Toolkit

4. **Storage Resources**
   - **Artifact Registry**: `cloud-run-source-deploy` (Docker repository)
   - **GCS Buckets**:
     - `homegeek-user-data-{ENV}`: User data with versioning, 90-day lifecycle, CORS enabled
     - `homegeek-catalog-{ENV}`: Agent catalog bucket
   - **Firebase Storage**: Default Firebase storage bucket

5. **Messaging Infrastructure**
   - **Pub/Sub Topics**:
     - `user-upload-topic-{ENV}`: User upload events
     - `user-upload-result-topic-{ENV}`: Processing result events
   - **Subscriptions**: Automatic with 60s ack deadline, 7-day retention, retry policies

6. **AI/ML Resources**
   - **RAG Corpora** (2 separate corpora):
     - `user-upload-rag-corpus-{ENV}`: For user-uploaded documents
     - `knowledge-base-rag-corpus-{ENV}`: For knowledge base documents
   - Note: RAG API has regional availability. Workflow automatically maps regions:
     - `us-central1`, `us-east4` → `us-west1`
     - `europe-west*` → `europe-west4`
     - `asia-*` → `asia-southeast1`

7. **Firebase Services**
   - Firebase project initialization
   - Firestore database (native mode)
   - Firebase Authentication (Email/Password + Anonymous providers)
   - Firebase Storage bucket
   - Firestore rules and indexes deployment
   - Storage rules deployment (with graceful fallback if not initialized)
   - Firebase App Hosting backend
   - Note: Rules deployment uses `githubworkflowdeployment` service account with full Firebase permissions

8. **GitHub Environment**
   - Automatically creates GitHub environment with all required variables
   - See "Environment Variables Created" section below

### Environment Variables Created

The workflow automatically creates these environment variables in your GitHub environment:

#### Core GCP Configuration
- `GCP_PROJECT_ID`: GCP project identifier
- `GCP_PROJECT_NUMBER`: GCP project number
- `GCP_REGION`: Primary region for resources
- `WORKLOAD_IDENTITY_PROVIDER`: Workload Identity Provider resource name
- `GCP_SERVICE_ACCOUNT_EMAIL`: GitHub workflow service account email
- `FIREBASE_SERVICE_ACCOUNT_EMAIL`: Firebase App Hosting deployer email

#### Storage and Messaging
- `GCS_BUCKET`: User data bucket name
- `USER_UPLOAD_TOPIC`: Pub/Sub topic for upload events
- `USER_UPLOAD_RESULT_TOPIC`: Pub/Sub topic for results
- `USER_UPLOAD_RESULT_SUBSCRIPTION`: Subscription for result events
- `USER_UPLOAD_FOLDER`: Folder path for uploads

#### AI/ML Configuration
- `REASONING_ENGINE_ID`: Agent reasoning engine identifier (default: `new`)
- `USER_UPLOAD_RAG_CORPUS`: RAG corpus resource name for user uploads
- `KNOWLEDGE_BASE_RAG_CORPUS`: RAG corpus resource name for knowledge base
- `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON`: Plan limits for proxy and workers; default includes **`free`** tier (1M tokens / 2 docs / 5 checkpoints) when the variable is **missing** (`set_var_if_not_exists`)

#### Application Configuration
- `AGENT_STAGING_BUCKET`: GCS bucket for agent staging
- `EXPO_ACCOUNT`: Expo account name
- `WEBAPP_GCP_PROJECT_ID`: Web app GCP project (same as main project)

### Application Secrets (Manual Configuration Required)

After the workflow completes, configure these secrets manually in **Settings → Environments → {environment_name} → Secrets**:

- `FIREBASE_WEBHOOK_SECRET`: Secret for Firebase webhook authentication
- `PROXY_TOKEN`: Authentication token for proxy service
- `SERP_API_KEY`: API key for SERP (search) services
- `TELEGRAM_BOT_TOKEN`: Telegram bot authentication token
- `TELEGRAM_WEBHOOK_SECRET`: Secret for Telegram webhook verification
- ``: API key for SerpAPI integration

### Region Selection

The workflow supports the following primary regions:
- `us-central1` (default)
- `us-east1`
- `us-west1`

Note: Some services (like RAG) may use alternative regions based on availability. The workflow handles this automatically.

## Setup Instructions

### 1. Create a Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name: `Environment Management Token`
4. Select the following scopes:
   - **`repo`** (Full control of private repositories)
     - This includes the ability to manage environments
5. Set an appropriate expiration date
6. Click "Generate token"
7. **Copy the token immediately** (you won't be able to see it again)

### 2. Add the Token as a Repository Secret

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `GH_PAT_ENV_ADMIN`
4. Value: Paste the token you copied
5. Click "Add secret"

### 3. Configure GCP Organization Secrets (If Creating New Projects)

If you plan to create new GCP projects via the workflow:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `ORG_WIF_PROVIDER`: Your organization-level Workload Identity Provider
   - `ORG_ADMIN_SERVICE_ACCOUNT`: Service account with project creation permissions
   - `BILLING_ACCOUNT_ID`: Your GCP billing account ID
   - `ORGANIZATION_ID`: Your Google Cloud organization ID

### 4. Verify the Setup

The workflow will now use `${{ secrets.GH_PAT_ENV_ADMIN }}` to:
- Create GitHub environments
- Set environment variables
- Read environment variables

If creating projects, it will use the organization secrets to:
- Authenticate at the organization level
- Create new GCP projects
- Link billing accounts
- Set up project hierarchy

## How to Run the Workflow

### Option 1: Using an Existing GCP Project

1. Go to **Actions** → **Create New Environment**
2. Click **Run workflow**
3. Enter:
   - **Environment name**: e.g., `qa`, `staging`, `prod`
   - **GCP Project ID**: Your existing project ID
   - **Region**: Choose from `us-central1`, `us-east1`, `us-west1`
   - Leave **Create project** unchecked

### Option 2: Creating a New GCP Project

1. Ensure all organization-level secrets are configured (see Prerequisites)
2. Go to **Actions** → **Create New Environment**
3. Click **Run workflow**
4. Enter:
   - **Environment name**: e.g., `qa-team-1`, `demo-customer-x`
   - **GCP Project ID**: Desired project ID for the new project
   - **Create project**: Check this box
   - **Folder ID** (optional): GCP folder ID for organization
   - **Region**: Choose from `us-central1`, `us-east1`, `us-west1`

The workflow will:
1. Create the GCP project
2. Link billing
3. Enable all required APIs
4. Provision all infrastructure
5. Configure GitHub environment
6. Generate a configuration summary

## Workflow Safety Features

- **Idempotent**: Safe to rerun multiple times. The workflow checks for existing resources before creating new ones
- **Validation Mode**: Push events only validate syntax without creating infrastructure
- **Continue on Error**: Some steps (RAG corpora, App Hosting) continue even if they fail, allowing manual setup
- **Resource Checking**: Each resource creation step verifies if it already exists before attempting to create

## Manual Firebase Configuration Steps

The workflow attempts to automatically configure Firebase services (Authentication, Storage, and App Hosting). However, if the automated setup fails due to API limitations, rate limits, or permissions issues, you can manually configure these services using the steps below.

**When to use these steps:**
- Check the workflow logs for Firebase initialization errors
- If you see warnings like "Firebase Authentication initialization failed" or "Firebase Storage initialization failed"
- As a fallback when automated setup doesn't complete successfully

### Firebase Authentication Setup

If the workflow logs show that Firebase Authentication initialization failed, follow these steps:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (e.g., `homegeek-prod`)
3. Navigate to **Build** → **Authentication** in the left sidebar
4. Click **Get Started**
5. Go to the **Sign-in method** tab
6. Enable the required authentication providers:
   - **Email/Password**: Click on it, toggle **Enable**, click **Save**
   - **Anonymous**: Click on it, toggle **Enable**, click **Save**
7. The authentication providers are now configured

### Firebase Storage Setup

If the workflow logs show that Firebase Storage initialization failed, follow these steps:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (e.g., `homegeek-prod`)
3. Navigate to **Build** → **Storage** in the left sidebar
4. Click **Get Started**
5. Review the security rules (default is fine for now)
6. Click **Next**
7. Select your Cloud Storage location (should match your GCP region, e.g., `us-central1`)
8. Click **Done**

Once Storage is initialized, you can deploy storage rules:
```bash
cd apps/webapp
firebase deploy --only storage --project=<your-project-id>
```

### Firebase App Hosting Backend Setup

If the App Hosting backend creation failed via CLI, create it manually:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (e.g., `homegeek-prod`)
3. Navigate to **Build** → **App Hosting** in the left sidebar
4. Click **Get Started** (if first time) or **Add Backend**
5. Configure the backend:
   - **Backend ID**: Use your environment name (e.g., `prod`, `staging`, `qa`)
   - **GitHub Repository**: Connect your GitHub repository
   - **Branch**: Select your deployment branch (e.g., `main`)
   - **Root directory**: `apps/webapp` (for monorepo setup)
   - **Region**: Match your GCP region (e.g., `us-central1`)
6. Click **Create Backend**
7. The backend URL will be available after the first deployment: `https://<backend-id>--<project-id>.<region>.hosted.app`

After manual creation, the backend is ready for deployment through the Firebase Console or GitHub integration.

## Troubleshooting

### Error: "Resource not accessible by integration (HTTP 403)"

This error means the token doesn't have sufficient permissions. Verify:
1. The `GH_PAT_ENV_ADMIN` secret exists
2. The token has the `repo` scope
3. The token hasn't expired

### Error: "Bad credentials (HTTP 401)"

This means the token is invalid or expired. Generate a new token and update the secret.

### Error: "ORG_WIF_PROVIDER secret is not configured"

This error occurs when trying to create a new GCP project without the required organization secrets. To fix:
1. Verify you need to create a new project (if using existing project, uncheck `create_project`)
2. Configure all organization-level secrets (see Prerequisites section)
3. Ensure your organization service account has the required roles

### Error: "GCP_PROJECT_ID not provided and not found in GitHub environment"

This occurs when neither workflow input nor GitHub environment variable provides the project ID. To fix:
1. Provide `gcp_project_id` as workflow input when running manually
2. Or ensure the GitHub environment has `GCP_PROJECT_ID` variable set

### Error: "Firebase Storage has not been set up"

The workflow attempted to deploy storage rules but Firebase Storage isn't initialized. Follow the **Firebase Storage Setup** steps above to initialize it manually, then re-run the storage rules deployment.

### Error: "Firebase App Hosting backend creation failed"

The Firebase CLI couldn't create the backend automatically. This can happen due to:
- API rate limits
- Missing permissions
- Service not fully propagated
- GitHub repository not connected to Firebase

Follow the **Firebase App Hosting Backend Setup** steps above to create it manually through the Firebase Console.

### Error: "RAG corpus creation failed" or RAG API errors

RAG API has capacity restrictions in certain regions. The workflow automatically maps to supported regions:
- If using `us-central1` or `us-east4`, RAG will use `us-west1`
- For European regions, RAG will use `europe-west4`
- For Asian regions, RAG will use `asia-southeast1`

If RAG creation fails, the workflow continues with placeholder values. RAG can be set up later when needed.

### Warning: "Could not initialize Firebase Storage automatically"

This is a non-blocking warning. The workflow continues, and you can:
1. Manually initialize Firebase Storage (see Manual Firebase Configuration Steps)
2. The storage bucket will be created automatically on first Firebase CLI deployment
3. Deploy storage rules later using: `firebase deploy --only storage --project=<project-id>`

### Workflow continues but some resources show "placeholder"

This is expected behavior for optional resources like RAG corpora. These features:
- Are marked with `continue-on-error: true` in the workflow
- Won't block environment creation
- Can be configured manually later if needed
- Will be populated on subsequent workflow runs once the services are available

## Destroying an Environment

When you no longer need an environment, use the `destroy-environment.yaml` workflow to clean up all resources.

### How to Destroy an Environment

1. Go to **Actions** → **Destroy On-Demand Environment**
2. Click **Run workflow**
3. Enter:
   - **Environment name**: The environment to destroy (e.g., `qa`, `staging`)
   - **GCP Project ID**: The project containing the environment
   - **Region**: The region used when creating the environment (default: `us-central1`)
   - **Confirm destroy**: Type `DESTROY` to confirm
   - **Destroy project**: Check only if you want to delete the entire GCP project (DANGEROUS)

### What Gets Deleted

The destroy workflow removes all resources created by the create workflow:

#### Applications
- Cloud Run service: `homecare-agent-proxy-{ENV}`
- Cloud Function: `pubsub_to_user_docs-{ENV}`
- Firebase App Hosting backend

#### Storage & Registry
- User data bucket: `homegeek-user-data-{ENV}`
- Catalog bucket: `homegeek-catalog-{ENV}`
- Firebase Storage bucket: `{PROJECT_ID}.firebasestorage.app`
- Artifact Registry repository: `cloud-run-source-deploy`

#### Messaging
- Pub/Sub topics: `user-upload-topic-{ENV}`, `user-upload-result-topic-{ENV}`
- Pub/Sub subscriptions: All related subscriptions

#### Database
- Firestore database (all data will be permanently deleted!)

#### AI/ML Resources
- RAG corpora: `user-upload-rag-corpus-{ENV}`, `knowledge-base-rag-corpus-{ENV}`
- RAG service account permissions

#### IAM & Security
- GitHub workflow deployment service account
- Firebase App Hosting deployer service account
- Workload Identity Pool and Provider
- All IAM role bindings

#### Optional: GCP Project
- If `destroy_project` is checked, the entire GCP project will be deleted (30-second warning)

### Important Notes

**⚠️ WARNING: Destruction is permanent and irreversible!**

- All data in Firestore will be permanently deleted
- All files in storage buckets will be permanently deleted
- All RAG corpora and their indexed documents will be permanently deleted
- There is no undo or recovery option

**Before destroying an environment:**
1. Backup any important data from Firestore
2. Download any important files from storage buckets
3. Ensure no active users are using the environment
4. Verify you're destroying the correct environment

**Region Matching:**
- Specify the same region used when creating the environment
- The workflow will automatically map RAG regions (e.g., us-central1 → us-west1)
- Cloud Run and Cloud Functions will be deleted from the specified region

**Project Deletion:**
- Use `destroy_project: true` ONLY if you want to delete the entire GCP project
- This will delete ALL resources in the project, not just environment-specific ones
- There is a 30-second final warning before project deletion
- Generally, leave this unchecked to preserve the project for other environments

### Troubleshooting Destroy Operations

**Error: Resources not found**
- This is normal if resources were already deleted or never created
- The workflow uses `continue-on-error: true` for all cleanup steps
- Check the logs to see which resources were successfully deleted

**Error: Permission denied**
- Ensure `ORG_WIF_PROVIDER` and `ORG_ADMIN_SERVICE_ACCOUNT` secrets are configured
- Verify the service account has proper permissions to delete resources

**Partial cleanup**
- If the workflow fails partway through, you can safely rerun it
- Already-deleted resources will be skipped
- Remaining resources will be cleaned up

**Manual cleanup needed**
- If destroy workflow fails completely, you may need to manually delete resources
- Use the Google Cloud Console to identify and delete remaining resources
- Follow the resource list above to ensure nothing is missed

## Summary

After running the `create-environment.yaml` workflow successfully, you will have:

### Automatically Configured
- ✅ GCP project (new or existing)
- ✅ All required GCP APIs enabled
- ✅ IAM service accounts and permissions
- ✅ Workload Identity for keyless authentication
- ✅ Artifact Registry repository
- ✅ GCS buckets with lifecycle policies
- ✅ Pub/Sub topics and subscriptions
- ✅ Firebase project with Firestore
- ✅ Firebase Authentication (Email/Password + Anonymous)
- ✅ Firebase Storage
- ✅ Firestore and Storage rules deployed
- ✅ GitHub environment with all variables
- ✅ RAG corpora for AI/ML workloads (if supported in region)
- ✅ Firebase App Hosting backend (if successful)

### Manual Configuration Needed
- ⚠️ Application secrets (Firebase webhook, Telegram, SerpAPI, etc.)
- ⚠️ Firebase App Hosting backend (if automated creation failed)
- ⚠️ Firebase Storage (if automated initialization failed)

### Ready to Deploy
Once the workflow completes, you can immediately deploy your applications:
- Web application via Firebase App Hosting (includes automatic Firestore rules, indexes, and Storage rules deployment)
- Homecare Agent Proxy to Cloud Run
- Cloud Functions for event processing

All infrastructure is in place and the GitHub environment is configured with the correct variables for your deployment workflows.

#### Firebase Rules Deployment
The `deploy-webapp-apphosting.yaml` workflow automatically deploys Firebase configuration alongside your application:
- **Firestore Rules & Indexes**: Deployed using the `githubworkflowdeployment` service account with full Firebase permissions
- **Storage Rules**: Deployed with graceful fallback if Firebase Storage is not fully initialized
- **Service Account Switching**: The workflow authenticates with different service accounts for different operations:
  - `githubworkflowdeployment` for Firebase rules/indexes deployment
  - `firebase-apphosting-deployer` for App Hosting deployment
- **Token-based Authentication**: Uses `gcloud auth application-default print-access-token` for Workload Identity compatibility
