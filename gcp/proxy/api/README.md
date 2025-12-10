# GCP Proxy API Documentation

This directory contains feature documentation for the GCP Proxy API endpoints and functions.

## Overview

The GCP Proxy API is a FastAPI application that serves as a backend proxy for various services including:
- Firebase webhook endpoints for agent queries and document analysis
- Telegram bot webhook handling
- Service broker agent notifications
- Document analysis using Vertex AI Gemini

## Architecture

The API follows a modular architecture with clear separation of concerns:

```
gcp/proxy/api/
├── main.py                 # FastAPI application entry point
├── config.py               # Configuration management (Pydantic Settings)
├── constants.py            # Application constants
├── dependencies.py         # Dependency injection
├── middleware.py           # Custom middleware (logging, security, errors)
├── models.py              # Pydantic data models
├── models/
│   └── error_models.py    # Standardized error response models
├── routers/               # API route handlers
│   ├── firebase_router.py
│   ├── telegram_router.py
│   ├── document_router.py
│   └── service_broker_router.py
├── firebase_api.py        # Firebase API handlers
├── telegram_api.py        # Telegram bot handlers
├── vertex_client.py       # Vertex AI client logic
├── document_analysis.py   # Document analysis logic
├── service_broker_api.py  # Service broker handlers
└── gcp_utils.py          # GCP utilities (GCS, Pub/Sub)
```

## Key Features

### Configuration Management
- Centralized configuration using Pydantic Settings (`config.py`)
- Environment variable validation on startup
- Type-safe configuration with defaults

### Error Handling
- Standardized error responses (`ErrorResponse` model)
- Proper HTTP status codes (400, 500)
- Request correlation IDs for tracing
- Global exception handling middleware

### Security
- Environment-based CORS configuration
- Header-based webhook authentication (with path fallback)
- Security headers middleware (HSTS, X-Frame-Options, etc.)

### Logging & Observability
- Structured logging with request IDs
- Request/response logging middleware
- Correlation IDs for distributed tracing

## Available Documentation

### API Endpoints

- **[Adding Functions](./ADDING_FUNCTIONS.md)** - Guide for adding new API endpoints and functions to the proxy
- **[Document Analysis API](./DOCUMENT_ANALYSIS_API.md)** - Documentation for the document analysis endpoint using Vertex AI Gemini
- **[Service Broker API](./SERVICE_BROKER_API.md)** - Documentation for the service broker agent webhook endpoint
- **[Improvements Summary](../docs/IMPROVEMENTS_SUMMARY.md)** - Summary of recent improvements and changes

## Quick Links

- [Main Proxy README](../README.md) - Deployment and setup instructions
- [Workers README](../workers/README.md) - Background workers documentation

## Configuration

### Required Environment Variables

```bash
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
GCP_LOCATION=us-central1

# Vertex AI Configuration
REASONING_ENGINE_ID=your-reasoning-engine-id

# Webhook Secrets
TELEGRAM_WEBHOOK_SECRET=your-telegram-secret
FIREBASE_WEBHOOK_SECRET=your-firebase-secret

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your-bot-token

# GCS Configuration
GCS_BUCKET=your-bucket-name

# Pub/Sub Configuration
USER_UPLOAD_TOPIC=your-topic-name
USER_UPLOAD_RESULT_SUBSCRIPTION=your-subscription-name

# CORS Configuration (optional, defaults to "*")
CORS_ORIGINS=https://yourdomain.com,https://anotherdomain.com

# Logging Configuration (optional, defaults to "INFO")
LOG_LEVEL=INFO
```

### Configuration Validation

The application validates all required configuration on startup. Missing required variables will result in warnings, and the application will run in a degraded mode.

## API Endpoints

### Firebase Endpoints

All Firebase endpoints are prefixed with `/{FIREBASE_WEBHOOK_SECRET}/`:

- `POST /firebase-agent-query` - Agent query endpoint
- `POST /firebase-agent-stream` - Streaming agent responses
- `POST /agent-session` - Create agent session
- `DELETE /agent-session` - Delete agent session
- `POST /rag-file-upload` - File upload handler
- `POST /extract-doc-info` - Document analysis

### Telegram Endpoints

- `POST /{TELEGRAM_WEBHOOK_SECRET}` - Telegram webhook handler

### Service Broker Endpoints

- `POST /{FIREBASE_WEBHOOK_SECRET}/service-broker-agent` - Service broker webhook

### Health Check

- `GET /health` - Health check endpoint with dependency status

## Authentication

### Webhook Authentication

The API supports two authentication methods:

1. **Header-based (Preferred)**:
   ```bash
   X-Webhook-Secret: your-secret-value
   ```

2. **Path-based (Backward Compatible)**:
   ```
   POST /{SECRET}/endpoint
   ```

## Error Responses

All errors follow a standardized format:

```json
{
  "status": "error",
  "message": "Error description",
  "error_code": "ERROR_CODE",
  "request_id": "uuid-here",
  "details": [
    {
      "field": "field_name",
      "message": "Field-specific error",
      "code": "VALIDATION_ERROR"
    }
  ]
}
```

## Documentation Structure

Each API documentation file follows a consistent structure:

1. **Overview** - What the endpoint does
2. **Architecture** - System design and flow
3. **Files** - Code organization
4. **API Endpoint** - Request/response formats
5. **Configuration** - Environment variables and setup
6. **Usage Examples** - Code samples
7. **Testing** - How to test the endpoint
8. **Deployment** - Deployment instructions

## Contributing

When adding new API endpoints:

1. Follow the guide in [ADDING_FUNCTIONS.md](./ADDING_FUNCTIONS.md)
2. Create a new router in `routers/` directory
3. Add handler functions in appropriate module
4. Register router in `main.py`
5. Add documentation following existing patterns
6. Update this README with links to new documentation

## Development

### Running Locally

```bash
cd gcp/proxy/api
pip install -r requirements.txt
uvicorn main:app --host=0.0.0.0 --port=8080 --reload
```

### Testing

```bash
pytest firebase_integration_test.py
```

### Code Quality

- Type hints required for all functions
- Docstrings for all modules and public functions
- Follow existing code patterns
- Use constants from `constants.py`
- Use configuration from `config.py`

## Recent Improvements

See [IMPROVEMENTS_SUMMARY.md](./IMPROVEMENTS_SUMMARY.md) for details on recent improvements including:
- Configuration management
- Error handling standardization
- Security enhancements
- Code organization improvements
- Performance optimizations

