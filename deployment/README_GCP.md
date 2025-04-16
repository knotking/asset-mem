# Google Cloud Platform (GCP) Deployment Guide

This document provides instructions for setting up and deploying the HomeAMA project on Google Cloud Platform (GCP). It includes details on configuring GCP resources, setting up GitHub Actions, and managing secrets.

---

## Prerequisites

1. **Install Required Tools (Optional - Managed via github workflow)** :
   - Install Terraform:
     ```bash
     brew install terraform
     ```
   - Install Google Cloud SDK:
     ```bash
     brew install --cask google-cloud-sdk
     ```
   - Initialize Google Cloud SDK:
     ```bash
     gcloud init
     ```
   - Add Google Cloud SDK to your shell:
     ```bash
     source "$(brew --prefix)/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.bash.inc"
     ```
     OR
     ```bash
     source "$(brew --prefix)/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.zsh.inc"
     ```
---

## GCP Resource Setup

### 1. **Enable External IP Access**:
   - In the GCP Console:
     - Navigate to **Menu → Organization Policies → compute.vmExternalIpAccess**.
     - Edit the policy to **Allow**.

### 2. **Storage Bucket for Terraform State**
Create a Google Cloud Storage bucket to store the Terraform state:
```bash
gcloud storage buckets create gs://homegeek-terraform-state --location=US
```

### 3. **Secret Manager**
Create a secret to store your GitHub personal access token:
```bash
gcloud secrets create github-token --data-file=<(echo "your_github_pat_token")
```
Grant access to the service account:
```bash
gcloud secrets add-iam-policy-binding github-token \
  --project=homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4. **IAM Roles for Service Account**
Assign the necessary roles to the service account:
```bash
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/compute.securityAdmin"

gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin.v1"

gcloud projects add-iam-policy-binding homegeekdemo \
  --member="githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/compute.networkAdmin"

gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/compute.osLogin"
```

---

## GitHub Actions Configuration

### 1. **Google Cloud Service Account**
- Create a service account in Google Cloud with the necessary permissions (e.g., `roles/compute.admin`, `roles/storage.admin`).
- Generate a JSON key for the service account and add it as a GitHub secret.

### 2. **GitHub Secrets**
Add the following secrets to your GitHub repository:
- **`GCP_PROJECT_ID`**: The Google Cloud project ID.
- **`GCP_SERVICE_ACCOUNT_KEY`**: The JSON key for the service account.
- **`GCS_BACKEND_BUCKET`**: The Google Cloud bucket name to store the Terraform state.

---

## High-Level Description of Resources
### 1. ***Google Cloud Resource Manager API**
- **Purpose**: Used for automated deployments by service account.
- **Significane**: Github automated workflow for updating repository will require these permissions.
### 2. **Google Cloud Storage Bucket**
- **Purpose**: Stores the Terraform state file, which tracks the infrastructure's current state.
- **Significance**: Ensures consistency and enables collaboration when managing infrastructure using Terraform.

### 3. **Google Cloud Secret Manager**
- **Purpose**: Securely stores sensitive information, such as the GitHub personal access token.
- **Significance**: Protects secrets from being exposed in plaintext and provides controlled access.

### 4. **IAM Roles**
- **Roles Assigned**:
  - `roles/compute.securityAdmin`: Manages security configurations for Compute Engine.
  - `roles/compute.instanceAdmin.v1`: Administers Compute Engine instances.
  - `roles/compute.networkAdmin`: Manages network configurations.
  - `roles/storage.objectAdmin`: Grants access to manage objects in Cloud Storage.
  - `roles/compute.osLogin`: Allows OS login for Compute Engine instances.
- **Significance**: Ensures the service account has the necessary permissions to deploy and manage resources.

### 5. **GitHub Secrets**
- **Purpose**: Stores sensitive information required for GitHub Actions workflows.
- **Significance**: Enables secure and automated deployment processes.

---

## Summary

This guide outlines the steps to configure GCP resources and GitHub Actions for deploying the HomeAMA project. By following these instructions, you can securely and efficiently manage your infrastructure and deployment workflows.

For further assistance, refer to the official documentation for [Google Cloud](https://cloud.google.com/docs) and [GitHub Actions](https://docs.github.com/en/actions).