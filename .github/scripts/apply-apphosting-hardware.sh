#!/usr/bin/env bash
# Apply App Hosting runConfig tier to underlying Cloud Run via gcloud (when rollout uses remote git).
set -euo pipefail

ENVIRONMENT="${1:?environment required}"
TIER="${2:?tier required}"
REGION="${GCP_REGION:-us-central1}"
PROJECT="${GCP_PROJECT_ID:?GCP_PROJECT_ID required}"
BACKEND_ID="${ENVIRONMENT}"
# Optional override: APPHOSTING_CLOUD_RUN_SERVICE_prod
SERVICE_VAR="APPHOSTING_CLOUD_RUN_SERVICE_${ENVIRONMENT}"
SERVICE_NAME="${!SERVICE_VAR:-}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pip install -q pyyaml
JSON="$(python3 .github/scripts/hardware_tier.py -e "$ENVIRONMENT" -t "$TIER" export-json)"
CPU="$(echo "$JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('APPHOSTING_CPU',''))")"
MEMORY_MIB="$(echo "$JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('APPHOSTING_MEMORY_MIB',''))")"
MIN_INST="$(echo "$JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('APPHOSTING_MIN_INSTANCES',''))")"
MAX_INST="$(echo "$JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('APPHOSTING_MAX_INSTANCES',''))")"
CONCURRENCY="$(echo "$JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('APPHOSTING_CONCURRENCY',''))")"

if [[ -z "$SERVICE_NAME" ]]; then
  echo "Discovering App Hosting Cloud Run service for backend ${BACKEND_ID}..."
  SERVICE_NAME="$(gcloud run services list \
    --project="$PROJECT" \
    --region="$REGION" \
    --format='value(metadata.name)' \
    --filter="metadata.labels.firebase-app-hosting-backend=${BACKEND_ID}" 2>/dev/null | head -1 || true)"
fi

if [[ -z "$SERVICE_NAME" ]]; then
  echo "Could not discover App Hosting Cloud Run service. Set ${SERVICE_VAR} or apply runConfig via apphosting.prod.yaml + deploy-webapp."
  exit 0
fi

ARGS=(gcloud run services update "$SERVICE_NAME" --region="$REGION" --project="$PROJECT")
[[ -n "$CPU" ]] && ARGS+=(--cpu="$CPU")
[[ -n "$MEMORY_MIB" ]] && ARGS+=(--memory="${MEMORY_MIB}Mi")
[[ -n "$MIN_INST" ]] && ARGS+=(--min-instances="$MIN_INST")
[[ -n "$MAX_INST" ]] && ARGS+=(--max-instances="$MAX_INST")
[[ -n "$CONCURRENCY" ]] && ARGS+=(--concurrency="$CONCURRENCY")

echo "Updating App Hosting Cloud Run service: ${SERVICE_NAME}"
"${ARGS[@]}"
