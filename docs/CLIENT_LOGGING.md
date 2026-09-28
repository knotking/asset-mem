# Client logging (webapp & mapp)

AssetMem frontends use small, app-local loggers (not shared with each other for webapp). Logs are **namespaced**, **structured**, and **gated in production** so routine `info`/`debug` noise does not appear in user browsers or production bundles unless explicitly enabled.

Backend Python services use `gcp/common/observability/` (OpenTelemetry, Cloud Logging). This document covers **TypeScript clients only**.

## Logger locations

| App | Module | Used by |
|-----|--------|---------|
| Webapp | `apps/webapp/src/lib/logger.ts` | Webapp only |
| Mapp | `apps/mapp/lib/logger.ts` | Mapp app code (`@/lib/logger`) |
| Mapp contexts | `apps/common/src/lib/logger.ts` | `@asset-mem/common` contexts (document upload, sessions, etc.) |

Webapp does **not** import `@asset-mem/common/lib/logger`; the two mobile/web copies stay in sync by convention.

## API

```ts
import { createLogger } from '@/lib/logger'; // or @/lib/logger on mapp

const log = createLogger('agent');

log.debug('stream.chunk', { byteCount: 128 });  // verbose only
log.info('stream.start', { sessionId: '…' });   // verbose only
log.warn('quota.fetch.failed', { cause: 'HTTP 503' });
log.error('stream.failed', { status: 500 }, err);
```

Helpers: `truncateId()`, `parseAgentErrorCode()` (webapp/mapp agent modules).

Exported flag: `isVerboseLogging` — `true` when debug/info are emitted.

## Log levels and production behavior

| Level | When it runs | Typical use |
|-------|----------------|-------------|
| **debug** | Verbose mode only | Routing, JSON parse attempts, upload progress, geolocation |
| **info** | Verbose mode only | Agent stream start/complete, session created, batch upload started |
| **warn** | **Always** | Non-fatal issues (quota status fetch failed, RAG upload failed, 404 on session delete) |
| **error** | **Always** | Failures users care about (stream failed, Firestore errors) |

### Verbose mode (`debug` + `info`)

Verbose mode is **on** when any of the following is true:

**Webapp**

- `NODE_ENV === 'development'` (local `npm run dev`), or
- `NEXT_PUBLIC_DEBUG_LOGS` is `true`, `1`, or `yes` (case-insensitive)

**Mapp / common (mapp)**

- `__DEV__ === true` (Expo dev client / debug builds), or
- `EXPO_PUBLIC_DEBUG_LOGS` is `true`/`1`/`yes` at **build time**, or
- `extra.debugLogs === true` from `app.config.js` (derived from `EXPO_PUBLIC_DEBUG_LOGS`)

Verbose mode is **off** in production release builds when none of the above apply.

## Webapp: build-time stripping

For production **builds** where `NEXT_PUBLIC_DEBUG_LOGS` is **not** `true`, `apps/webapp/next.config.ts` enables:

```ts
compiler: {
  removeConsole: { exclude: ['error', 'warn'] },
}
```

So `console.log`, `console.info`, and `console.debug` calls are removed from the client bundle (in addition to the runtime gate in `logger.ts`). `console.warn` and `console.error` remain.

This applies to Firebase App Hosting builds: the flag must be set at **BUILD** time in `apphosting.*.yaml` to affect stripping.

Server-side code (Server Actions, RSC) still uses the runtime gate; server `console` output goes to **Cloud Run logs** (Cloud Logging), not the user’s browser.

## Environment defaults

### Webapp (Firebase App Hosting)

| Config file | `NEXT_PUBLIC_DEBUG_LOGS` | Verbose logs |
|-------------|--------------------------|--------------|
| `apphosting.yaml` (dev) | `true` | On in prod builds of dev backend |
| `apphosting.staging.yaml` | `true` | On in staging |
| `apphosting.prod.yaml` | *(unset)* | **Off** |

Also set: `NEXT_PUBLIC_ENV` (`dev` / `staging` / `prod`) for app logic — separate from logging.

Local dev: verbose always on via `NODE_ENV=development` (no env var required).

### Mapp (EAS)

| EAS profile | `EXPO_PUBLIC_DEBUG_LOGS` | Verbose in release build |
|-------------|--------------------------|---------------------------|
| `development` | `true` | On (`__DEV__` is usually true anyway) |
| `staging` | `true` | On (intentional for QA) |
| `prod` | *(unset)* | **Off** |

`app.config.js` exposes `extra.debugLogs` for the mapp logger.

### Mapp: build-time stripping

For **production** Babel transforms when `EXPO_PUBLIC_DEBUG_LOGS` is **not** `true`, `apps/mapp/babel.config.js` applies `babel-plugin-transform-remove-console` with `{ exclude: ['error', 'warn'] }` (same policy as webapp `removeConsole`).

