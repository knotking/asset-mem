# HomeGeek Service Broker Architecture

This package implements the HomeGeek service-request flow illustrated in the shared architecture diagram:

```
HomeGeek AI App ──(1) Service Request──▶ Service Request Broker Agent
      │                                                   │
      │                                   ┌──(2) Provider Catalog──────┐
      │                                   │                            │
      │                                   ▼                            │
      │                          Service Provider Data                 │
      │                                   │                            │
      │                                   └──(3) Session Store◀──┐     │
      │                                                         │     │
      ▼                                                         │     │
CPAAS (Twilio) ◀──(4) Dispatch── Broker Agent ──(5) Provider Reply──▶ Service Provider
      │                                                                 │
      └──(6) Webhook──▶ Proxy AI Agent ──(7) Session Update ──▶ Service Broker Agent
```

## Components

- **Service Request Broker Agent (`service_broker_agent`)**
  - Accepts normalized requests from the HomeGeek AI App.
  - Queries the provider catalog for matching service partners.
  - Creates or updates a session in the session store.
  - Generates channel-appropriate dispatch messages and sends them through Twilio.
  - Returns a structured summary with the session identifier and contacted providers.

- **Proxy AI Agent (`proxy_agent`)**
  - Receives normalized Twilio webhook payloads (SMS, WhatsApp, or voice transcription).
  - Identifies the associated broker session and provider.
  - Persists inbound messages, classifies intent, and extracts estimate metadata.
  - Produces a `ProviderResponseSummary` JSON payload for the broker or downstream automations.

- **Shared Utilities (`service_broker/shared`)**
  - `ProviderCatalog` loads providers from `data/providers.sample.json` and performs filtering by category, geography, and rating.
  - `SessionStore` persists request sessions to disk (`.sessions/service_sessions.json`) and mirrors the event timeline for each provider.
  - `TwilioMessenger` abstracts sending messages with graceful fallback to a dry-run mode when credentials are absent.

## Sequence of Events

1. **Service Request Intake** – The HomeGeek AI App submits a `ServiceRequestInput` payload to the broker agent.
2. **Provider Discovery** – The broker agent invokes `fetch_provider_candidates`, which queries the provider catalog and returns a shortlist.
3. **Session Persistence** – The broker agent writes the service request, provider roster, and metadata to the session store via `open_or_update_session`.
4. **Dispatch via Twilio** – For each selected provider, the broker agent renders a dispatch message and sends it through `dispatch_via_twilio`.
5. **Provider Response** – Providers reply directly through Twilio (SMS, WhatsApp, etc.).
6. **Webhook Processing** – Twilio forwards the inbound message to a webhook endpoint that invokes the `proxy_agent`.
7. **Session Update & Summary** – The proxy agent records the message, extracts estimates/intent, and returns a `ProviderResponseSummary` for the broker and HomeGeek UI.

## Deployment Notes

- Both agents are authored with the Google Agent Developer Kit (ADK). Run locally with `uv run adk run <agent_name>` and deploy through Vertex AI Agent Builder.
- The sample catalog is file-backed for developer convenience; in production, integrate with Firestore, AlloyDB, or a partner API.
- Twilio credentials are loaded from environment variables. Without them, the messenger operates in dry-run mode for sandbox testing.
- The `.sessions` directory is git-ignored and suitable only for local development. Swap in a production store before go-live.


