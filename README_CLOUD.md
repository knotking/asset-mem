# Cloud Deployment Guide

This guide provides instructions for deploying and updating the project in the cloud using GitHub Actions workflows and the `startup.sh` script.

---

## Overview

The project includes the following components for cloud deployment and updates:

1. **GitHub Actions Workflows**:
   - **`deploy.yaml`**: Automates the deployment and destroy of infrastructure using Terraform.
   - **`update.yml`**: Updates the repository and restarts Docker services on a cloud instance.
2. **`deployment/terraform/scripts/startup.sh` Script**:
   - A shell script executed on the cloud instance to install, clone the repo and initialize the application using docker.

---

## Prerequisites

Before running the workflows or the `startup.sh` script, ensure the following:

1. **Secrets Configuration**:
   - Add the following secrets to your GitHub repository:
     - `GCP_SERVICE_ACCOUNT_KEY`: Service account key for Google Cloud authentication.
     - `GCP_PROJECT_ID`: Google Cloud project ID.
     - `GCS_BACKEND_BUCKET`: GCS bucket for Terraform state storage.
     - Any other environment-specific secrets required for deployment.

2. **Environment-Specific Inputs**:
   - Supported environments: `demo`, `staging`, `prod`.

3. **Tools (Optional for Local Debugging)**:
   - Terraform (`v1.9.0` or compatible).
   - Google Cloud SDK.
   - Docker and Docker Compose.

---

## Workflow 1: Terraform Deployment (`deploy.yaml`)

### Purpose
Automates the deployment of infrastructure using Terraform. Supports creating and destroying resources.

### Trigger
Manually triggered via `workflow_dispatch` with the following inputs:
- `environment`: Specifies the deployment environment (default: `demo`).
- `destroy`: Indicates whether to destroy resources (default: `false`).

### Steps
1. **Terraform Init**: Initializes Terraform with backend configuration.
2. **Terraform Validate**: Validates the Terraform configuration.
3. **Terraform Plan**: Generates a plan for infrastructure changes.
4. **Terraform Apply**: Applies the plan to deploy resources.
5. **Terraform Destroy** (if `destroy=true`): Destroys the infrastructure.

### Example Trigger
To deploy infrastructure to the `staging` environment:
1. Go to the **Actions** tab in your GitHub repository.
2. Select the `Terraform Deployment` workflow.
3. Click **Run workflow** and provide the following inputs:
   - `environment`: `staging`
   - `destroy`: `false`

---

## Workflow 2: Update Repository and Restart Docker (`update.yml`)

### Purpose
Updates the repository and restarts Docker services on a cloud instance.

### Trigger
Manually triggered via `workflow_dispatch` with the following inputs:
- `environment`: Specifies the deployment environment (e.g., `demo`, `staging`, `prod`).
- `zone`: Specifies the GCP zone where the instance is located (default: `us-central1-a`).

### Steps
1. **Authenticate to Google Cloud**: Authenticates with GCP using a service account key.
2. **Run Update Script**:
   - Pulls the latest changes from the repository.
   - Copies the appropriate `.env` file for the environment.
   - Restarts Docker Compose services.
3. **Retrieve Update Log**: Displays the update log for debugging.
4. **Clean Up**: Removes temporary sensitive files.

### Example Trigger
To update the repository and restart Docker services in the `prod` environment:
1. Go to the **Actions** tab in your GitHub repository.
2. Select the `Update Repository and Restart Docker` workflow.
3. Click **Run workflow** and provide the following inputs:
   - `environment`: `prod`
   - `zone`: `us-central1-a`

---

## Workflow 3: Terraform Destroy (`deploy.yaml`)

### Purpose
Automates the destruction of infrastructure using Terraform.

### Trigger
Manually triggered via `workflow_dispatch` with the following inputs:
- `environment`: Specifies the deployment environment (e.g., `demo`, `staging`, `prod`).
- `destroy`: Flag to enable destroy steps

### Steps
1. **Terraform Init**: Initializes Terraform with backend configuration.
2. **Terraform Validate**: Validates the Terraform configuration.
3. **Terraform Plan (Destroy)**: Generates a plan to destroy the infrastructure.
4. **Terraform Destroy**: Executes the plan to remove all resources.

### Example Trigger
To destroy infrastructure in the `demo` environment:
1. Go to the **Actions** tab in your GitHub repository.
2. Select the `Terraform Destroy` workflow.
3. Click **Run workflow** and provide the following input:
   - `environment`: `demo`
   - `destory`: `true`

---

## Important Notes on Terraform Destroy

- **Resources Not Destroyed**:
  - The following resources are not destroyed by the `Terraform Destroy` workflow:
    - **Static IP Address**: The static IP address is pre-created and managed outside of Terraform.
    - **Google Cloud Storage Bucket**: The bucket used for Terraform state storage is not deleted to preserve state files.
    - **Service Account**: The service account used for deployment is not removed to ensure future workflows can run without interruption.
    - **Google Cloud Secret Manager**: The github token used for github repo cloning is not removed.

- **Manual Cleanup**:
  - If you need to delete these resources, you must do so manually via the GCP Console or CLI.

---

## Monitoring and Debugging

1. **Workflow Logs**:
   - Monitor the workflow runs in the **Actions** tab of your GitHub repository.
   - Check logs for errors during the deployment or update process.

2. **Terraform Artifacts**:
   - The `deploy.yaml` workflow uploads the Terraform plan as an artifact for review.

3. **Cloud Instance Logs**:
   - The `update.yml` workflow retrieves and displays logs from the cloud instance for debugging.
   - The `startup.sh` script generates an `update.log` file on the instance.

---

## Additional Notes

- **Environment-Specific Configuration**:
  - Ensure the `.env` files for each environment (`demo`, `staging`, `prod`) are correctly configured.

- **Terraform State**:
  - Terraform state is stored in a GCS bucket specified by the `GCS_BACKEND_BUCKET` secret.

- **Docker Services**:
  - The `update.yml` workflow and `startup.sh` script assume Docker Compose is used to manage services on the cloud instance.

For further assistance, refer to the `.github/workflows` directory or contact the project maintainer.