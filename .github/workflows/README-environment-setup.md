# GitHub Environment Setup

## Prerequisites

The `create-environment.yaml` workflow requires a Personal Access Token (PAT) with permissions to create and manage GitHub environments.

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

### 3. Verify the Setup

The workflow will now use `${{ secrets.GH_PAT_ENV_ADMIN }}` instead of `${{ github.token }}` to:
- Create GitHub environments
- Set environment variables
- Read environment variables

## Alternative: GitHub App

For production use, consider using a GitHub App instead of a PAT:
- More secure (scoped to specific permissions)
- Doesn't expire based on user account
- Better audit trail

## Troubleshooting

### Error: "Resource not accessible by integration (HTTP 403)"

This error means the token doesn't have sufficient permissions. Verify:
1. The `GH_PAT_ENV_ADMIN` secret exists
2. The token has the `repo` scope
3. The token hasn't expired

### Error: "Bad credentials (HTTP 401)"

This means the token is invalid or expired. Generate a new token and update the secret.
