---
name: add-proxy-endpoint
description: Add a new endpoint to the HomeApp FastAPI proxy under gcp/proxy/api. Use whenever the user asks to add, expose, or wire up a new API route on the proxy — covers router/service/schema layering, secret-prefix mounting, token-quota integration, and where the URL gets surfaced to mapp/webapp.
---

# Adding a new endpoint to gcp/proxy/api

The proxy follows a strict three-layer convention. **Don't put logic in the router file.**

```
gcp/proxy/api/
├── routers/    ← thin HTTP layer: validate input, call service, return response
├── services/   ← business logic, IO, Vertex / Gemini / Firestore / Pub/Sub
├── schemas/    ← Pydantic request/response models
└── main.py     ← assembles routers behind the secret prefix
```

## Step-by-step

### 1. Schema (`schemas/<feature>.py`)
Define a Pydantic model for the request body (and response if non-trivial). Example pattern from `schemas/checkpoint.py`:
```python
from pydantic import BaseModel

class FooRequest(BaseModel):
    userId: str
    propertyId: str
    payload: dict
```
Field naming convention is **camelCase** (clients are TS/JS).

### 2. Service (`services/<feature>_service.py`)
Put the actual work here — Vertex/Gemini calls, Firestore writes, Pub/Sub publishes. Services should be independent of FastAPI types where possible. Imports from `gcp/common` use the bare `common.*` namespace (e.g. `from common.token import quota`).

### 3. Router (`routers/<feature>.py`)
```python
from fastapi import APIRouter, HTTPException
import logging
from schemas.foo import FooRequest
from services.foo_service import do_foo

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/do-foo")
async def do_foo_endpoint(request_data: FooRequest):
    try:
        result = await do_foo(request_data)
        return {"status": "ok", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```
Keep the router file thin.

### 4. Mount in `main.py`
Add the import and mount **inside the `if settings.FIREBASE_WEBHOOK_SECRET:` block**, not outside, so it gets the secret prefix:
```python
from routers import agent, documents, telegram, service_broker, checkpoint, token_quota, foo
...
app.include_router(foo.router, prefix=prefix)
```
Update the log line to include the new router.

The only routes that should be mounted **outside** the secret block are user-facing endpoints that clients hit without the webhook secret (currently just `POST /token-quota-status` and `GET /health`). New routes default to **inside** the secret block.

### 5. Token quota — call it before any LLM/Vertex work
If your endpoint calls Reasoning Engine, Gemini `generate_content`, or `embed_content`, **enforce quota first** when a `userId` is present. Pattern (see how the checkpoint worker and `gcp/proxy/workers/function/document_analysis/main.py` do it):
```python
from common.token import quota
quota.check_or_raise(user_id=request_data.userId)
# ... do the LLM call ...
# usage_metadata returned by Gemini / stream events is then persisted by common.token helpers
```
Quota errors should bubble out as HTTP responses with `code: TOKEN_QUOTA_EXCEEDED`.

### 6. Surface the URL to clients

**Mobile (`apps/mapp/app.config.js` `extra:`)** — add a new URL key built via `buildProxyUrl(proxyBaseUrl, proxyToken, 'do-foo')`. Then read it in `apps/mapp/lib/api.ts` via `Constants.expoConfig?.extra?.doFooUrl`. Don't hardcode the secret prefix on the client side — `buildProxyUrl` already inserts `proxyToken`.

**Web (`apps/webapp`)** — typically calls go through `apps/webapp/src/lib/api-checkpoint.ts` (or a sibling file). Add a function there that builds the URL from the same env var family the rest of the file uses (the App Hosting yamls inject these).

**EAS / GitHub Actions env** — if the URL needs to be available in EAS builds or in App Hosting, add the corresponding entry in `apps/mapp/eas.json` or `apps/webapp/apphosting*.yaml`.

### 7. Tests
Add a test under `gcp/proxy/api/tests/`. The suite is run by `bash gcp/proxy/api/run_tests.sh` from `gcp/proxy/api/`. Use `pytest`/`pytest-asyncio` (already in `requirements.txt`).

## Quick checklist
- [ ] Schema in `schemas/`
- [ ] Logic in `services/`
- [ ] Router in `routers/` (thin)
- [ ] Mounted in `main.py` **inside the FIREBASE_WEBHOOK_SECRET block**
- [ ] Quota check before any LLM call when `userId` is known
- [ ] URL exposed to mapp via `app.config.js` `extra` and to webapp via `apphosting*.yaml`
- [ ] Test in `tests/`
