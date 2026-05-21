
# HomeApp 

This repository contains the complete source code for the HomeApp platform, a comprehensive AI-powered property care system. It integrates frontend applications (Mobile & Web) with a sophisticated backend built on Google Cloud Platform.

> 📚 **Technology Stack**: For a comprehensive overview of all technologies used across backend, mobile, and web applications, see [TECH_STACK.md](./docs/TECH_STACK.md).
>
> 🏗️ **Architecture**: For visual diagrams of the system architecture, data flows, and component relationships, see [ARCHITECTURE_DIAGRAM.md](./docs/ARCHITECTURE_DIAGRAM.md).
>
> 📊 **Presentation**: For project presentations, demos, and overview slides, see [PRESENTATION.md](./docs/PRESENTATION.md).
>
> 🤖 **AI Agents**: For documentation on AI agents including Analysis and Checkpoint agents, see [Analysis Agent](./docs/analysis/README.md) and [Checkpoint Features](./docs/checkpoint/README.md).

<img width="1241" height="694" alt="HomeGeek AI Idea Explained" src="https://github.com/user-attachments/assets/5de22222-c0ad-40db-a745-6bbcfc3459fe" />

<img width="2752" height="1536" alt="architecture" src="https://github.com/user-attachments/assets/70c8be49-b847-4cdc-b790-2bcfc2cdb113" />

https://github.com/user-attachments/assets/475431cf-cb01-4083-beed-23a06f36c0d4


## Project Structure

The monorepo is organized into two main areas:

-   **Frontend Applications (`apps/`)**:
    -   `mapp`: Mobile application built with React Native and Expo. Features include AI-powered property diagnostics, visual checkpoints timeline, and document management.
    -   `webapp`: Web application built with Next.js.
    -   `common`: Shared TypeScript library, types, and Firebase configuration.

-   **Backend Services (`gcp/`)**:
    -   `agents`: Vertex AI Agents for property diagnostics, document analysis, and checkpoint analysis.
    -   `proxy`: FastAPI Gateway managing communication between clients and agents.
    -   `common`: Shared Python modules (token quota, Pub/Sub, storage, Gemini helpers).

## Key Features

### AI-Powered Analysis
- **Analysis Agent**: Multimodal problem diagnosis with coverage, DIY, service, and cost recommendations
- **Checkpoint Agent**: Property condition tracking with timeline queries and comprehensive analysis
- **Document Q&A**: RAG-powered document retrieval for warranty and insurance information

### Property Management
- **Checkpoints**: Visual timeline of property condition with AI-powered change detection
- **Documents**: Organized document storage with AI-powered search and retrieval
- **Chat Interface**: Natural language interaction with AI agents for property care

### Multi-Platform Support
- **Mobile App**: iOS and Android via React Native and Expo
- **Web App**: Responsive Next.js application with SSR
- **Telegram Bot**: Conversational interface for quick queries

For detailed feature documentation, see:
- [Analysis Agent Documentation](./docs/analysis/README.md)
- [Checkpoint Features Documentation](./docs/checkpoint/README.md)

## Prerequisites

Before you begin, ensure you have the following installed:

### Frontend Tools
-   **Node.js**: [LTS version recommended](https://nodejs.org/en/download/)
-   **npm**: Comes with Node.js.
-   **Expo CLI** (for `mapp` development): `npm install -g expo-cli`

### Backend Tools
-   **Python 3.9+**: Required for GCP agents and proxy services.
-   **UV**: Fast Python package installer (`pip install uv`).
-   **Google Cloud SDK**: For deploying and managing GCP resources (local debugging; production deploys use GitHub Actions).

## Monorepo Setup

To set up the monorepo and install all dependencies for `mapp`, `webapp`, and `common` packages, navigate to the root of this project and run:

```bash
npm install --legacy-peer-deps
```

To generate the lock file for the webapp folder:

```bash
npm --prefix=apps/webapp install --legacy-peer-deps
```

*The `--legacy-peer-deps` flag is used to handle potential peer dependency conflicts, especially with `next-themes` and React 19.*

## Frontend Development (`apps/`)

### Firebase Configuration

Both `mapp` and `webapp` rely on Firebase. You will need to set up your Firebase project and configure the environment variables.

1.  Add your Firebase configuration details to `apps/common/src/firebase-config.ts`.

### Running `mapp` (Mobile Application)

1.  Navigate to the `mapp` directory:
    ```bash
    cd apps/mapp
    ```
2.  Start the Expo development server:
    ```bash
    npm run dev
    ```
    This will open a new tab in your browser with the Expo Dev Tools. You can then run the app on an iOS simulator, Android emulator, or your physical device using the Expo Go app.

### Running `webapp` (Web Application)

1.  Navigate to the `webapp` directory:
    ```bash
    cd apps/webapp
    ```
2.  Start the Next.js development server:
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:9002` (as configured in `package.json`).

### Building Shared Library

The `common` package is a shared library used by `mapp` and `webapp`. You need to build it for changes to be reflected.

1.  Navigate to the `common` directory:
    ```bash
    cd apps/common
    ```
2.  Build the package:
    ```bash
    npm run build
    ```

### Type Checking

To run type checks for `mapp` and `webapp`:

-   **Mobile (`mapp`)**: `cd apps/mapp && npx tsc --noEmit`
-   **Web (`webapp`)**: `cd apps/webapp && npm run typecheck`

## Backend Development (`gcp/`)

The backend logic is powered by Google Cloud Platform, utilizing Vertex AI for the agentic workflow and Cloud Run for the API proxy.

### Core Components

1.  **AI Agents (`gcp/agents/homecare`)**:
    -   A multi-agent system including Property Agent, Analysis Agent, and DocuLink Agent.
    -   Uses Vertex AI Reasoning Engine.
    -   [Read the Agent Documentation](./gcp/agents/homecare/README.md)

2.  **Proxy API (`gcp/proxy`)**:
    -   FastAPI service acting as a gateway.
    -   Handles Firebase and Telegram integrations.
    -   [Read the Proxy Documentation](./gcp/proxy/README.md)

### Getting Started with Backend

For detailed setup, local development, and deployment instructions for the backend services, please refer to the following guides:

-   **[GCP Architecture](./gcp/docs/ARCHITECTURE.md)**: Deep dive into the backend design.
-   **[Setup & Deployment Guide](./gcp/docs/SETUP_AND_DEPLOYMENT.md)**: Step-by-step guide to provisioning infrastructure and deploying services.

## Deployment

Infrastructure and releases are managed via **GitHub Actions** (`create-environment.yaml`, `deploy-*.yaml`) using `gcloud`. See [`.github/workflows/README.md`](./.github/workflows/README.md), [`docs/deployment/README.md`](./docs/deployment/README.md), and [`gcp/docs/SETUP_AND_DEPLOYMENT.md`](./gcp/docs/SETUP_AND_DEPLOYMENT.md).
