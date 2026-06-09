# Property Reports API

Proxy routes (Firebase auth). Base path is `/` or legacy `/{FIREBASE_WEBHOOK_SECRET}/`.

## POST `/reports/preview`

Resolve which checkpoints would be included before generating. No quota charge.

**Body:** same date fields as generate (`mode`, `snapshotRange` or `baselineRange` + `comparisonRange`) — omit `title`, `purpose`, and `template`.

**Response (snapshot):** `{ "mode": "snapshot", "checkpoints": [{ "checkpointId", "name", "location", "analysisStatus", "capturedAt" }], "warnings": [] }`

**Response (comparison):** `{ "mode": "comparison", "pairs": [...], "baselineOnly": [], "comparisonOnly": [], "warnings": [] }`

Pass `checkpointIds` on generate to exclude deselected rows from the preview.

## POST `/reports/preview-html`

Server-rendered HTML using the same Jinja templates as the PDF worker (`gcp/common/report/`). No quota charge; no Gemini executive summary (layout/structure preview only).

**Body:** same as generate (`title`, `purpose`, `template`, date ranges, optional `checkpointIds`) — omit `regenerateReportId`.

**Response:** `{ "html": "<!DOCTYPE html>...", "warnings"?: string[] }`

Clients try this endpoint for layout preview and fall back to a client-side selection summary when unavailable (banner explains that the formatted layout could not be loaded).

## POST `/reports/status`

Poll async generation without reading Firestore directly.

**Body:** `{ "userId", "propertyId", "reportId" }`

**Response:** `{ "reportId", "status", "revision", "failureReason"?, "generatedAt"?, "updatedAt"? }`

## POST `/reports/generate`

Enqueue async report generation (`snapshot` or `comparison`). Records `monthlyReportGenerationsLimit` quota only after Pub/Sub publish succeeds. If publish fails, the provisional Firestore report doc is deleted (or restored on regenerate).

**Body (camelCase):**

```json
{
  "userId": "uid",
  "propertyId": "propId",
  "title": "Showing snapshot — June 2026",
  "mode": "snapshot",
  "purpose": "realtor_visit",
  "snapshotRange": { "start": "2026-06-01", "end": "2026-06-01" },
  "checkpointIds": null,
  "customNotes": "optional",
  "template": {
    "layoutId": "professional",
    "includeCoverPage": true,
    "includePhotos": true,
    "includeIssueTable": true,
    "includeVisualDiff": false,
    "includeRecommendations": false,
    "includeSignatureBlock": false
  }
}
```

**Purpose** (`rental_security` | `realtor_visit` | `insurance` | `custom`) — drives PDF branding, default section flags, and disclaimer copy. Clients expose this in the generate modal.

**Template `layoutId`** — `professional` (default) for new reports. `classic` remains supported for existing PDFs only (legacy compact template). Purpose-specific section defaults merge with explicit `template` fields.

**Chat archived revisions:** optional `report_revisions` map (`report_id` → revision number) on agent requests loads `reports/{id}/revisions/{n}` snapshots when the user picks an archived revision in Reports chat mode.

**Comparison body:** set `mode: "comparison"`, `purpose: "rental_security"`, `baselineRange`, and `comparisonRange` (no `snapshotRange`). Proxy pairs latest checkpoint per `location` between ranges.

**Response:** `{ "status": "accepted", "reportId", "revision", "messageId", "warnings"?: string[] }` — `warnings` when pair rate is low or locations are unpaired.

**Errors:** `400` validation; `429` `REPORT_QUOTA_EXCEEDED`

Firestore: `users/{uid}/properties/{pid}/reports/{reportId}` with `status: generating` → worker sets `ready` or `failed`.

## POST `/reports/signed-url`

Short-lived GCS signed URL for a ready report PDF.

**Body:** `{ "userId", "propertyId", "reportId" }`

**Response:** `{ "url", "expiresInSeconds" }`

**Errors:** `400` if report missing or not `ready`; `500` if bucket/signing is misconfigured.

### Local dev: opening PDFs

Staging/prod Cloud Run uses the runtime service account and IAM **signBlob** automatically. Local `uvicorn` uses **user ADC** (`gcloud auth application-default login`), which has no private key — signing goes through `common.storage.client.StorageClient` with `service_account_email` + `access_token`.

**Required in `gcp/proxy/.env`:**

| Variable | Purpose |
|----------|---------|
| `GCS_BUCKET` | User-data bucket (e.g. `homegeek-user-data-staging`) |
| `GCP_PROJECT_ID` | Firestore + GCS project |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Runtime SA to sign as (e.g. `githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com`) |
| `REPORT_GENERATION_TOPIC` | Pub/Sub topic for async generate (e.g. `report-generation-topic-staging`) |

Optional override: `GCS_SIGNING_SERVICE_ACCOUNT` (wins over `GCP_SERVICE_ACCOUNT_EMAIL`).

**Grant your user signBlob on the runtime SA** (once per project):

```bash
gcloud iam service-accounts add-iam-policy-binding \
  githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com \
  --member="user:YOU@example.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=homegeek-staging
```

**Alternative — ADC impersonation** (no per-user binding if you can impersonate the SA):

```bash
gcloud auth application-default login \
  --impersonate-service-account=githubworkflowdeployment@homegeek-staging.iam.gserviceaccount.com
```

Copy `gcp/proxy/.env.example` for the full template. See also [run-proxy-local skill](../../.claude/skills/run-proxy-local/SKILL.md) for starting the proxy.

**Common failures**

