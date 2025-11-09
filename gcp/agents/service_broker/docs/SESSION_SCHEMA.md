# Session Schema

The `SessionStore` persists broker sessions to a JSON file for local development. Each session captures dispatch decisions, provider timelines, and inbound/outbound messages.

## File Location

- Default path: `.sessions/service_sessions.json` (relative to this package).
- Override with the `SESSION_STORE_PATH` environment variable.

## Top-Level Structure

```json
{
  "<request_id>": {
    "request_id": "req-123",
    "user_id": "user-42",
    "category": "plumbing",
    "description": "Leak under kitchen sink",
    "location_city": "San Francisco",
    "location_postal_code": "94016",
    "preferred_channel": "sms",
    "status": "in_progress",
    "created_at": "2025-01-11T02:45:16.131314",
    "updated_at": "2025-01-11T03:02:41.441231",
    "providers": [],
    "extra": {}
  }
}
```

## Provider Dispatch Entry

Each provider contacted appears in the `providers` array with the following shape:

```json
{
  "provider_id": "plumb_fast",
  "channel": "sms",
  "status": "responded",
  "last_message_sid": "SM123...",
  "last_updated": "2025-01-11T03:02:41.441231",
  "metadata": {
    "display_name": "PlumbFast Services",
    "rating": "4.6",
    "phone_number": "+14155550222"
  },
  "messages": []
}
```

- `status`: `pending`, `sent`, `delivered`, `responded`, or `failed`.
- `metadata`: Free-form dictionary where the broker stores display names, ratings, or other enrichment fields.
- `messages`: Chronological list of inbound/outbound interactions.

## Provider Message Entry

```json
{
  "direction": "outbound",
  "channel": "sms",
  "body": "Hi PlumbFast, HomeGeek has a new plumbing request...",
  "timestamp": "2025-01-11T02:45:16.131314",
  "metadata": {
    "message_sid": "SM123...",
    "dry_run": "True"
  }
}
```

- `direction`: `outbound` for broker-initiated messages, `inbound` for provider responses.
- `metadata`: Used to store Twilio message SIDs, phone numbers, media URLs, etc.

## Status Lifecycle

1. **queued** – Session created but no provider dispatched yet.
2. **in_progress** – At least one provider has responded or a follow-up is in flight.
3. **completed** – An estimate has been accepted or the request satisfied.
4. **cancelled** – The requester cancelled or the broker abandoned the request.

Update the lifecycle as your orchestration matures. For production systems, replace this JSON store with a durable database layer.


