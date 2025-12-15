# GCP Proxy API

This directory contains the FastAPI application that serves as the backend proxy for the HomeApp ecosystem. It handles agent interactions, document analysis, and third-party integrations (Telegram, Service Broker).

## Architecture

The application is organized into a modular layered architecture:

### Project Structure

```
gcp/proxy/api/
├── main.py              # Application entry point and router assembly
├── core/                # Core configuration and lifecycle
│   ├── config.py
│   └── events.py
├── routers/             # API Route Handlers (Controller Layer)
│   ├── agent.py
│   ├── documents.py
│   ├── telegram.py
│   ├── service_broker.py
│   └── checkpoint.py
├── services/            # Business Logic Layer
│   ├── agent_service.py     # Firebase agent logic
│   ├── document_service.py  # Document analysis (Gemini)
│   ├── telegram_bot.py      # Telegram bot logic (aiogram)
│   ├── vertex_service.py    # Vertex AI Reasoning Engine integration
│   ├── service_broker_service.py
│   └── checkpoint_service.py # Checkpoint analysis Pub/Sub publishing
├── schemas/             # Pydantic Data Models
│   ├── agent.py
│   ├── document.py
│   └── checkpoint.py
└── utils/               # Shared Utilities
    ├── gcp.py
    └── optional_agents.py
```

### Key Components

- **Routers**: Handle HTTP requests, validate inputs using Schemas, and delegate business logic to Services.
- **Services**: Contain the core business logic, independent of the HTTP transport layer (mostly).
- **Schemas**: Pydantic models for request/response validation.
- **Utils**: Reusable utility functions.

## Development

### Requirements

- Python 3.13+
- Dependencies listed in `requirements.txt`

### Running Locally

```bash
uvicorn main:app --reload
```

### Environment Variables

See `core/config.py` for the full list of required environment variables.

## Available Documentation

### API Features

- **[Adding Functions](./docs/ADDING_FUNCTIONS.md)** - Guide for adding new API endpoints and functions
- **[Document Analysis API](./docs/DOCUMENT_ANALYSIS_API.md)** - Documentation for the document analysis endpoint
- **[Service Broker API](./docs/SERVICE_BROKER_API.md)** - Documentation for the service broker integration
- **[Checkpoint Analysis API](./docs/CHECKPOINT_ANALYSIS_API.md)** - Documentation for checkpoint image analysis (async via Pub/Sub)

## Quick Links

- [Main Proxy README](../README.md) - Deployment and setup instructions
- [Workers README](../workers/README.md) - Background workers documentation
