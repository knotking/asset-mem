# Service Request Broker Agents

HomeGeek AI coordinates home service estimates by blending structured provider data, conversational AI, and Twilio-powered messaging. This package contains two Google ADK agents that implement the flow shown below:

```
HomeGeek AI App → Service Request Broker Agent → Twilio (CPaaS) → Service Providers
                                   ↑                               ↓
                       Service Session Store ← Proxy AI Agent ← Twilio Webhook
                                  ↑
                      Service Provider Catalog / Metadata
```

- `service_broker_agent`: Orchestrates outbound service requests from the HomeGeek app.
- `proxy_agent`: Handles inbound Twilio webhooks, parses responses, and updates the service session record.

Both agents share utilities for provider discovery, session persistence, and Twilio messaging.

## Repository Layout

```
service_broker/
├── data/
│   └── providers.sample.json          # Mock provider catalog used for local development
├── docs/
│   ├── ARCHITECTURE.md                # Detailed design and sequence diagrams
│   ├── API_CONTRACTS.md               # Schemas for broker/proxy payloads
│   └── SESSION_SCHEMA.md              # Persistence schema and examples
├── service_broker_agent/
│   ├── agent.py                       # Root ADK agent definition
│   ├── agent_inputs.py                # Pydantic input/output models
│   ├── prompts.py                     # System instructions for the broker
│   └── __init__.py
├── proxy_agent/
│   ├── agent.py                       # ADK agent for webhook handling
│   ├── agent_inputs.py
│   ├── prompts.py
│   ├── README.md
│   └── __init__.py
├── shared/
│   ├── provider_catalog.py            # Provider lookup utilities
│   ├── session_store.py               # File-backed session persistence
│   ├── twilio_client.py               # CPaaS (Twilio) messaging helper
│   └── __init__.py
├── Makefile
└── pyproject.toml
```

## Quick Start

```bash
cd gcp/agents/service_broker

# Install dependencies and create a virtualenv
uv sync

# Run the broker agent (interactive ADK CLI)
uv run adk run service_broker_agent

# Run the proxy/webhook agent
uv run adk run proxy_agent
```

### Environment Variables

Both agents load Twilio credentials and GCP project metadata via `.env`. Copy the template below into `.env` and adjust values:

```
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
SERVICE_PROVIDER_DATA_PATH=data/providers.sample.json
SESSION_STORE_PATH=.sessions/service_sessions.json
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_MESSAGING_SERVICE_SID=MGXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_STATUS_WEBHOOK_URL=https://example.com/twilio/webhook
```

When Twilio credentials are absent, the messenger falls back to a dry-run mode that logs outbound payloads, allowing local testing without hitting the Twilio API.

## Broker Agent Responsibilities

1. Validate and normalize the incoming service request from HomeGeek AI.
2. Retrieve matching providers from the catalog based on category, skills, coverage area, and availability.
3. Create or update a service session record that tracks routing, provider decisions, and communication status.
4. Compose outbound requests and dispatch them via Twilio using channel-appropriate copy.
5. Return a structured summary that the HomeGeek app can render (request id, providers contacted, messaging state).

## Proxy Agent Responsibilities

1. Parse inbound Twilio webhook payloads (SMS, WhatsApp, voice transcription).
2. Extract provider intent (accept, decline, estimate, follow-up questions).
3. Update the corresponding service session entry and archive the raw payload.
4. Summarize the provider’s response for the broker agent and trigger follow-on steps if needed.

See `docs/ARCHITECTURE.md` for sequence diagrams, data contracts, and deployment guidance.

## Testing

The `data/providers.sample.json` catalog powers local smoke tests. Extend it with your provider roster when integrating with real systems. Run automated checks with:

```bash
make test
```

Add pytest suites under `tests/` (not included by default) to cover provider matching logic, session persistence, and webhook parsing.

## Deployment Notes

- Both agents are designed for Vertex AI Agent Builder (ADK) and can be deployed using `adk deploy` or custom automation. Reuse the patterns in `gcp/agents/homecare`.
- Twilio webhooks should point to a Cloud Run or Cloud Functions service that wraps the `proxy_agent`.
- Session storage defaults to a JSON file for developer convenience; in production use Firestore, AlloyDB, or another transactional store and adapt `shared/session_store.py`.

## Next Steps

- Implement prioritization/ranking logic for providers based on SLA, distance, and partner tier.
- Add evaluation datasets in `eval/` similar to the homecare agent for regression testing.
- Integrate Vertex AI Search/RAG pipelines to enrich provider responses with knowledge-base answers.

