#!/usr/bin/env bash
# Configure Pub/Sub dead-letter topics and policies for HomeApp worker pipelines.
#
# Usage:
#   ./.github/scripts/apply-pubsub-dlq.sh PROJECT_ID ENV [MAX_DELIVERY_ATTEMPTS]
#
# Idempotent: safe to re-run on existing environments (including after worker deploys
# create Eventarc-managed subscriptions).

set -euo pipefail

PROJECT_ID="${1:?PROJECT_ID required}"
ENV="${2:?ENV required (e.g. staging, prod)}"
MAX_DELIVERY_ATTEMPTS="${3:-5}"

DLQ_TOPIC="worker-dlq-${ENV}"
PUBSUB_SA="service-$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')@gcp-sa-pubsub.iam.gserviceaccount.com"

WORKER_TOPICS=(
  "user-upload-topic-${ENV}"
  "user-upload-result-topic-${ENV}"
  "checkpoint-analysis-topic-${ENV}"
  "checkpoint-metrics-topic-${ENV}"
  "document-analysis-topic-${ENV}"
)

MANUAL_SUBS=(
  "user-upload-subscription-${ENV}"
  "user-upload-result-subscription-${ENV}"
)

echo "=== Pub/Sub DLQ: project=${PROJECT_ID} env=${ENV} dlq_topic=${DLQ_TOPIC} ==="

if gcloud pubsub topics describe "${DLQ_TOPIC}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "✓ DLQ topic exists: ${DLQ_TOPIC}"
else
  echo "Creating DLQ topic: ${DLQ_TOPIC}"
  gcloud pubsub topics create "${DLQ_TOPIC}" \
    --project="${PROJECT_ID}" \
    --message-retention-duration=7d
  echo "✓ DLQ topic created"
fi

echo "Granting Pub/Sub service agent publisher on DLQ topic..."
gcloud pubsub topics add-iam-policy-binding "${DLQ_TOPIC}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${PUBSUB_SA}" \
  --role="roles/pubsub.publisher" \
  --quiet >/dev/null
echo "✓ IAM binding for ${PUBSUB_SA}"

apply_dlq_to_subscription() {
  local sub="$1"
  if ! gcloud pubsub subscriptions describe "${sub}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "⊘ Subscription not found (skip): ${sub}"
    return 0
  fi
  echo "Updating subscription DLQ policy: ${sub}"
  gcloud pubsub subscriptions update "${sub}" \
    --project="${PROJECT_ID}" \
    --dead-letter-topic="${DLQ_TOPIC}" \
    --max-delivery-attempts="${MAX_DELIVERY_ATTEMPTS}" \
    --quiet
  echo "✓ ${sub}"
}

for sub in "${MANUAL_SUBS[@]}"; do
  apply_dlq_to_subscription "${sub}"
done

for topic in "${WORKER_TOPICS[@]}"; do
  if ! gcloud pubsub topics describe "${topic}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "⊘ Topic not found (skip): ${topic}"
    continue
  fi
  mapfile -t subs < <(
    gcloud pubsub subscriptions list \
      --project="${PROJECT_ID}" \
      --filter="topic:${topic}" \
      --format="value(name)" 2>/dev/null || true
  )
  if [ "${#subs[@]}" -eq 0 ]; then
    echo "⊘ No subscriptions on topic yet: ${topic} (deploy workers, then re-run)"
    continue
  fi
  for sub_path in "${subs[@]}"; do
    sub="${sub_path##*/}"
    if [[ "${sub}" == *"${DLQ_TOPIC}"* ]]; then
      continue
    fi
    apply_dlq_to_subscription "${sub}"
  done
done

echo "=== Pub/Sub DLQ configuration complete ==="
