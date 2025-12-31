# GCP Proxy API Documentation

This directory contains comprehensive documentation for the GCP Proxy API, a FastAPI-based microservice that acts as a unified API gateway for the HomeApp ecosystem.

## Overview

The GCP Proxy API serves as the backend proxy between client applications (web/mobile apps, Telegram bots) and Google Cloud Platform services, primarily:

- **Vertex AI Reasoning Engine** - AI agent interactions
- **Gemini AI** - Document analysis and checkpoint processing
- **Firebase/Firestore** - Data persistence
- **Pub/Sub** - Asynchronous task processing
- **Cloud Storage** - Document and image storage

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  mapp    │  │  webapp  │  │ Telegram │  │  Service │   │
│  │ (Mobile) │  │   (Web)  │  │   Bot    │  │  Broker  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
        ┌─────────────▼─────────────────────────────────┐
        │         GCP Proxy API (FastAPI)               │
        │  ┌─────────────────────────────────────────┐  │
        │  │  Routers (HTTP Endpoints)               │  │
        │  │  • Agent      • Checkpoint              │  │
        │  │  • Documents  • Service Broker          │  │
        │  │  • Telegram                             │  │
        │  └────────────┬────────────────────────────┘  │
        │               │                                │
        │  ┌────────────▼────────────────────────────┐  │
        │  │  Services (Business Logic)              │  │
        │  │  • Agent Service    • Checkpoint Svc    │  │
        │  │  • Document Service • Vertex Service    │  │
        │  │  • Telegram Bot     • Service Broker    │  │
        │  └────────────┬────────────────────────────┘  │
        └───────────────┼────────────────────────────────┘
                        │
        ┌───────────────┴────────────────────────────────┐
        │                                                 │
        ▼                 ▼                 ▼             ▼
┌───────────────┐  ┌──────────┐  ┌──────────────┐  ┌─────────┐
│ Vertex AI     │  │ Firestore│  │   Pub/Sub    │  │ Storage │
│ Reasoning     │  │          │  │   Topics     │  │  (GCS)  │
│ Engine        │  │          │  │              │  │         │
└───────────────┘  └──────────┘  └──────────────┘  └─────────┘
```

## Documentation Structure

### Core Documentation

- **[API Overview](./API_OVERVIEW.md)** - Complete API reference with all endpoints
- **[Architecture](./ARCHITECTURE.md)** - System architecture and design patterns
- **[Deployment](./DEPLOYMENT.md)** - Deployment guide for Cloud Run
- **[Configuration](./CONFIGURATION.md)** - Environment variables and settings

### Feature Documentation

- **[Agent API](./AGENT_API.md)** - Firebase agent query and streaming endpoints
- **[Checkpoint API](./CHECKPOINT_API.md)** - Checkpoint analysis and comparison
- **[Document API](./DOCUMENT_API.md)** - Document analysis with Gemini AI
- **[Service Broker API](./SERVICE_BROKER_API.md)** - Service broker webhook integration
- **[Telegram API](./TELEGRAM_API.md)** - Telegram bot webhook handling

### Developer Guides

- **[Development Guide](./DEVELOPMENT.md)** - Local development setup and testing
- **[Adding Endpoints](./ADDING_ENDPOINTS.md)** - Guide for adding new API endpoints
- **[Testing Guide](./TESTING.md)** - Testing strategies and examples

## Quick Start

### Prerequisites

- Python 3.13+
- Google Cloud Project with:
  - Vertex AI API enabled
  - Firestore database
  - Cloud Storage bucket
  - Pub/Sub topics configured

### Local Development

```bash
# Navigate to the API directory
cd gcp/proxy/api

# Install dependencies
pip install -r requirements.txt

# Set environment variables (create .env file)
cp .env.example .env
# Edit .env with your configuration

# Run the server
uvicorn main:app --host=0.0.0.0 --port=8080 --reload
```

### Testing

```bash
# Health check
curl http://localhost:8080/health

# Test agent endpoint (requires webhook secret)
curl -X POST "http://localhost:8080/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query" \
  -H "Content-Type: application/json" \
  -d '{"query": "Hello", "user_id": "test_user"}'
```

## API Endpoints Summary

### Agent Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/{secret}/firebase-agent-query` | Process agent query and return response |
| POST | `/{secret}/firebase-agent-stream` | Stream agent response in real-time |
| POST | `/{secret}/agent-session` | Create new agent session |
| DELETE | `/{secret}/agent-session` | Delete agent session |

