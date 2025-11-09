# API Contracts

This document specifies the structured payloads exchanged between the HomeGeek application, the ADK agents, and Twilio.

## Broker Agent (`service_broker_agent`)

### Input: `ServiceRequestInput`

| Field | Type | Notes |
| --- | --- | --- |
| `request_id` | string? | Optional pre-generated request identifier. The agent will generate a UUID if missing. |
| `user_id` | string | Required HomeGeek user identifier. |
| `service_category` | string | Canonical category such as `plumbing`, `hvac`, `cleaning`. |
| `problem_statement` | string | Free-form description of the issue. |
| `location_city` | string? | Optional city for provider filtering. |
| `location_postal_code` | string? | Optional postal code for provider filtering. |
| `urgency` | string? | `low`, `medium`, `high`, or text. |
| `preferred_channel` | string | Defaults to `sms`. Accepts `sms`, `whatsapp`, `voice`, `email`. |
| `contact_number` | string? | Callback number for the homeowner. |
| `budget_ceiling_usd` | number? | Optional spending cap. |
| `attachments` | Attachment[] | Optional supporting files (photos, docs). |
| `metadata` | Map<string, string> | Arbitrary additional context. |

### Tools

- `fetch_provider_candidates(service_category, location_city?, location_postal_code?, min_rating?, limit?)`  
  Returns `{ "providers": Provider[] }`.
- `open_or_update_session(request_id?, user_id, service_category, problem_statement, location_city?, location_postal_code?, preferred_channel, providers?, metadata?)`  
  Creates/updates the session and returns `{ "request_id": string, "status": string }`.
- `render_dispatch_template(provider_name, service_category, problem_statement, location_city?, location_postal_code?, urgency?, callback_number?)`  
  Returns a channel-appropriate message string.
- `dispatch_via_twilio(request_id, provider_id, phone_number, channel, body)`  
  Sends the message and returns the Twilio dispatch status.

### Output: `BrokerResponse`

```
{
  "request_id": "req-123",
  "session_status": "queued",
  "providers_contacted": [
    {
      "provider_id": "plumb_fast",
      "display_name": "PlumbFast Services",
      "channel": "sms",
      "rating": 4.6,
      "eta_minutes": 15,
      "status": "sent",
      "phone_number": "+14155550222"
    }
  ],
  "notes": "Sent request to 1 provider. Awaiting responses."
}
```

## Proxy Agent (`proxy_agent`)

### Input: `ProxyWebhookInput`

| Field | Type | Notes |
| --- | --- | --- |
| `request_id` | string | Required session identifier (passed via webhook query string or Twilio metadata). |
| `provider_id` | string? | Optional if session lookup via phone should be performed. |
| `from_number` | string | Provider's E.164 number. |
| `to_number` | string? | Twilio destination number. |
| `channel` | string | `sms`, `whatsapp`, `voice`, or `email`. Defaults to `sms`. |
| `body` | string | Raw text from the provider. |
| `message_sid` | string? | Twilio message SID. |
| `sent_at` | string? | ISO timestamp when Twilio recorded the event. |
| `metadata` | Map<string, string> | Extra webhook fields (media URLs, transcription IDs, etc.). |

### Tools

- `identify_provider_for_request(request_id, provider_id?, from_number?)`  
  Returns `{ success, provider_id, confidence, matched_on?, reason? }`.
- `record_provider_message(request_id, provider_id, channel, body, message_sid?, from_number?, metadata?)`  
  Persists the inbound message and updates session status.
- `extract_estimate_metadata(message)`  
  Parses pricing/turnaround hints and returns `{ intent, amount?, currency?, turnaround?, follow_up_needed }`.
- `get_session_snapshot(request_id)`  
  Returns `{ found, session? }` for additional context.

### Output: `ProviderResponseSummary`

```
{
  "request_id": "req-123",
  "provider_id": "plumb_fast",
  "session_status": "in_progress",
  "classification": "estimate",
  "summary": "PlumbFast can visit today for $250 and expects the repair to take 2 hours.",
  "estimate_amount": 250.0,
  "estimate_currency": "USD",
  "follow_up_needed": false,
  "raw_text": "We can send a tech today for $250. Takes about 2 hours."
}
```

When the agent cannot match the session or provider, the output should look like:

```
{
  "request_id": "req-unknown",
  "provider_id": "",
  "session_status": "error",
  "classification": "error",
  "summary": "Unable to locate session req-unknown. Confirm the request_id parameter.",
  "estimate_amount": null,
  "estimate_currency": null,
  "follow_up_needed": true,
  "raw_text": "..."
}
```

## Twilio Webhook Expectations

- Configure the messaging service to include the `request_id` (and optionally `provider_id`) as query parameters on the webhook URL:  
  `https://proxy.homegeek.ai/twilio/webhook?request_id={{RequestId}}&provider_id={{ProviderId}}`
- The webhook handler should forward the normalized payload to the `proxy_agent` (e.g., via Cloud Run or Cloud Functions).
- Twilio credentials and webhook URLs are managed through the environment variables referenced in the top-level `README.md`.


