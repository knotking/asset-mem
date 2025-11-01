# Deploy Homecare Agent Proxy

This GitHub Action deploys the `homecare-agent-proxy` service to Google Cloud Run.

## Workflow Trigger

This workflow can be triggered in two ways:

1.  **On Push**: Automatically on every `push` event to the `main` or `deploy` branches, _but only when changes are detected within the `gcp/proxy/api` directory_. Pushes to `main` will deploy to the `staging` environment by default. Pushes to `deploy` will deploy to the `staging` environment by default.
2.  **Manual Dispatch**: Manually via `workflow_dispatch` from the GitHub Actions UI. When triggering manually, you can select the `environment` (staging or prod) as an input.

## Prerequisites

Before using this action, ensure you have:

1.  **Google Cloud Projects**: Separate GCP projects for `staging` (e.g., `homegeekdemo`) and `prod` (e.g., `homegeek-prod`).
2.  **Service Accounts**: Dedicated service accounts for each environment with the necessary permissions to deploy to Cloud Run and manage other GCP resources (e.g., Pub/Sub, Cloud Storage).
    - Staging: `githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com`
    - Production: `githubworkflowdeployment@homegeek-prod.iam.gserviceaccount.com`
3.  **Workload Identity Federation**: Set up Workload Identity Federation between your GitHub repository and your GCP projects for both staging and production. You will need to replace the placeholder `workload_identity_provider` value in the workflow with your actual provider ID.
4.  **GitHub Secrets**: The following secrets must be configured in your GitHub repository:
    - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token (should be environment-specific if different).
    - `TELEGRAM_WEBHOOK_SECRET`: A secret for Telegram webhook validation (should be environment-specific if different).
    - `FIREBASE_WEBHOOK_SECRET`: A secret for Firebase webhook validation (should be environment-specific if different).

## Environment Variables

The following environment variables are set for the Cloud Run service, dynamically based on the selected `environment` input. Note that `SERVICE_NAME`, `USER_UPLOAD_TOPIC`, `USER_UPLOAD_RESULT_SUBSCRIPTION`, and `GCS_BUCKET` will have an environment suffix (``or`-prod`) appended to their base names.

- `GCP_PROJECT_ID`: Your Google Cloud Project ID (staging or production).
- `GCP_REGION`: The GCP region where the service is deployed (`us-central1`).
- `REASONING_ENGINE_ID`: The ID of the reasoning engine (staging or production specific).
- `SERVICE_NAME`: The name of the Cloud Run service (e.g., `homecare-agent-proxy-prod`).
- `TELEGRAM_BOT_TOKEN`: (From GitHub Secret) Your Telegram bot token.
- `TELEGRAM_WEBHOOK_SECRET`: (From GitHub Secret) Your Telegram webhook secret.
- `FIREBASE_WEBHOOK_SECRET`: (From GitHub Secret) Your Firebase webhook secret.
- `USER_UPLOAD_TOPIC`: The Pub/Sub topic for user uploads (e.g., `user-upload-topic-prod`).
- `USER_UPLOAD_RESULT_SUBSCRIPTION`: The Pub/Sub subscription for user upload results (e.g., `user-upload-result-subscription-prod`).
- `GCS_BUCKET`: The Google Cloud Storage bucket for user data (e.g., `homegeek-user-data-prod`).

## Usage

1.  Create the workflow file `.github/workflows/deploy-homecare-agent-proxy.yaml` in your repository.
2.  Update the `workload_identity_provider` in the workflow with your specific Workload Identity Provider ID.
3.  Update the `STAGING_PROJECT_ID`, `STAGING_SERVICE_ACCOUNT_EMAIL`, `STAGING_REASONING_ENGINE_ID`, `PROD_PROJECT_ID`, `PROD_SERVICE_ACCOUNT_EMAIL`, and `PROD_REASONING_ENGINE_ID` variables in the workflow with your actual environment-specific values.
4.  Configure the required GitHub Secrets in your repository settings.
5.  To deploy:
    - **Automatic Staging Deployment**: Push your changes to the `main` branch.
    - **Manual Deployment (Staging/Prod)**: Go to the "Actions" tab in your GitHub repository, select "Deploy Homecare Agent Proxy" workflow, click "Run workflow", and choose your desired `environment`.
