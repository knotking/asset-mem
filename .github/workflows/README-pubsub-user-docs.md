# Deploy PubSub to User Docs Cloud Function

This GitHub Action deploys the `pubsub_to_user_docs` Google Cloud Function.

## Workflow Trigger

This workflow can be triggered in two ways:

1.  **On Push**: Automatically on every `push` event to the `main` or `deploy` branches, _but only when changes are detected within the `gcp/proxy/workers/function` directory_. Pushes to `main` will deploy to the `staging` environment by default. Pushes to `deploy` will deploy to the `staging` environment by default.
2.  **Manual Dispatch**: Manually via `workflow_dispatch` from the GitHub Actions UI. When triggering manually, you can select the `environment` (staging or prod) as an input.

## Prerequisites

Before using this action, ensure you have:

1.  **Google Cloud Projects**: Separate GCP projects for `staging` (e.g., `homegeekdemo`) and `prod` (e.g., `homegeek-prod`).
2.  **Service Accounts**: Dedicated service accounts for each environment with the necessary permissions to deploy Cloud Functions and manage other GCP resources (e.g., Pub/Sub, Cloud Storage, Vertex AI RAG).
    - Staging: `githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com`
    - Production: `githubworkflowdeployment@homegeek-prod.iam.gserviceaccount.com`
3.  **Workload Identity Federation**: Set up Workload Identity Federation between your GitHub repository and your GCP projects for both staging and production. You will need to replace the placeholder `workload_identity_provider` value in the workflow with your actual provider ID.
4.  **Pub/Sub Topics**: Ensure the `user-upload-topic` and `user-upload-result-topic` exist in both your staging and production projects, with appropriate environment suffixes (e.g., `user-upload-topic-prod`).
5.  **Google Cloud Storage Buckets**: Ensure the `homegeek-user-data` bucket exists in both your staging and production projects, with appropriate environment suffixes (e.g., `homegeek-user-data-prod`).
6.  **Vertex AI RAG Corpus**: Ensure the RAG Corpus exists in both your staging and production projects.

## Environment Variables

The following environment variables are set for the Cloud Function, dynamically based on the selected `environment` input:

- `GCP_PROJECT_ID`: Your Google Cloud Project ID (staging or production).
- `GCP_REGION`: The GCP region where the function is deployed (`us-central1`).
- `GCS_BUCKET`: The Google Cloud Storage bucket for user data (e.g., `homegeek-user-data-prod`).
- `USER_UPLOAD_RESULT_TOPIC`: The full Pub/Sub topic path for user upload results (e.g., `projects/homegeek-prod/topics/user-upload-result-topic-prod`).
- `RAG_CORPUS`: The full path to the Vertex AI RAG Corpus (e.g., `projects/homegeek-prod/locations/us-central1/ragCorpora/1689975760170778624`).

## Usage

1.  Create the workflow file `.github/workflows/deploy-pubsub-user-docs.yaml` in your repository.
2.  Update the `workload_identity_provider` in the workflow with your specific Workload Identity Provider ID.
3.  Update the `STAGING_PROJECT_ID`, `STAGING_SERVICE_ACCOUNT_EMAIL`, `STAGING_TRIGGER_TOPIC`, `STAGING_GCS_BUCKET`, `STAGING_USER_UPLOAD_RESULT_TOPIC_PATH`, `STAGING_RAG_CORPUS`, `PROD_PROJECT_ID`, `PROD_SERVICE_ACCOUNT_EMAIL`, `PROD_TRIGGER_TOPIC`, `PROD_GCS_BUCKET`, `PROD_USER_UPLOAD_RESULT_TOPIC_PATH`, and `PROD_RAG_CORPUS` variables in the workflow with your actual environment-specific values.
4.  To deploy:
    - **Automatic Staging Deployment**: Push your changes to the `main` branch (within `gcp/proxy/workers/function`).
    - **Automatic Production Deployment**: Push your changes to the `deploy` branch (within `gcp/proxy/workers/function`).
    - **Manual Deployment (Staging/Prod)**: Go to the "Actions" tab in your GitHub repository, select "Deploy PubSub to User Docs Function" workflow, click "Run workflow", and choose your desired `environment`.
