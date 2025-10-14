# GCP Architecture

This document outlines the architecture of the `gcp` directory, which primarily contains components for AI agents and a proxy service to handle external interactions and data processing.

## 1. Agents Directory (`agents/`)

The `agents` directory houses the core AI reasoning and conversational agents. The main agent, `property_agent` (also referred to as `root_agent`), orchestrates various sub-agents to handle homecare-related tasks, document retrieval, and diagnostics.

### 1.1. Homecare Agent (`homecare/rag/agent.py`)

This is the main orchestrator agent that manages and executes homecare-related tasks.

- **`root_agent` (or `property_agent`)**:
  - **Purpose**: Manages and executes homecare-related tasks, acting as the primary entry point for complex queries.
  - **Sub-agents**: Delegates tasks to `diagnostic_agent` and `doculink_agent`.
  - **Key Functions**: Orchestrates the flow of information and task execution between specialized sub-agents.

### 1.2. Doculink Agent (`homecare/rag/agent.py`)

The `doculink_agent` is a sub-agent of the `root_agent` and is responsible for document retrieval.

- **Purpose**: Manages and executes document retrieval-related tasks.
- **Tools**: Utilizes `user_docs_agent` and `knowledge_base_agent`.

### 1.3. Sub-Agents

#### 1.3.1. Diagnostics Agent (`homecare/rag/sub_agents/diagnostics_agent/agent.py`)

This agent is responsible for diagnosing issues, gathering research, and finding service providers.

- **Purpose**: Handles comprehensive research tasks for the diagnostics agent by gathering information from multiple sources and analyzing multimodal data.
- **Tools**:
  - `analyse_multimodal_data`: Analyzes multimodal data (e.g., images, videos) provided via GCS URLs using `gemini-2.5-flash`.
  - `google_search_agent`: An agent that uses Google Search to answer general questions.
  - `youtube_search`: A Langchain tool to search YouTube for related videos.
  - `serpapi_search`: A Langchain tool for searching local business listings and service providers using SerpAPI.
  - `yelpapi_search`: A custom function to search for service providers using the Yelp API.
  - `research_agent`: An agent that combines `google_search_agent`, `ask_user_docs_retreival`, and `youtube_search` for comprehensive research.
  - `service_provider_agent`: An agent that uses `serpapi_search` and `yelpapi_search` to find service providers.

#### 1.3.2. Knowledge Base Agent (`homecare/rag/sub_agents/knowledge_base_agent/agent.py`)

This agent is responsible for retrieving information from a pre-defined RAG (Retrieval Augmented Generation) corpus.

- **Purpose**: Retrieves documentation and reference materials from a configured RAG corpus.
- **Tools**: `VertexAiRagRetrieval`: Utilizes Vertex AI's RAG retrieval capabilities.

#### 1.3.3. User Docs Agent (`homecare/rag/sub_agents/user_docs_agent/agent.py`)

This agent handles the retrieval of user-specific uploaded documents.

- **Purpose**: Fetches and retrieves information from documents uploaded by the user, stored in a RAG corpus.
- **Key Functions**:
  - `get_user_file_ids`: Fetches `FileId` values from JSON files in the user's GCS import results folder.
  - `get_rag_file_ids`: Retrieves RAG file IDs for a specific user.
  - `ask_user_docs_retreival`: Performs a RAG retrieval query against user-specific documents.

## 2. Proxy Directory (`proxy/`)

The `proxy` directory contains the FastAPI application that acts as an API gateway, handling incoming requests from various platforms (e.g., Firebase, Telegram) and managing file uploads and processing via Pub/Sub workers.

### 2.1. API Service (`proxy/api/main.py`)

This is the main FastAPI application serving as the backend for the conversational agents.

- **Purpose**: Exposes API endpoints for interacting with the AI agents, handling webhooks, and managing agent sessions.
- **Key Endpoints**:
  - `/health`: Health check endpoint.
  - `/{TELEGRAM_WEBHOOK_SECRET}`: Telegram webhook endpoint for receiving messages.
  - `/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query`: Firebase webhook for direct agent queries.
  - `/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-stream`: Firebase webhook for streaming agent answers.
  - `/{FIREBASE_WEBHOOK_SECRET}/agent-session`: Endpoint for creating agent sessions (Reasoning Engine sessions).
  - `/{FIREBASE_WEBHOOK_SECRET}/rag-file-upload`: Firebase webhook for handling file uploads to the RAG corpus.
- **Integrations**: Firebase API (`firebase_api.py`), Telegram API (`telegram_api.py`), Vertex AI client (`vertex_client.py`).
- **Pub/Sub Listener**: Includes a background thread that listens to a Pub/Sub topic (`USER_UPLOAD_RESULT_SUBSCRIPTION`) for results of user file uploads, updating the main application loop.

### 2.2. Worker Function (`proxy/workers/function/main.py`)

This file contains a Cloud Function triggered by Pub/Sub, primarily responsible for importing user-uploaded files into the Vertex AI RAG corpus.

- **Purpose**: Processes messages from a Pub/Sub topic (`user-upload-topic`) to import GCS URLs (documents and media) into the RAG corpus.
- **Key Functions**:
  - `import_to_rag_corpus`: Handles the actual import of files (documents and media) to the Vertex AI RAG corpus, applying appropriate parsing configurations (e.g., `llmParserConfig` with `gemini-2.5-flash`).
  - `pubsub_to_user_docs`: The entry point for the Cloud Function, decodes Pub/Sub messages, extracts GCS URLs and user information, triggers the RAG import, and publishes the results to another Pub/Sub topic (`USER_UPLOAD_RESULT_TOPIC`).

## 3. Data Flow and Interactions

1.  **User Interaction**: Users interact with the system through platforms like Firebase or Telegram, sending queries or uploading files.
2.  **Proxy Ingestion**: The `proxy/api/main.py` service receives these interactions via webhooks.
3.  **Agent Orchestration**: For queries, the `proxy` dispatches them to the `root_agent` (`homecare/rag/agent.py`), which then orchestrates its sub-agents (`diagnostic_agent`, `doculink_agent`, `knowledge_base_agent`, `user_docs_agent`) to process the request.
4.  **RAG and External Tools**: The sub-agents utilize various tools including Vertex AI RAG retrieval (for knowledge base and user documents), Google Search, YouTube Search, SerpAPI, and Yelp API for gathering information and providing responses.
5.  **Multimodal Analysis**: The `diagnostic_agent` can analyze multimodal data (e.g., images) uploaded by the user.
6.  **File Upload Processing**: When files are uploaded, the `proxy/api/main.py` handles the initial request and publishes a message to a Pub/Sub topic.
7.  **Asynchronous RAG Import**: The `proxy/workers/function/main.py` (a Cloud Function) is triggered by the Pub/Sub message, which then imports the uploaded files into the Vertex AI RAG corpus.
8.  **Result Notification**: After RAG import, the worker publishes the results to another Pub/Sub topic, which the `proxy/api/main.py` listens to, allowing for asynchronous updates or notifications back to the user.
