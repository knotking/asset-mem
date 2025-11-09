# Proxy AI Agent

The proxy agent normalizes inbound Twilio webhook payloads, updates the service session store, and returns a structured summary for the broker or downstream automations.

## Running Locally

```bash
cd gcp/agents/service_broker
uv run adk run proxy_agent
```

Provide a JSON payload that matches `ProxyWebhookInput` when prompted, for example:

```json
{
  "request_id": "demo-request",
  "from_number": "+14155550222",
  "channel": "sms",
  "body": "We can do this job today for $250 in about 2 hours."
}
```

The agent will:

1. Identify the provider associated with the session (via provider ID or phone number).
2. Record the inbound message in the session store (`.sessions/service_sessions.json` by default).
3. Extract pricing or follow-up intent metadata.
4. Emit a `ProviderResponseSummary` JSON document containing classification, estimate amount, and recommended follow-up actions.

Refer to `../docs/API_CONTRACTS.md` for the full schema specification.


