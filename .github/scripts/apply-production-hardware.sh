#!/usr/bin/env bash
# Orchestrate hardware deploy workflows for a traffic tier.
set -euo pipefail

ENVIRONMENT="${1:?environment required}"
TIER="${2:?tier required}"
SKIP_AGENT="${SKIP_AGENT:-false}"
SKIP_WEBAPP="${SKIP_WEBAPP:-false}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

run_workflow() {
  local workflow_file="$1"
  shift
  local extra_flags=("$@")
  echo "==> Dispatching ${workflow_file} (environment=${ENVIRONMENT}, traffic_tier=${TIER})"
  gh workflow run "$workflow_file" \
    --repo "$REPO" \
    -f "environment=${ENVIRONMENT}" \
    -f "traffic_tier=${TIER}" \
    "${extra_flags[@]}"
  local run_id
  run_id="$(gh run list --workflow="$workflow_file" --repo "$REPO" --limit 1 --json databaseId -q '.[0].databaseId')"
  echo "    Run id: ${run_id}"
  gh run watch "$run_id" --repo "$REPO" --exit-status
}

# Optional: persist tier on GitHub environment for drift audits
if [[ "${SET_GITHUB_VARS:-true}" == "true" ]]; then
  pip install -q pyyaml
  python3 .github/scripts/hardware_tier.py \
    --environment "$ENVIRONMENT" \
    --tier "$TIER" \
    set-github-vars \
    --repo "$REPO" || echo "Warning: could not set GitHub variables (needs admin: write)"
fi

if [[ "$SKIP_AGENT" != "true" ]]; then
  run_workflow deploy-homecare-agent.yaml -f "action=update"
fi

run_workflow deploy-homecare-agent-proxy.yaml

for wf in \
  deploy-checkpoint-analysis.yaml \
  deploy-document-analysis.yaml \
  deploy-checkpoint-metrics.yaml \
  deploy-pubsub-user-docs.yaml \
  deploy-report-generation.yaml; do
  run_workflow "$wf"
done

if [[ "$SKIP_WEBAPP" != "true" ]]; then
  run_workflow deploy-webapp-apphosting.yaml
fi

echo "All hardware deploy workflows completed for tier=${TIER}"
