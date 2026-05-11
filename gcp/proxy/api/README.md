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
│   ├── document_service.py  # Document analysis queue (Pub/Sub)
│   ├── telegram_bot.py      # Telegram bot logic (aiogram)
│   ├── vertex_service.py    # Vertex AI Reasoning Engine integration
│   ├── token_usage_service.py # Per-user LLM token totals → Firestore
│   ├── service_broker_service.py
│   └── checkpoint_service.py # Checkpoint operations (Analysis Pub/Sub, Comparison)
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

### Local run (`uvicorn`)

Imports such as `common.token` require the `gcp` directory on `PYTHONPATH`, or a copy of `gcp/common` next to this app as `gcp/proxy/api/common`. **`main.py` prepends `sys.path`** so that `gcp` is found when you run from `gcp/proxy/api` (parent chain `…/gcp/proxy/api` → `…/gcp`). If you use a flat layout (e.g. Docker with `common/` copied into `/app`), that is detected too.

**Docker / Cloud Run:** GitHub Actions runs **`cp -R gcp/common gcp/proxy/api/common`**, then **`gcloud run deploy --source=gcp/proxy/api`** using **`Dockerfile`** in this directory. **`gcp/proxy/api/.gcloudignore`** forces the staged **`common/`** into the upload (it is listed in `.gitignore` so it is not committed). For a one-shot local build without staging, use **`docker build -f gcp/Dockerfile.proxy gcp`** from the repo root.

### LLM token usage (Firestore)

Each completed `stream_query` against the Reasoning Engine increments counters on `llm_token_usage/{userId}`. Token fields come from `usageMetadata` / `usage_metadata` on stream events when present.

The checkpoint analysis worker (Gemini `generate_content` / `embed_content`) uses the same collection via `gcp/common/token/`, incrementing `workerLlmCallCount` and token fields when `usage_metadata` is present.

`POST …/extract-doc-info` only enqueues Pub/Sub; the **document analysis worker** records tokens from `generate_content`’s `usage_metadata` and increments `workerLlmCallCount` per completed job. Quota is checked in the worker before the Gemini call.

**Full schema** (root document, `periods/{YYYY-MM}` history, field tables): **[`gcp/common/token/README.md`](../../../common/token/README.md#firestore-schema)**.

### Token quota (rate limit)

- **`TOKEN_QUOTA_PERIOD_MAX_TOKENS`** (optional): positive integer = default monthly **total token** cap per user (UTC month). Unset or `0` = unlimited unless overridden in Firestore.
- **Per-user override:** `users/{userId}/preferences/user` → **`monthlyTokenLimit`** (positive number). Takes precedence over the env default.

Enforced in the proxy before `stream_query` / session creation (`gcp/common/token/quota.py`), and at the start of checkpoint analysis and document-analysis worker jobs. Over-limit **HTTP** responses use `code: TOKEN_QUOTA_EXCEEDED` (Reasoning Engine / streaming paths); document extraction over quota is reflected on the Firestore user doc (`status: failed`, `docAnalysisQuotaExceeded`).

**Webapp UI:** `POST /token-quota-status` (also under `/{FIREBASE_WEBHOOK_SECRET}/token-quota-status` when the secret is set) with body `{ "user_id": "<uid>" }` returns `{ period, used, max_tokens, unlimited }` — `max_tokens` is the resolved monthly cap (`0` when unlimited). Same resolution as enforcement. The Next.js app uses this so the quota bar does not duplicate `TOKEN_QUOTA_PERIOD_MAX_TOKENS` in build env.

## Available Documentation

### API Features

- **[Adding Functions](./docs/ADDING_FUNCTIONS.md)** - Guide for adding new API endpoints and functions
- **[Document Analysis API](./docs/DOCUMENT_ANALYSIS_API.md)** - Documentation for the document analysis endpoint
- **[Service Broker API](./docs/SERVICE_BROKER_API.md)** - Documentation for the service broker integration
- **[Checkpoint Analysis API](./docs/CHECKPOINT_ANALYSIS_API.md)** - Documentation for checkpoint image analysis (async via Pub/Sub)

## Quick Links

- [Main Proxy README](../README.md) - Deployment and setup instructions
- [Workers README](../workers/README.md) - Background workers documentation
