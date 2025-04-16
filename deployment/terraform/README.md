# Terraform Deployment Guide for GCP

This document provides step-by-step instructions for deploying infrastructure on Google Cloud Platform (GCP) using Terraform. All the steps are managed via github workflow. So local installation and execution will not be required.

---

## Steps to Deploy

1. **Initialize Terraform**:
   Run the following command to initialize the Terraform working directory:
   ```bash
   terraform init
   ```

2. **Authenticate with Google Cloud**:
   Log in to your Google Cloud account:
   ```bash
   gcloud auth login
   ```
   Set up application default credentials:
   ```bash
   gcloud auth application-default login
   ```

3. **Generate a Terraform Plan**:
   Create a plan to preview the changes Terraform will make:
   ```bash
   terraform plan -out gcp_compute_plan
   ```

4. **Apply the Terraform Plan**:
   Execute the plan to deploy the infrastructure:
   ```bash
   terraform apply gcp_compute_plan
   ```

---

## Notes

- Ensure that your Google Cloud SDK is installed and configured before running these commands.
- The `terraform init` command must be run in the directory containing your Terraform configuration files.
- Use the `terraform plan` command to review changes before applying them to avoid unintended modifications.

For further assistance, refer to the [Terraform Documentation](https://www.terraform.io/docs) or the [Google Cloud Documentation](https://cloud.google.com/docs).