| Symptom | Fix |
|---------|-----|
| `Storage bucket is not configured` | Set `GCS_BUCKET` (not only `GCS_BUCKET_NAME`) in `.env` |
| `you need a private key to sign credentials` | Set `GCP_SERVICE_ACCOUNT_EMAIL` + TokenCreator grant, or use impersonation |
| Report stuck on `generating` | Deploy report worker; ensure Pub/Sub trigger can invoke Cloud Run (`invoker-iam-disabled` on the worker service — see [README-report-generation](../../.github/workflows/README-report-generation.md)) |

## POST `/reports/metadata`

Update title and notes without regenerating the PDF.

**Body:** `{ "userId", "propertyId", "reportId", "title"?, "customNotes"? }`

**Response:** `{ "status": "ok" }`

## POST `/reports/share`

Create or refresh a public share link (30-day TTL). Writes `sharedReports/{shareId}` and sets `shareId` on the report doc.

**Body:** `{ "userId", "propertyId", "reportId" }`

**Response:** `{ "shareId", "expiresAt", "revision" }`

View at `{webAppOrigin}/share/report/{shareId}` — page loads share metadata from Firestore and fetches a signed PDF URL via the endpoint below.

**Deploy checklist (staging):** On branch `apps/report`, auto-deploy only runs the report worker. You must also run from that branch:

```bash
gh workflow run deploy-webapp-apphosting.yaml -f environment=staging --ref apps/report
gh workflow run deploy-homecare-agent-proxy.yaml -f environment=staging --ref apps/report
```

The webapp workflow deploys `firestore.rules` (`sharedReports` public read). Without it, anonymous visitors see Firebase `permission-denied` / “Missing or insufficient permissions.” The proxy workflow ships `POST /reports/public-signed-url` (no auth).

## POST `/reports/public-signed-url`

No auth. Returns a short-lived GCS URL for a non-expired `sharedReports` entry.

**Body:** `{ "shareId" }`

**Response:** `{ "url", "expiresInSeconds" }`

**Errors:** `404` if share missing or expired; `400` if report not `ready`.

## POST `/reports/generate` (regenerate)

Pass `regenerateReportId` with the existing report id to bump `revision`, archive the prior revision under `reports/{id}/revisions/{n}`, and enqueue a new PDF. Quota is charged on successful publish (same as new report).

When `includeInDocsChat` was enabled on the prior revision, regenerate preserves the flag and `ragCompanionDocId`, deletes the old RAG file, and the worker re-imports the new `v{revision}.md` companion after the PDF is ready.

## POST `/reports/rag-index`

Opt in or out of indexing the report markdown companion (`mdGsUri`) for **Docs** mode RAG search. Default is off at generate time.

**Feature flag (default off):** Set `REPORT_DOCS_CHAT_RAG_ENABLED=true` on the proxy and report worker, `NEXT_PUBLIC_REPORT_DOCS_CHAT_RAG=true` on webapp (read via local `apps/webapp/src/lib/feature-flags.ts`, mirrored from common), and `EXPO_PUBLIC_REPORT_DOCS_CHAT_RAG=true` on mapp builds before exposing the UI toggle. Enable requests return `400` when the flag is off; disable still works for cleanup.

**Body:** `{ "userId", "propertyId", "reportId", "includeInDocsChat": true | false }`

**Enable (`includeInDocsChat: true`):**

- Report must be `ready` with `mdGsUri` / `mdStoragePath` from the worker.
- Creates or updates `users/{uid}/docs/{ragCompanionDocId}` with `documentType: PROPERTY_REPORT` (hidden from Docs add-context picker).
- Records `monthlyDocumentCreations` quota once per first enable.
- Publishes `source: report-rag-index` to `USER_UPLOAD_TOPIC` for the `user_docs` worker.
- Sets `includeInDocsChat`, `ragCompanionDocId`, and `ragGsUri` on the report doc.

**Disable (`includeInDocsChat: false`):**

- Deletes RAG corpus entry for `ragGsUri`, removes companion doc, clears RAG fields on the report.

**Response:** `{ "ok": true, "includeInDocsChat", "ragCompanionDocId"?, "messageId"?, "warnings"?: string[] }`

**Errors:** `400` validation; `429` `DOCUMENT_QUOTA_EXCEEDED`

## AI chat (`primary_agent: "report"`)

Agent stream body (via proxy `AgentRequest`):

- `primary_agent: "report"`
- `report_ids: string[]` — ready property reports to load frozen `chatMarkdown` / `contentSnapshot`
- `property_id` — required for Firestore report paths

Resolve routes to `report_retrieval`; answers cite frozen snapshots only.

## POST `/deletion/report`

Sync delete report doc, revision subdocs, GCS prefix, optional RAG URI, and `sharedReports/{shareId}` when present.

**Body:** `{ "userId", "propertyId", "reportId" }`

## Worker

Pub/Sub topic: `REPORT_GENERATION_TOPIC` (default `report-generation-topic`).

Entry: `gcp/proxy/workers/function/report_generation/main.py` → `pubsub_to_report_generation`.

PDF renderer: set `REPORT_PDF_RENDERER=playwright` in the report worker (GHA deploy). The deploy workflow bundles Chromium into `ms-playwright/` and sets `PLAYWRIGHT_BROWSERS_PATH=/workspace/ms-playwright`. **Falls back to xhtml2pdf** if Playwright/Chromium is missing (typical on local dev without running `scripts/install-playwright-browsers.sh`). Comparison pairs without `visualDiff` get a Gemini text narrative in the worker.

**Property cap:** new generates are rejected at 50 reports per property (`regenerateReportId` is exempt).

**Indexes:** deploy `apps/webapp/firestore.indexes.json` for `reports` collection-group composites when adding cross-property report queries.
