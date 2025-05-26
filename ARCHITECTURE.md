# HomeApp Architecture

This document provides an overview of the architecture for the HomeApp project, detailing its components, workflows, and interactions.

---

## Overview

The HomeApp project is designed to process user inputs (documents, images, and videos) sent via Telegram, analyze them using AI models, and return structured results. The architecture is modular, scalable, and integrates multiple services for efficient processing.

---

## Components

### 1. **Telegram Bot**
- Acts as the user interface for sending files (documents, images, videos) and receiving results.
- Sends messages and files to the `MessageReceiver` workflow.

### 2. **MessageReceiver**
- Entry point for all Telegram messages.
- Routes messages to the appropriate workflow based on the content type (document, image, or video).

### 3. **Workflow Router**
- Determines the type of content and triggers the corresponding workflow:
  - **DocumentAnalysis**
  - **ImageAnalysis**
  - **VideoAnalysis**

### 4. **Workflows**
#### a. **DocumentAnalysis**
- Processes documents using OpenAI for text analysis.
- Stores vector embeddings in Qdrant.
- Saves structured results in Postgres.

#### b. **ImageAnalysis**
- Processes images using OpenAI for image analysis.
- Use backend python api to annotate image
- Generates structured outputs and sends them back to the user.

#### c. **VideoAnalysis**
- Processes videos by extracting unique frames by using backend python api
- Frames are analysed using OpenAI.
- Generates a report, annotate the frame using backend python api and sends it back to the user.

### 5. **Python `server/api/app.py`**
- Acts as the backend API server for additional processing tasks.
- Provides endpoints for:
  - Image processing.
  - Video processing.
  - Document Classification using pretrained ML trained models (Not in use).
- Communicates with workflows

### 6. **External Services**
#### a. **OpenAI**
- Provides AI models for text, image, and video analysis.

#### b. **Qdrant**
- Vector database for storing embeddings (used in DocumentAnalysis).

#### c. **Postgres**
- Relational database for n8n users, credentials, workflows and storing AI generated structured results (used in DocumentAnalysis).

---

## Workflow Sequence

### 1. User Interaction
- The user sends a message or file (document, image, or video) via Telegram.

### 2. Message Routing
- The `MessageReceiver` workflow determines the content type and routes it to the appropriate workflow.

### 3. Content Processing
- The selected workflow (DocumentAnalysis, ImageAnalysis, or VideoAnalysis) processes the content using OpenAI models.
- Results are optionally stored in Qdrant (for vector embeddings) or Postgres (for structured data).

### 4. Backend Processing
- The `python server/api/app.py` script provides additional processing capabilities, such as:
  - Image processing and annotation.
  - Video frame extraction and annotation.
  - Document classification using pretrained ML models (Not in use).

### 5. Response
- The processed results are sent back to the user via Telegram.

---

## Deployment Architecture

### Infrastructure
- **n8n**: Workflow automation tool for managing workflows.
- **Postgres**: Database for n8n users, credentials, workflows and storing AI generated structured results.
- **Qdrant**: Vector database for embeddings of home inspection reports.
- **FastAPI (via `server/api/app.py`)**: API server for additional processing tasks.
- **Docker**: Used to containerize and deploy services.

### Cloud Integration
- **Google Cloud Platform (GCP)**:
  - Secret Manager: Stores sensitive information like GitHub tokens.
  - Compute Engine: Hosts the application and workflows.
  - Storage Bucket: Stores terraform deployment state

---

## Key Features

1. **Modular Design**:
   - Separate workflows for documents, images, and videos.
   - Easy to extend and maintain.

2. **Scalability**:
   - Decoupled architecture allows scaling individual components as needed.

3. **Integration with External Services**:
   - Uses OpenAI for AI-based analysis.
   - Stores data in Qdrant and Postgres for efficient retrieval.

4. **Automation**:
   - n8n workflows automate the entire process from message reception to result delivery.

5. **Backend API**:
   - The `python server/api/app.py` script provides additional processing capabilities, making the system extensible.

---

## Future Enhancements

1. **Add Support for Audio Files**:
   - Extend the architecture to process audio files using speech-to-text models.

2. **Enhanced Error Handling**:
   - Improve logging and error recovery mechanisms in workflows.

3. **Real-Time Notifications**:
   - Notify users about the progress of their requests.

4. **Cloud Vector Store**:
   - Enable Cloud Vector Store (e.g Google VertexAI, Open AI, Qdrant, Weaviate, Pinecone, etc)

5. **PostgreSQLDB**
   - Enable Cloud PostgreSQLDB (e.g Google Cloud SQL, Supabase, etc)

6. **Scalable Deployment**:
   - Use Kubernetes for managing and scaling services.

---

For further details, refer to the individual workflow JSON files in the `n8n` directory or contact the project maintainer.