### Document Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/{secret}/extract-doc-info` | Extract structured info from documents |

### Checkpoint Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/{secret}/analyze-checkpoint` | Analyze checkpoint image (async) |
| POST | `/{secret}/compare-checkpoints` | Compare two checkpoint images |

### Service Broker Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/{secret}/service-broker-agent` | Receive service broker notifications |

### Telegram Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/{telegram_secret}` | Telegram webhook for bot messages |

### Utility Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check and status |

## Key Features

### 1. AI Agent Integration
- Vertex AI Reasoning Engine integration
- Session management
- Streaming responses
- Context-aware conversations

### 2. Document Analysis
- Automatic document type classification
- Property address extraction
- Key entity identification
- Document summarization

### 3. Checkpoint Processing
- Asynchronous image analysis via Pub/Sub
- Checkpoint comparison with similarity scoring
- Semantic change detection
- Region of interest identification

### 4. Multi-Channel Support
- Firebase web/mobile apps
- Telegram bot integration
- Service broker webhooks
- Extensible architecture for new channels

### 5. Scalability
- Async processing with Pub/Sub
- Streaming responses for real-time updates
- Cloud Run auto-scaling
- Efficient resource utilization

## Security

### Authentication
- Webhook secrets for endpoint protection
- Service account authentication for GCP services
- CORS configuration for web clients

### Best Practices
- All secrets stored as environment variables
- HTTPS required in production
- Input validation with Pydantic models
- Comprehensive error handling and logging

## Environment Variables

### Required

```bash
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1

# Webhook Secrets
FIREBASE_WEBHOOK_SECRET=your-firebase-secret
TELEGRAM_WEBHOOK_SECRET=your-telegram-secret

# Vertex AI
REASONING_ENGINE_ID=your-reasoning-engine-id

# Telegram (if using)
TELEGRAM_BOT_TOKEN=your-bot-token

# Pub/Sub (for checkpoint analysis)
USER_UPLOAD_RESULT_SUBSCRIPTION=user-upload-result-subscription
```

See [Configuration Guide](./CONFIGURATION.md) for complete details.

## Deployment

### Cloud Run Deployment

```bash
# Deploy to Cloud Run
cd gcp/proxy/api
gcloud run deploy homecare-agent-proxy \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT_ID=your-project-id,..."
```

See [Deployment Guide](./DEPLOYMENT.md) for complete instructions.

## Monitoring and Logging

### Logging
- Structured logging with Python logging module
- Cloud Logging integration in production
- Request/response logging for debugging

### Metrics
- Cloud Run metrics (requests, latency, errors)
- Custom metrics for business logic
- Health check endpoint for monitoring

## Performance

### Response Times
- Agent queries: 1-3 seconds
- Document analysis: 2-6 seconds
- Checkpoint comparison: 3-8 seconds
- Health check: < 100ms

### Optimization
- Async processing for long-running tasks
- Streaming responses for real-time updates
- Direct URL processing (no file downloads)
- Efficient model selection (Gemini 2.0 Flash)

## Related Documentation

### In This Repository
- [GCP Proxy Main README](../../gcp/proxy/README.md)
- [Workers Documentation](../../gcp/proxy/workers/README.md)
- [API Source Documentation](../../gcp/proxy/api/docs/)

### External Resources
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Google Gen AI SDK](https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstarts/quickstart-multimodal)

## Support and Troubleshooting

### Common Issues

1. **"Reasoning Engine not initialized"**
   - Check `REASONING_ENGINE_ID` environment variable
   - Verify service account has Vertex AI User role

2. **"Webhook secret invalid"**
   - Ensure `FIREBASE_WEBHOOK_SECRET` is set correctly
   - Check URL path includes the secret

3. **"Document analysis failed"**
   - Verify document URL is accessible
   - Check Vertex AI API quotas
   - Ensure document format is supported

### Getting Help

1. Check logs in Cloud Run console
2. Review relevant documentation section
3. Test with sample requests
4. Verify environment variables and permissions

## Contributing

When adding new features:

1. Follow the existing architecture patterns
2. Add comprehensive documentation
3. Include request/response examples
4. Add error handling and logging
5. Update this README with new endpoints

See [Adding Endpoints Guide](./ADDING_ENDPOINTS.md) for details.

## Version History

- **v1.0.0** (2025-01) - Initial release with agent, document, and checkpoint APIs
- See git history for detailed changes

## License

Copyright 2025 Google LLC - Licensed under Apache 2.0

