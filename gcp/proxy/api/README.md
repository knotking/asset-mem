# GCP Proxy API

This directory contains the FastAPI application that serves as the backend proxy for the HomeApp ecosystem. It handles agent interactions, document analysis, and third-party integrations (Telegram, Service Broker).

## Architecture

The application has been refactored into a modular architecture to improve maintainability and scalability.

### Project Structure

```
gcp/proxy/api/
├── main.py              # Application entry point and router assembly
├── schemas.py           # Pydantic models for request/response validation
├── core/
│   ├── config.py        # Environment variable configuration
│   └── events.py        # App lifecycle and background event listeners (PubSub)
├── routers/             # API Endpoints
│   ├── agent.py         # Chat and session management (Firebase)
│   ├── documents.py     # Document upload and analysis
│   ├── telegram.py      # Telegram webhook handler
│   └── service_broker.py# Service broker integration
├── models.py            # (Deprecated) Re-exports schemas for backward compatibility
└── ...
```

### Key Components

- **Routers**: API logic is split into dedicated routers in `routers/`. This keeps `main.py` clean and focused on configuration.
- **Schemas**: All data models are defined in `schemas.py` using Pydantic. This ensures strict type validation for all incoming requests.
- **Core**:
    - `config.py`: Centralized access to environment variables.
    - `events.py`: Manages the application lifespan, including the background thread for Google Cloud Pub/Sub listeners.

## Development

### Requirements

- Python 3.13+
- Dependencies listed in `requirements.txt`

### Running Locally

```bash
uvicorn main:app --reload
```

### Environment Variables

Ensure you have a `.env` file or environment variables set for:
- `GCP_PROJECT_ID`
- `FIREBASE_WEBHOOK_SECRET`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- ... (see `core/config.py` for full list)

## Available Documentation

### API Features
- **[Adding Functions](./ADDING_FUNCTIONS.md)** - Guide for adding new API endpoints and functions
- **[Document Analysis API](./DOCUMENT_ANALYSIS_API.md)** - Documentation for the document analysis endpoint
- **[Service Broker API](./SERVICE_BROKER_API.md)** - Documentation for the service broker integration

## Quick Links
- [Main Proxy README](../README.md) - Deployment and setup instructions
- [Workers README](../workers/README.md) - Background workers documentation