So `console.log`, `console.info`, and `console.debug` are removed from release bundles in addition to the runtime gate in `logger.ts`. EAS profiles `prod` and `prod-apk` omit `EXPO_PUBLIC_DEBUG_LOGS`; `staging` keeps verbose logs for QA.

Local dev: `.env` may set `EXPO_PUBLIC_DEBUG_LOGS=true`; `__DEV__` already enables verbose logs.

## Enabling verbose logs temporarily in production

### Webapp

Add to `apps/webapp/apphosting.prod.yaml` (both BUILD and RUNTIME):

```yaml
  - variable: NEXT_PUBLIC_DEBUG_LOGS
    value: "true"
    availability:
      - BUILD
      - RUNTIME
```

Redeploy the App Hosting backend. Remove or set to `false` when finished.

### Mapp

Add to `apps/mapp/eas.json` under `build.prod.env`:

```json
"EXPO_PUBLIC_DEBUG_LOGS": "true"
```

Create a new EAS build (OTA update alone may not change inlined env; prefer a new binary for store builds).

## Filtering logs

All logger output uses a consistent prefix:

```text
[namespace] message {"key":"value"}
```

Namespaces in use include: `agent`, `chat`, `checkpoint`, `upload`, `session`, `property`, `properties`, `quota`, `preferences`, `auth`, `routes`, `parse`, `camera`, `share`.

In Chrome DevTools or Metro, filter by e.g. `[agent]` or `[checkpoint]`.

## What is not gated

- **`warn` and `error`** always emit (subject to `removeConsole` only removing non-warn/error on webapp prod builds).
- **Firebase config** one-off messages (`[firebase] Unknown environment…`) use raw `console.warn`, not the logger.
- **Backend** logs include `[req=…]` correlation ids when requests hit the proxy; see below.

## Correlation IDs (client ↔ proxy)

Every proxy `fetch` should send **`X-Request-ID`** so Cloud Run logs, structured JSON logs, and browser verbose logs line up for a single HTTP request.

| Layer | Module / behavior |
|-------|-------------------|
| Webapp | `apps/webapp/src/lib/correlation-id.ts` — `proxyFetch()`, `createCorrelationId()` |
| Mapp | `@asset-mem/common/lib/correlation-id` via `apps/mapp/lib/api.ts` — `proxyFetchWithAuth()`, `createCorrelationId()` |
| Common (mapp quota) | `@asset-mem/common/lib/correlation-id` |
| Proxy | `CorrelationIdMiddleware` — reads header (or `X-Correlation-ID`), echoes on response |
| Python logs | `[req=…]` via `gcp/common/observability/logging_context.py`; JSON `log_event` adds `correlation_id` |

Agent streams log `correlationId` (truncated) in `stream.start` / `stream.complete` metadata alongside `firebaseChatId` and `agentSessionId`. Use the same value as the `X-Request-ID` header on that stream request to grep proxy logs.

**Downstream propagation**

- **Pub/Sub workers** (document analysis, checkpoint analysis, user docs, checkpoint metrics): proxy publishes `correlation_id` on the message; workers bind it via `worker_request_scope` so Cloud Function logs show the same `[req=…]`.
- **Vertex agent engine**: proxy includes `correlation_id` in the Reasoning Engine JSON payload; ADK session state + `before_model` / `before_tool` callbacks bind it in Agent Engine logs.

## Security notes

- Do not log user queries, document text, full tokens, or precise location in production.
- Prefer `truncateId()` for session/property/checkpoint IDs in metadata.
- `parseAgentErrorCode()` helps classify quota errors without logging full response bodies in user-facing paths (errors still go to `error` with `cause` message only when using the logger’s `err` argument).

## ESLint guardrails

`no-console` is enforced in application code. Use `createLogger()` instead of raw `console.*`.

| Package | Config | Lint command |
|---------|--------|--------------|
| Webapp | `apps/webapp/eslint.config.mjs` | `cd apps/webapp && npm run lint` |
| Mapp | `apps/mapp/eslint.config.js` | `cd apps/mapp && npm run lint` |
| Common | `apps/common/eslint.config.mjs` | `cd apps/common && npm run lint` |

**Allowed `console` usage:** only inside each package’s `lib/logger.ts` (implementation of the logger). Webapp `scripts/**` are ignored by ESLint.

Configs are intentionally **minimal** (only `no-console` on TypeScript sources). They do not enable full `eslint-config-next` / `eslint-config-expo` rule sets yet, to avoid unrelated legacy violations. Use `npm run typecheck` in webapp for TypeScript checks.

## Related code

- Agent streaming: `apps/webapp/src/lib/api-agent.ts`, `apps/mapp/lib/api.ts`
- Checkpoint API (webapp): `apps/webapp/src/lib/api-checkpoint.ts`
