# GCP Proxy API - Documentation Index

Complete documentation for the GCP Proxy API (`gcp/proxy/api`).

## Quick Links

- 📚 [Main README](./README.md) - Start here for overview
- 🚀 [Getting Started](#getting-started)
- 📖 [Core Documentation](#core-documentation)
- 🔧 [Developer Guides](#developer-guides)
- 📡 [API Reference](#api-reference)
- 🏗️ [Source Code Documentation](#source-code-documentation)

---

## Getting Started

New to the GCP Proxy API? Start with these documents:

1. **[README](./README.md)** - Overview, architecture, and quick start
2. **[Development Guide](./DEVELOPMENT.md)** - Set up local development environment
3. **[API Overview](./API_OVERVIEW.md)** - Explore available endpoints
4. **[Configuration](./CONFIGURATION.md)** - Configure environment variables

---

## Core Documentation

### System Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [README](./README.md) | Complete overview of the GCP Proxy API | Everyone |
| [Architecture](./ARCHITECTURE.md) | System architecture and design patterns | Developers, Architects |
| [API Overview](./API_OVERVIEW.md) | Complete API reference with all endpoints | Developers, API Users |

### Operational Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [Deployment](./DEPLOYMENT.md) | Deploy to Google Cloud Run | DevOps, Developers |
| [Configuration](./CONFIGURATION.md) | Environment variables and settings | DevOps, Developers |
| [Development](./DEVELOPMENT.md) | Local development and testing | Developers |

---

## Developer Guides

### For Developers

- **[Development Guide](./DEVELOPMENT.md)** - Complete local development setup
  - Initial setup and prerequisites
  - Running the server locally
  - Testing and debugging
  - Code quality tools
  - Troubleshooting

- **[Adding Endpoints](../../gcp/proxy/api/docs/ADDING_FUNCTIONS.md)** - How to add new API endpoints
  - Step-by-step guide
  - Code patterns and examples
  - Best practices

### For DevOps/SRE

- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment
  - IAM setup and permissions
  - Cloud Run deployment methods
  - CI/CD with GitHub Actions
  - Monitoring and alerting

- **[Configuration Guide](./CONFIGURATION.md)** - Environment configuration
  - Required and optional variables
  - Secret management
  - Environment-specific configs
  - Feature flags

---

## API Reference

### Complete API Documentation

**[API Overview](./API_OVERVIEW.md)** - All endpoints with examples

### Endpoint Categories

#### Agent Endpoints
- `POST /{secret}/firebase-agent-query` - Process agent query
- `POST /{secret}/firebase-agent-stream` - Stream agent response
- `POST /{secret}/agent-session` - Create agent session
- `DELETE /{secret}/agent-session` - Delete agent session

#### Document Endpoints
- `POST /{secret}/extract-doc-info` - Extract document information

#### Checkpoint Endpoints
- `POST /{secret}/analyze-checkpoint` - Analyze checkpoint (async)
- `POST /{secret}/compare-checkpoints` - Compare checkpoints

#### Integration Endpoints
- `POST /{secret}/service-broker-agent` - Service broker webhook
- `POST /{telegram_secret}` - Telegram bot webhook

#### Utility Endpoints
- `GET /health` - Health check

---

## Architecture

### System Overview

```
Client Apps → GCP Proxy API → GCP Services
  (mapp)         (FastAPI)      (Vertex AI)
  (webapp)                      (Firestore)
  (Telegram)                    (Pub/Sub)
```

**Key Documents:**
- [Architecture](./ARCHITECTURE.md) - Complete architecture documentation
- [README](./README.md) - Architecture diagram and overview

### Key Components

1. **Application Layer** - FastAPI app, configuration, lifecycle
2. **Router Layer** - HTTP endpoints and request handling
3. **Service Layer** - Business logic and GCP integration
4. **Schema Layer** - Data validation with Pydantic
5. **Utility Layer** - Shared helpers and utilities

---

## Source Code Documentation

Documentation within the source code (`gcp/proxy/api/docs/`):

### Feature-Specific Docs

| Document | Description |
|----------|-------------|
| [Adding Functions](../../gcp/proxy/api/docs/ADDING_FUNCTIONS.md) | Guide for adding new endpoints |
| [Document Analysis API](../../gcp/proxy/api/docs/DOCUMENT_ANALYSIS_API.md) | Document analysis with Gemini |
| [Service Broker API](../../gcp/proxy/api/docs/SERVICE_BROKER_API.md) | Service broker integration |

### Source Code Structure

```
gcp/proxy/api/
├── main.py                 # FastAPI application
├── core/                   # Configuration
│   ├── config.py
│   └── events.py
├── routers/               # HTTP endpoints
│   ├── agent.py
│   ├── checkpoint.py
│   ├── documents.py
│   ├── service_broker.py
│   └── telegram.py
├── services/              # Business logic
│   ├── agent_service.py
│   ├── checkpoint_service.py
│   ├── document_service.py
│   ├── vertex_service.py
│   ├── telegram_bot.py
│   └── service_broker_service.py
├── schemas/               # Data models
│   ├── agent.py
│   ├── checkpoint.py
│   └── document.py
└── utils/                 # Utilities
    ├── gcp.py
    └── optional_agents.py
```

---

## Use Cases and Examples

### Common Workflows

#### 1. Agent Query Flow
```
Client → POST /firebase-agent-query
       → Agent Service
       → Vertex AI Reasoning Engine
       → Response
```

**Documentation:**
- [API Overview - Agent Endpoints](./API_OVERVIEW.md#agent-endpoints)
- [Development - Testing Agent](./DEVELOPMENT.md#agent-query)

#### 2. Document Analysis Flow
```
Client → POST /extract-doc-info
       → Document Service
       → Gemini AI
       → Structured Response
```

**Documentation:**
- [Document Analysis API](../../gcp/proxy/api/docs/DOCUMENT_ANALYSIS_API.md)
- [API Overview - Document Endpoints](./API_OVERVIEW.md#document-endpoints)

#### 3. Checkpoint Analysis Flow (Async)
```
Client → POST /analyze-checkpoint
       → Pub/Sub Topic
       → 202 Accepted
       
Worker → Process from Pub/Sub
       → Gemini AI Analysis
       → Update Firestore
```

**Documentation:**
- [API Overview - Checkpoint Endpoints](./API_OVERVIEW.md#checkpoint-endpoints)
- [Architecture - Async Processing](./ARCHITECTURE.md#pubsub-pattern)

---

## Quick Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GCP_PROJECT_ID` | ✅ | Google Cloud Project ID |
| `FIREBASE_WEBHOOK_SECRET` | ✅ | Firebase endpoint secret |
| `GCP_LOCATION` | ❌ | GCP region (default: us-central1) |
| `REASONING_ENGINE_ID` | ❌ | Vertex AI Reasoning Engine ID |
| `TELEGRAM_WEBHOOK_SECRET` | ❌ | Telegram webhook secret |
| `TELEGRAM_BOT_TOKEN` | ❌ | Telegram bot token |

**See:** [Configuration Guide](./CONFIGURATION.md)

### Common Commands

```bash
# Local development
cd gcp/proxy/api
uvicorn main:app --reload

# Deploy to Cloud Run
gcloud run deploy homecare-agent-proxy --source .

# Run tests
pytest

# Format code
black .
```

**See:** [Development Guide](./DEVELOPMENT.md)

---

## Related Documentation

### Within This Repository

- [GCP Proxy Main README](../../gcp/proxy/README.md) - Parent directory overview
- [Workers Documentation](../../gcp/proxy/workers/README.md) - Background workers
- [Checkpoint features](../checkpoint/) - Checkpoint feature docs
- [Property Agent](../../gcp/agents/homecare/property_agent/README.md) - Root orchestrator
- [Orchestrator V2](../../gcp/agents/homecare/docs/ORCHESTRATOR_V2_PLAN.md) - Chat SSOT contract

### External Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Google Gen AI SDK](https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstarts/quickstart-multimodal)

---

## Documentation Status

### Complete Documentation

- ✅ README and overview
- ✅ Architecture documentation
- ✅ API reference (all endpoints)
- ✅ Deployment guide
- ✅ Configuration guide
- ✅ Development guide

### Source Code Documentation

- ✅ Adding functions guide
- ✅ Document analysis API
- ✅ Service broker API
- ⚠️ Checkpoint API (partial - in source)
- ⚠️ Agent API (partial - in source)
- ⚠️ Telegram API (needs documentation)

### Planned Documentation

- 🔲 Testing guide (comprehensive)
- 🔲 Performance optimization guide
- 🔲 Security best practices
- 🔲 Troubleshooting guide (expanded)
- 🔲 API changelog

---

## Contributing

When adding new features or making changes:

1. **Update relevant documentation** - Keep docs in sync with code
2. **Add examples** - Include request/response examples
3. **Update this index** - Add links to new documentation
4. **Follow patterns** - Use existing docs as templates

**See:** [Adding Endpoints Guide](../../gcp/proxy/api/docs/ADDING_FUNCTIONS.md)

---

## Document Conventions

### File Naming

- `README.md` - Main overview document
- `UPPERCASE_NAME.md` - Major documentation files
- `lowercase-name.md` - Feature-specific or supplementary docs

### Structure

All major documents follow this structure:
1. Title and overview
2. Table of contents (for long docs)
3. Main content with clear sections
4. Examples and code samples
5. Related documentation links

### Code Examples

- Use bash for command-line examples
- Use python for code examples
- Use json for API request/response examples
- Always include comments explaining key parts

---

## Getting Help

### Documentation Issues

If you find issues with documentation:
1. Check if information is outdated
2. Verify examples work correctly
3. Create issue or submit PR with fixes

### Technical Support

For technical issues:
1. Check [Troubleshooting](./DEVELOPMENT.md#troubleshooting) section
2. Review [Common Issues](./DEPLOYMENT.md#troubleshooting)
3. Check Cloud Run logs
4. Verify configuration and permissions

---

## Version Information

- **API Version:** 1.0.0
- **Documentation Version:** 1.0.0
- **Last Updated:** January 2025
- **Python Version:** 3.13+
- **FastAPI Version:** 0.100+

---

## Navigation

**← Back to:** [HomeApp Documentation](../)  
**→ Next:** [README](./README.md) - Start here for overview

