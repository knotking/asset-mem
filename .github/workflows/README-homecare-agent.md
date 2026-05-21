# Deploy Homecare Agent Engine

This GitHub Action deploys the Homecare Agent Engine to Google Cloud Vertex AI Agent Engine.

## Workflow Trigger

This workflow can be triggered in two ways:

1.  **On Push**: Automatically on every `push` event to the `main` or `deploy` branches, _but only when changes are detected within the `gcp/agents/homecare/deployment/` or `gcp/agents/homecare/property_agent/` directories_. Pushes to `main` will deploy to the `staging` environment by default. Pushes to `deploy` will deploy to the `staging` environment by default.
2.  **Manual Dispatch**: Manually via `workflow_dispatch` from the GitHub Actions UI. When triggering manually, you can select the `environment` (staging or prod) and the `action` (create or update) as inputs.

## Prerequisites

Before using this action, ensure you have:

1.  **Google Cloud Projects**: Separate GCP projects for `staging` (e.g., `homegeek-staging`) and `prod` (e.g., `homegeek-prod`).
2.  **Service Account**: A service account with the necessary permissions to deploy and manage Vertex AI Agent Engines and other GCP resources (e.g., Cloud Storage, Pub/Sub, Vertex AI RAG). The service account email will be dynamically set based on the environment.
3.  **Workload Identity Federation**: Set up Workload Identity Federation between your GitHub repository and your GCP projects for both staging and production. You will need to replace the placeholder `workload_identity_provider` value in the workflow with your actual provider ID.
4.  **Google Cloud Storage Buckets**: Ensure the necessary staging buckets for the agent engine and user data buckets exist in both your staging and production projects, with appropriate environment suffixes.
5.  **Vertex AI RAG Corpora**: Ensure the user upload and knowledge base RAG Corpora exist in both your staging and production projects.
6.  **Pub/Sub Topics**: Ensure the `user-upload-topic` exists in both your staging and production projects, with appropriate environment suffixes.
7.  **GitHub Secrets**: The following secrets must be configured in your GitHub repository:
    - `STAGING_SERP_API_KEY`: SerpAPI key for the staging environment.
    - `STAGING_`: SerpAPI key for the staging environment.
    - `PROD_SERP_API_KEY`: SerpAPI key for the production environment.
    - `PROD_`: SerpAPI key for the production environment.

## Environment Variables

The following environment variables are set for the deployment script, dynamically based on the selected `environment` input:

- `GOOGLE_CLOUD_PROJECT`: Your Google Cloud Project ID (staging or production).
- `GOOGLE_CLOUD_LOCATION`: The GCP region where the agent is deployed (`us-central1`).
- `STAGING_BUCKET`: The GCS bucket used by Vertex AI for staging during deployment.
- `AGENT_ENGINE_ID`: The ID of the Vertex AI Agent Engine.
- `GOOGLE_CLOUD_BUCKET`: The GCS bucket for user data.
- `USER_UPLOAD_FOLDER`: The folder within the GCS bucket for user uploads.
- `USER_UPLOAD_RAG_CORPUS`: The full path to the Vertex AI RAG Corpus for user uploads.
- `KNOWLEDGE_BASE_RAG_CORPUS`: The full path to the Vertex AI RAG Corpus for the knowledge base.
- `USER_UPLOAD_TOPIC`: The Pub/Sub topic for user uploads.
- `SERP_API_KEY`: (From GitHub Secret) SerpAPI key.
- ``: (From GitHub Secret) SerpAPI key.
- ``: The SerpAPI URL.

## Usage

1.  Create the workflow file `.github/workflows/deploy-homecare-agent.yaml` in your repository.
2.  Create the `requirements.txt` file in `gcp/agents/homecare/` with the necessary Python dependencies.
3.  Update the `workload_identity_provider` in the workflow with your specific Workload Identity Provider ID.
4.  Update all environment-specific placeholder variables (e.g., `STAGING_GOOGLE_CLOUD_PROJECT`, `PROD_AGENT_ENGINE_ID`, etc.) in the workflow with your actual values.
5.  Configure the required GitHub Secrets in your repository settings.
6.  To deploy:
    - **Automatic Staging Deployment**: Push your changes to the `main` branch (within `gcp/agents/homecare/deployment/` or `gcp/agents/homecare/property_agent/`).
    - **Automatic Production Deployment**: Push your changes to the `deploy` branch (within `gcp/agents/homecare/deployment/` or `gcp/agents/homecare/property_agent/`).
    - **Manual Deployment (Staging/Prod, Create/Update)**: Go to the "Actions" tab in your GitHub repository, select "Deploy Homecare Agent Engine" workflow, click "Run workflow", and choose your desired `environment` and `action`.
