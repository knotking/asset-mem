# Verify deletion (integration checks)

Run **after** you delete something from the UI (or API). The script checks Firestore, Storage, and deletion jobs — it does **not** perform deletes.

## Prerequisites

- `gcloud auth application-default login` (or service account with Firestore + Storage read)
- `firebase-admin` installed (use migration venv: `delete-users-by-pattern.sh` creates `venv/`)
- `--project` set to your environment (`homegeek-staging`, etc.)

```bash
cd apps/webapp/scripts/migration
./verify-deletion.sh --help
```

## Workflow

1. Note IDs **before** delete (doc id, storage paths from Firestore doc, session id, etc.).
2. Delete from mapp/webapp.
3. Run the matching `verify` command below.
4. Exit code `0` = all checks passed; `1` = something still exists or job failed.

## Scenarios

### Document

```bash
./verify-deletion.sh --project homegeek-staging verify document \
  --user-id YOUR_UID \
  --doc-id DOC_ID \
  --storage-path documents/YOUR_UID/12345_file.pdf
```

Checks: `users/{uid}/docs/{docId}` gone; Storage object gone.

### Checkpoint

```bash
./verify-deletion.sh --project homegeek-staging verify checkpoint \
  --user-id YOUR_UID \
  --property-id PROPERTY_ID \
  --checkpoint-id CHECKPOINT_ID \
  --storage-path uploads/YOUR_UID/properties/PROPERTY_ID/checkpoints/photo.jpg
```

Checks: checkpoint doc gone; `metrics/summary` gone; Storage paths gone.

### Chat session

```bash
./verify-deletion.sh --project homegeek-staging verify session \
  --user-id YOUR_UID \
  --session-id SESSION_ID
```

Optional legacy attachment paths:

```bash
  --storage-path uploads/YOUR_UID/123_photo.jpg
```

Checks: chat + messages gone; `sharedChats` for that session gone.

### Saved provider

UI deletes via client `deleteDoc` on `users/{uid}/properties/{propertyId}/savedProviders/{id}`.
Use this scenario after a manual or scripted Firestore delete (not a proxy route).

```bash
./verify-deletion.sh --project homegeek-staging verify saved-provider \
  --user-id YOUR_UID \
  --property-id PROPERTY_ID \
  --provider-id PROVIDER_ID
```

### Property delete (async job)

Waits up to **180s** for `users/{uid}/deletionJobs/property_{propertyId}` to complete, then checks cascade.

```bash
./verify-deletion.sh --project homegeek-staging verify property \
  --user-id YOUR_UID \
  --property-id PROPERTY_ID
```

Optional doc storage paths that belonged to the property:

```bash
  --storage-path documents/YOUR_UID/deed.pdf \
  --wait-seconds 300
```

Checks: job `completed`; property doc gone; no docs/chats/checkpoints/savedProviders/sharedChats for property; `uploads/{uid}/properties/{pid}/` empty.

### User erasure (support / admin job)

```bash
./verify-deletion.sh --project homegeek-staging verify user \
  --user-id YOUR_UID \
  --wait-seconds 300
```

Checks: job completed; `users/{uid}` tree gone; `llm_token_usage`, `support_requests`, `sharedChats` clean; Storage prefixes empty.

### Poll job only

```bash
./verify-deletion.sh --project homegeek-staging wait-job \
  --user-id YOUR_UID \
  --job-id property_PROPERTY_ID \
  --wait-seconds 180
```

## Tips

- **Storage paths**: Copy `storagePath` from the Firestore doc before delete, or from Firebase Storage console.
- **`--gs-uri`**: Pass `gs://bucket/path` — path is derived for Storage checks.
- **Property still “deleting”**: Re-run with longer `--wait-seconds` or check proxy logs / job doc `error` field.
- **Session delete + modern chat**: No Storage checks unless you pass paths for legacy `message.file.gsURI` attachments.

## Automated leaf-to-root run (QA)

`run-deletion-scenarios.py` runs all delete scenarios **via uvproxy HTTP only** (leaf endpoints + property/user jobs), then calls `verify-deletion.sh`.

```bash
# 1. uvproxy running on :8080
# 2. Firebase ID token for the target user (same as TEST_FIREBASE_ID_TOKEN for proxy scripts)
export TEST_FIREBASE_ID_TOKEN="…"   # from webapp while logged in as user
# 3. optional: DATA_ERASURE_ADMIN_SECRET in gcp/proxy/.env for user erasure step

./run-deletion-scenarios.sh \
  --user-id YOUR_UID --project homegeek-staging --proxy-url http://localhost:8080
```

Proxy routes used: `POST /deletion/document`, `/checkpoint`, `/session`, `/property`, `/user`, `GET /deletion/jobs/{id}`.
Saved-provider step uses Admin SDK `delete()` (matches app client delete).

## Related

- [DELETE-USERS-README.md](./DELETE-USERS-README.md) — batch user wipe
- [docs/operations/DELETION_PLAN.md](../../../docs/operations/DELETION_PLAN.md) — unified delete plan (ops erasure, audit, roadmap)
