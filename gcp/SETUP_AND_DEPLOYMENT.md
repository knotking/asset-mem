# GCP Setup and Deployment Guide

This document provides comprehensive instructions for setting up and deploying the various components within the `gcp` directory, including the AI agents and the proxy service. It covers prerequisites, project setup, environment configuration, and deployment steps for both agents and the proxy.

## 1. Prerequisites

Before proceeding with the setup and deployment, ensure you have the following:

- **Google Cloud Account:** A Google Cloud account with an active project.
- **Google Cloud SDK:** The `gcloud` command-line tool installed and authenticated.
  ```bash
  gcloud auth login
  gcloud config set project your-project-id
  ```
- **Python 3.9+:** Ensure you have Python 3.9 or a later version installed.
- **Poetry:** Install Poetry by following the instructions on the official Poetry website: [https://python-poetry.org/docs/](https://python-poetry.org/docs/)
- **Git:** Ensure you have Git installed.
- **Docker:** Docker installed and running for building container images.

## 2. Initial Google Cloud Project Setup

Enable necessary Google Cloud APIs and set up service accounts.

### 2.1. Enable Google Cloud Services

```bash
gcloud services enable \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    aiplatform.googleapis.com \
    pubsub.googleapis.com
```

### 2.2. Create and Configure Service Accounts

#### 2.2.1. Cloud Run Service Account (e.g., `githubworkflowdeployment`)

This service account is used for deploying the proxy service to Cloud Run.

1.  **Create a new service account** (if not already existing): Go to Google Cloud Console > IAM & Admin > Service Accounts and create a new service account (e.g., `githubworkflowdeployment@your-project-id.iam.gserviceaccount.com`).
2.  **Grant essential roles**:
    ```bash
    gcloud projects add-iam-policy-binding your-project-id \
        --member="serviceAccount:githubworkflowdeployment@your-project-id.iam.gserviceaccount.com" \
        --role="roles/run.developer"
    gcloud projects add-iam-policy-binding your-project-id \
        --member="serviceAccount:githubworkflowdeployment@your-project-id.iam.gserviceaccount.com" \
        --role="roles/artifactregistry.writer"
    gcloud projects add-iam-policy-binding your-project-id \
        --member="serviceAccount:githubworkflowdeployment@your-project-id.iam.gserviceaccount.com" \
        --role="roles/cloudbuild.builds.editor"
    gcloud projects add-iam-policy-binding your-project-id \
        --member="serviceAccount:githubworkflowdeployment@your-project-id.iam.gserviceaccount.com" \
        --role="roles/serviceusage.serviceUsageConsumer"
    gcloud projects add-iam-policy-binding your-project-id \
        --member="serviceAccount:githubworkflowdeployment@your-project-id.iam.gserviceaccount.com" \
        --role="roles/iam.serviceAccountUser" # For compute service account
    gcloud projects add-iam-policy-binding your-project-id \
        --member="serviceAccount:githubworkflowdeployment@your-project-id.iam.gserviceaccount.com" \
        --role="roles/artifactregistry.repoAdmin"
    gcloud projects add-iam-policy-binding your-project-id \
        --member="serviceAccount:githubworkflowdeployment@your-project-id.iam.gserviceaccount.com" \
        --role="roles/storage.admin"
    gcloud projects add-iam-policy-binding your-project-id \
        --member="serviceAccount:githubworkflowdeployment@your-project-id.iam.gserviceaccount.com" \
        --role="roles/pubsub.editor"
    ```

#### 2.2.2. Vertex AI User Role for Cloud Run Service Account

This allows the Cloud Run service to call your Reasoning Engine.

```bash
gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:githubworkflowdeployment@your-project-id.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"
```

#### 2.2.3. AI Platform Reasoning Engine Service Agent Permissions

Grant necessary permissions to the AI Platform Reasoning Engine Service Agent.

```bash
gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:service-<PROJECT_NUMBER>@gcp-sa-aiplatform-re.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"
```

## 3. Agents Deployment (`agents/homecare/`)

This section details the setup and deployment of the AI agents.

### 3.1. Project Setup with Poetry

1.  **Navigate to the `homecare` directory:**

    ```bash
    cd /Users/prakashbaskaran/projects/HomeApp/gcp/agents/homecare
    ```

2.  **Install Dependencies with Poetry:**

    ```bash
    poetry install
    ```

    This command reads the `pyproject.toml` file and installs all the necessary dependencies into a virtual environment managed by Poetry.

3.  **Activate the Poetry Shell:**
    ```bash
    poetry env activate
    ```
    Alternatively, you can activate it using:
    ```bash
    source .venv/bin/activate
    ```

### 3.2. Environment Variables (`.env` file)

Rename `.env.example` to `.env` and configure the following variables in `/Users/prakashbaskaran/projects/HomeApp/gcp/agents/homecare/.env` (or similar location based on your project structure):

- `GOOGLE_CLOUD_PROJECT=your-project-id`
- `GOOGLE_CLOUD_LOCATION=your-location` (e.g., `us-central1`)
- `RAG_CORPUS=projects/<project-number>/locations/us-central1/ragCorpora/<corpus-id>` (if existing)
- `KNOWLEDGE_BASE_RAG_CORPUS=projects/<project-number>/locations/us-central1/ragCorpora/<corpus-id>`
- `USER_UPLOAD_RAG_CORPUS=projects/<project-number>/locations/us-central1/ragCorpora/<corpus-id>`
- `GCS_BUCKET=your-gcs-bucket-for-uploads`
- `USER_UPLOAD_FOLDER=uploads` (default)

### 3.3. Setup RAG Corpus (if not already set up)

If you don't have a RAG corpus setup yet, you can use a script to create one and upload initial data. Refer to the `rag/shared_libraries/prepare_corpus_and_data.py` (if available in your project) or manually create one via Vertex AI console.

### 3.4. Deploying the Agent to Vertex AI Agent Engine

1.  **Navigate to the `homecare` directory:**

    ```bash
    cd /Users/prakashbaskaran/projects/HomeApp/gcp/agents/homecare
    ```

2.  **Run the deployment script:**
    ```bash
    poetry run python deployment/deploy.py
    ```
    Upon successful deployment, you will see an INFO log message containing the `AGENT_ENGINE_ID`. Update your `.env` file with this `AGENT_ENGINE_ID`.

### 3.5. Grant RAG Corpus Access Permissions

After deploying the agent, ensure the deployed agent has access to your RAG corpus.

1.  **Navigate to the `homecare` directory:**

    ```bash
    cd /Users/prakashbaskaran/projects/HomeApp/gcp/agents/homecare
    ```

2.  **Run the permissions script:**
    ```bash
    chmod +x deployment/grant_permissions.sh
    ./deployment/grant_permissions.sh
    ```
    This script reads your environment variables, creates a custom role with RAG Corpus query permissions, and grants them to the AI Platform Reasoning Engine Service Agent.

### 3.6. Testing the Deployed Agent

1.  **Navigate to the `homecare` directory:**

    ```bash
    cd /Users/prakashbaskaran/projects/HomeApp/gcp/agents/homecare
    ```

2.  **Run the test script:**
    ```bash
    python deployment/run.py
    ```

## 4. Proxy Service Deployment (`proxy/api/` and `proxy/workers/function/`)

This section outlines the deployment of the FastAPI proxy application and the Pub/Sub worker function to Google Cloud Run and Cloud Functions, respectively.

### 4.1. Pub/Sub Topic and Subscription Setup

Before deploying the proxy or worker, create the necessary Pub/Sub topics and subscriptions.

```bash
gcloud pubsub topics create user-upload-topic
gcloud pubsub topics create user-upload-result-topic
gcloud pubsub subscriptions create user-upload-topic-subscription --topic=user-upload-topic
gcloud pubsub subscriptions create user-upload-result-subscription --topic=user-upload-result-topic
```

### 4.2. Proxy API Service Deployment to Cloud Run

This deploys the `main.py` FastAPI application to Cloud Run.

1.  **Create a Telegram Bot & Get Token (if using Telegram integration)**:

    - Talk to `@BotFather` on Telegram. Use `/newbot` to create your bot and get its HTTP API Token.
    - You will set the webhook URL after Cloud Run deployment.

2.  **Set Environment Variables for Cloud Run**: These variables are crucial for the proxy service.

    - `GCP_PROJECT_ID`: Your Google Cloud project ID.
    - `GCP_REGION`: The region of your Reasoning Engine (e.g., `us-central1`).
    - `REASONING_ENGINE_ID`: The ID of your deployed Reasoning Engine (from agent deployment).
    - `TELEGRAM_BOT_TOKEN`: Your bot's API token from BotFather.
    - `TELEGRAM_WEBHOOK_SECRET`: A strong, random secret string (e.g., generated by `openssl rand -hex 32`). This will be part of your webhook URL.
    - `FIREBASE_WEBHOOK_SECRET`: A strong, random secret string for Firebase webhooks.
    - `USER_UPLOAD_TOPIC`: The name of your user upload Pub/Sub topic (e.g., `user-upload-topic`).
    - `USER_UPLOAD_RESULT_SUBSCRIPTION`: The name of your user upload result Pub/Sub subscription (e.g., `user-upload-result-subscription`).
    - `GCS_BUCKET`: The name of your GCS bucket for user uploads (e.g., `homegeek-user-data`).
    - `SERP_API_KEY`: Your SerpAPI key.
    - `YELP_API_KEY`: Your Yelp API key.
    - `YELP_URL`: Your Yelp API endpoint URL.

3.  **Navigate to the `api` directory:**

    ```bash
    cd /Users/prakashbaskaran/projects/HomeApp/gcp/proxy/api
    ```

4.  **Deploy to Cloud Run:**

    ```bash
    gcloud run deploy homecare-agent-proxy \
        --source . \
        --region us-central1 \
        --platform managed \
        --allow-unauthenticated \
        --service-account githubworkflowdeployment@your-project-id.iam.gserviceaccount.com \
        --set-env-vars="GCP_PROJECT_ID=your-project-id" \
        --set-env-vars="GCP_REGION=us-central1" \
        --set-env-vars="REASONING_ENGINE_ID=your-reasoning-engine-id" \
        --set-env-vars="TELEGRAM_BOT_TOKEN=your-telegram-bot-token" \
        --set-env-vars="TELEGRAM_WEBHOOK_SECRET=your-telegram-webhook-secret" \
        --set-env-vars="FIREBASE_WEBHOOK_SECRET=your-firebase-webhook-secret" \
        --set-env-vars="USER_UPLOAD_TOPIC=user-upload-topic" \
        --set-env-vars="USER_UPLOAD_RESULT_SUBSCRIPTION=user-upload-result-subscription" \
        --set-env-vars="GCS_BUCKET=homegeek-user-data" \
        --set-env-vars="SERP_API_KEY=your-serp-api-key" \
        --set-env-vars="YELP_API_KEY=your-yelp-api-key" \
        --set-env-vars="YELP_URL=your-yelp-url"
    ```

    _Replace placeholders with your actual values._ After deployment, Cloud Run will provide a **Service URL**.

5.  **Set Telegram Webhook (if using Telegram integration)**:
    - Construct your full webhook URL: `YOUR_CLOUD_RUN_SERVICE_URL/YOUR_RANDOM_WEBHOOK_SECRET`
    - Go back to BotFather in Telegram, send the `/setwebhook` command, select your bot, and paste the full webhook URL.
    - Alternatively, use a `curl` command:
      ```bash
      curl -F "url=YOUR_FULL_WEBHOOK_URL" \
           -F "secret_token=YOUR_RANDOM_WEBHOOK_SECRET" \
           "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook"
      ```

### 4.3. Worker Function Deployment to Cloud Functions

This deploys the `main.py` Pub/Sub triggered function as a Google Cloud Function.

1.  **Navigate to the `function` directory:**

    ```bash
    cd /Users/prakashbaskaran/projects/HomeApp/gcp/proxy/workers/function
    ```

2.  **Deploy to Cloud Functions:**
    ```bash
    gcloud functions deploy pubsub_to_user_docs \
        --runtime python39 \
        --trigger-topic user-upload-topic \
        --entry-point pubsub_to_user_docs \
        --region us-central1 \
        --memory 256MB \
        --set-env-vars="RAG_CORPUS=projects/<project-number>/locations/us-central1/ragCorpora/<corpus-id>" \
        --set-env-vars="USER_UPLOAD_RESULT_TOPIC=user-upload-result-topic" \
        --set-env-vars="GCP_PROJECT_ID=your-project-id" \
        --set-env-vars="GCP_REGION=us-central1" \
        --set-env-vars="GCS_BUCKET=homegeek-user-data"
    ```
    _Replace placeholders with your actual values and ensure `RAG_CORPUS` points to the user upload RAG corpus._
