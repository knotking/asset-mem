# Deploy Checkpoint Analysis Cloud Function

This GitHub Action deploys the `pubsub_checkpoint_analysis` Google Cloud Function that processes checkpoint image analysis requests asynchronously via Pub/Sub.

## Workflow Trigger

This workflow can be triggered in two ways:

1. **On Push**: Automatically on every `push` event to the `main` branch, _but only when changes are detected within the `gcp/proxy/workers/function` directory_. Pushes to `main` will deploy to the `staging` environment by default.
2. **Manual Dispatch**: Manually via `workflow_dispatch` from the GitHub Actions UI. When triggering manually, you can select the `environment` (staging or prod) as an input.

## Prerequisites

Before using this action, ensure you have:

1. **Google Cloud Projects**: Separate GCP projects for `staging` (e.g., `homegeek-staging`) and `prod` (e.g., `homegeek-prod`).
2. **Service Accounts**: Dedicated service accounts for each environment with the necessary permissions to deploy Cloud Functions and manage other GCP resources (e.g., Pub/Sub, Firestore, Vertex AI).
   - Staging: `githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com`
   - Production: `githubworkflowdeployment@homegeek-prod.iam.gserviceaccount.com`
3. **Workload Identity Federation**: Set up Workload Identity Federation between your GitHub repository and your GCP projects for both staging and production.
4. **Pub/Sub Topic**: Ensure the `checkpoint-analysis-topic` exists in both your staging and production projects, with appropriate environment suffixes (e.g., `checkpoint-analysis-topic-prod`).
5. **IAM Permissions**: The service account needs:
   - `roles/aiplatform.user` - To call Gemini AI
   - `roles/firestore.user` - To update Firestore checkpoint documents
   - `roles/pubsub.subscriber` - To receive Pub/Sub messages

## Environment Variables

The following environment variables are set for the Cloud Function, dynamically based on the selected `environment` input:

- `GCP_PROJECT_ID`: Your Google Cloud Project ID (staging or production).
- `GCP_LOCATION`: The GCP location for Vertex AI (e.g., `us-central1`).

## Required GitHub Variables

Set these variables in your GitHub repository settings (Settings → Secrets and variables → Actions → Variables):

### Required Variables

- `GCP_REGION`: The GCP region where the function is deployed (e.g., `us-central1`)
- `GCP_PROJECT_ID`: Your Google Cloud Project ID (e.g., `homegeek-staging`)
- `CHECKPOINT_ANALYSIS_TOPIC`: The Pub/Sub topic name for checkpoint analysis (e.g., `checkpoint-analysis-topic`)
- `WORKLOAD_IDENTITY_PROVIDER`: Your Workload Identity Provider ID
- `GCP_SERVICE_ACCOUNT_EMAIL`: The service account email for deployment (e.g., `githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com`)

## Function Configuration

- **Runtime**: Python 3.13
- **Memory**: 512Mi
- **Max Instances**: 10 (for handling concurrent checkpoint analyses)
- **Concurrency**: 1 (sequential processing per instance)
- **Trigger**: Pub/Sub topic (`checkpoint-analysis-topic`)
- **Entry Point**: `pubsub_checkpoint_analysis`

## Usage

1. **Set Required GitHub Variables**: Ensure all required variables are set in your GitHub repository settings.
2. **Create Pub/Sub Topic** (if not already created):
   ```bash
   gcloud pubsub topics create checkpoint-analysis-topic
   ```
3. **Deploy**:
   - **Automatic Staging Deployment**: Push your changes to the `main` branch (within `gcp/proxy/workers/function`).
   - **Manual Deployment (Staging/Prod)**: Go to the "Actions" tab in your GitHub repository, select "Deploy Checkpoint Analysis Function" workflow, click "Run workflow", and choose your desired `environment`.

## Shared code (`gcp/common`)

The deploy job **rsyncs** `gcp/common/observability` and `gcp/common/token` into `checkpoint_analysis/common/` before upload. The function imports both packages; omitting `token` causes `ModuleNotFoundError: No module named 'common.token'` at cold start.

## How It Works

1. The API endpoint (`/analyze-checkpoint`) publishes a message to the `checkpoint-analysis-topic`.
2. This Cloud Function is triggered by the Pub/Sub message.
3. The function:
   - Parses the checkpoint analysis request
   - Calls Gemini AI to analyze the checkpoint image
   - Updates the Firestore checkpoint document with analysis results
   - Sets `analysisStatus` to `completed` on success or `failed` on error

## Monitoring

- Check Cloud Function logs in GCP Console: Cloud Functions → `pubsub-checkpoint-analysis-{environment}`
- Monitor Pub/Sub subscription metrics for message processing
- Monitor Firestore writes for checkpoint document updates

## Troubleshooting

- **Function not triggering**: Verify the Pub/Sub topic name matches `CHECKPOINT_ANALYSIS_TOPIC` variable
- **Permission errors**: Ensure service account has `roles/firestore.user` and `roles/aiplatform.user`
- **Analysis failures**: Check Cloud Function logs for Gemini API errors or Firestore write errors

## Related Documentation

- [Workers README](../../gcp/proxy/workers/README.md) - Background workers documentation
- [Checkpoint Analysis API](../../gcp/proxy/docs/CHECKPOINT_ANALYSIS_API.md) - API endpoint documentation
