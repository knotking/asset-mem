# Firebase Console Updates for Repository Name Change

When your repository changes from `HomeGeekAI/HomeApp` to `BuildGeekAI/HomeApp`, you need to update the repository connection in Firebase App Hosting.

## What Needs to be Updated

Firebase App Hosting uses **Developer Connect** to link to your GitHub repository. When the repository name changes, you need to update this connection.

## Steps to Update in Firebase Console

### Option 1: Update Existing Backend Connection (Recommended)

1. **Go to Firebase Console**
   - Navigate to: https://console.firebase.google.com/project/homegeekdemo/apphosting

2. **For Each Backend (staging, prod, etc.)**
   - Click on your backend (e.g., `staging` or `prod`)
   - Go to **Settings** or **Configuration**
   - Look for **GitHub Repository** or **Repository Connection**
   - Click **Edit** or **Reconnect**
   - Select the new repository: `BuildGeekAI/HomeApp`
   - Save the changes

### Option 2: Check Developer Connect Links

If the above doesn't work, you may need to update the Developer Connect Git repository link:

1. **Go to Google Cloud Console**
   - Navigate to: https://console.cloud.google.com/cloud-build/developer-connect?project=homegeekdemo

2. **Check Git Repository Links**
   - Look for any links pointing to `HomeGeekAI/HomeApp`
   - If found, you may need to:
     - Delete the old link
     - Create a new link pointing to `BuildGeekAI/HomeApp`

3. **Or use gcloud CLI to check:**
   ```bash
   export PROJECT_ID="homegeekdemo"
   
   # List all Git repository links
   gcloud developer-connect git-repository-links list \
     --project=$PROJECT_ID \
     --location=global
   
   # Check specific connection (if you know the connection name)
   gcloud developer-connect git-repository-links describe LINK_NAME \
     --project=$PROJECT_ID \
     --location=global \
     --connection=CONNECTION_NAME
   ```

### Option 3: Recreate Backend (Last Resort)

If updating doesn't work, you may need to recreate the backend:

1. **Delete the old backend** (if safe to do so):
   ```bash
   firebase apphosting:backends:delete BACKEND_ID \
     --project=homegeekdemo
   ```

2. **Create a new backend** with the new repository:
   ```bash
   firebase apphosting:backends:create BACKEND_ID \
     --project=homegeekdemo \
     --location=us-central1 \
     --root-dir=apps/webapp
   ```
   
   When prompted, select `BuildGeekAI/HomeApp` as the repository.

## Verification

After updating, verify the connection:

1. **Check in Firebase Console:**
   - Go to App Hosting → Your Backend → Settings
   - Verify the repository shows `BuildGeekAI/HomeApp`

2. **Test a deployment:**
   ```bash
   firebase apphosting:rollouts:create BACKEND_ID \
     --project=homegeekdemo \
     --git-branch=main
   ```

3. **Check Developer Connect:**
   ```bash
   # List connections
   gcloud developer-connect connections list \
     --project=homegeekdemo \
     --location=global
   
   # List repository links for a connection
   gcloud developer-connect git-repository-links list \
     --project=homegeekdemo \
     --location=global \
     --connection=CONNECTION_NAME
   ```

## Important Notes

- **Don't delete backends** unless you're sure you can recreate them
- **Backup your configuration** before making changes
- The repository change should **not affect** existing deployments/rollouts
- New deployments will use the new repository connection

## If You Encounter Issues

If you see errors like:
- "Repository not found"
- "Permission denied to access repository"
- "Git repository link not found"

1. **Check GitHub permissions:**
   - Ensure Firebase/Google Cloud has access to the new repository
   - You may need to reconnect GitHub in Firebase Console

2. **Check service account permissions:**
   - The service account needs `roles/developerconnect.admin` role
   - Verify with:
     ```bash
     gcloud projects get-iam-policy homegeekdemo \
       --flatten="bindings[].members" \
       --filter="bindings.members:serviceAccount:firebase-apphosting-deployer@homegeekdemo.iam.gserviceaccount.com"
     ```

3. **Re-authenticate GitHub:**
   - In Firebase Console → Project Settings → Integrations
   - Disconnect and reconnect GitHub
   - Select the new repository `BuildGeekAI/HomeApp`

