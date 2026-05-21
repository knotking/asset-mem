#!/usr/bin/env bash
# Create or update Cloud Monitoring alert policies and optional uptime checks for HomeApp.
#
# Usage:
#   export MONITORING_NOTIFICATION_CHANNEL_IDS="projects/PROJECT/notificationChannels/123,..."
#   ./.github/scripts/apply-monitoring-alerts.sh PROJECT_ID ENV REGION
#
# Policy templates: docs/deployment/monitoring/policies/
#
# Optional:
#   PROXY_HEALTH_HOST=https://homecare-agent-proxy-staging-xxx.run.app  (enables uptime check)
#   SKIP_UPTIME=1

set -euo pipefail

PROJECT_ID="${1:?PROJECT_ID required}"
ENV="${2:?ENV required}"
REGION="${3:-us-central1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
POLICY_DIR="${REPO_ROOT}/docs/deployment/monitoring/policies"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

PROXY_SERVICE="homecare-agent-proxy-${ENV}"

echo "=== Monitoring alerts: project=${PROJECT_ID} env=${ENV} region=${REGION} ==="

gcloud config set project "${PROJECT_ID}" --quiet

TOKEN_METRIC="homeapp_token_quota_exceeded_${ENV}"
if gcloud logging metrics describe "${TOKEN_METRIC}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "✓ Log metric exists: ${TOKEN_METRIC}"
else
  echo "Creating log metric: ${TOKEN_METRIC}"
  gcloud logging metrics create "${TOKEN_METRIC}" \
    --project="${PROJECT_ID}" \
    --description="TOKEN_QUOTA_EXCEEDED on HomeApp proxy (${ENV})" \
    --log-filter="resource.type=\"cloud_run_revision\"
resource.labels.service_name=\"${PROXY_SERVICE}\"
(jsonPayload.code=\"TOKEN_QUOTA_EXCEEDED\" OR textPayload=~\"TOKEN_QUOTA_EXCEEDED\")"
  echo "✓ Log metric created"
fi

render_policy() {
  local template="$1"
  local out="$2"
  sed \
    -e "s/__PROJECT_ID__/${PROJECT_ID}/g" \
    -e "s/__ENV__/${ENV}/g" \
    -e "s/__REGION__/${REGION}/g" \
    -e "s/__PROXY_SERVICE__/${PROXY_SERVICE}/g" \
    -e "s/__TOKEN_METRIC__/${TOKEN_METRIC}/g" \
    "${template}" > "${out}"
}

attach_notification_channels() {
  local policy_file="$1"
  if [ -z "${MONITORING_NOTIFICATION_CHANNEL_IDS:-}" ]; then
    cp "${policy_file}" "${policy_file}.final"
    return 0
  fi
  python3 - "${policy_file}" "${MONITORING_NOTIFICATION_CHANNEL_IDS}" <<'PY'
import json, sys
path, channels_csv = sys.argv[1], sys.argv[2]
with open(path) as f:
    policy = json.load(f)
policy["notificationChannels"] = [c.strip() for c in channels_csv.split(",") if c.strip()]
with open(path + ".final", "w") as f:
    json.dump(policy, f, indent=2)
PY
}

upsert_policy() {
  local display_name="$1"
  local policy_file="$2"
  local existing
  existing="$(gcloud monitoring policies list \
    --project="${PROJECT_ID}" \
    --filter="displayName=\"${display_name}\"" \
    --format="value(name)" 2>/dev/null | head -1 || true)"
  if [ -n "${existing}" ]; then
    echo "Updating alert policy: ${display_name}"
    gcloud monitoring policies update "${existing}" \
      --project="${PROJECT_ID}" \
      --policy-from-file="${policy_file}" \
      --quiet
  else
    echo "Creating alert policy: ${display_name}"
    gcloud monitoring policies create \
      --project="${PROJECT_ID}" \
      --policy-from-file="${policy_file}" \
      --quiet
  fi
}

for template in "${POLICY_DIR}"/*.json; do
  base="$(basename "${template}")"
  rendered="${TMP_DIR}/${base}"
  render_policy "${template}" "${rendered}"
  attach_notification_channels "${rendered}"
  display_name="$(python3 -c "import json; print(json.load(open('${rendered}.final'))['displayName'])")"
  upsert_policy "${display_name}" "${rendered}.final"
  echo "✓ ${display_name}"
done

if [ "${SKIP_UPTIME:-}" = "1" ]; then
  echo "Skipping uptime checks (SKIP_UPTIME=1)"
else
  if [ -n "${PROXY_HEALTH_HOST:-}" ]; then
    host="${PROXY_HEALTH_HOST#https://}"
    host="${host#http://}"
    host="${host%%/*}"
    uptime_id="homeapp-proxy-health-${ENV}"
    if gcloud monitoring uptime list-configs --project="${PROJECT_ID}" --format="value(name)" 2>/dev/null | grep -q "${uptime_id}\$"; then
      echo "✓ Uptime check exists: ${uptime_id}"
    else
      echo "Creating proxy uptime check: ${host}/health"
      gcloud monitoring uptime create "${uptime_id}" \
        --project="${PROJECT_ID}" \
        --resource-type=uptime-url \
        --display-name="HomeApp proxy health (${ENV})" \
        --http-check-path="/health" \
        --hostname="${host}" \
        --period=300 \
        --timeout=10 \
        --quiet || echo "⚠ Uptime create failed (configure notification channel in Console)"
    fi
  else
    echo "⊘ Set PROXY_HEALTH_HOST to create proxy uptime check"
  fi
fi

echo "=== Monitoring alerts complete ==="
if [ -z "${MONITORING_NOTIFICATION_CHANNEL_IDS:-}" ]; then
  echo "ℹ️  No MONITORING_NOTIFICATION_CHANNEL_IDS set — attach channels in Cloud Console → Monitoring → Alerting"
fi
