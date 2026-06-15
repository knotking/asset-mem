#!/usr/bin/env bash
# Orchestrate hardware deploy workflows for a traffic tier.
set -euo pipefail

ENVIRONMENT="${1:?environment required}"
TIER="${2:?tier required}"
SKIP_AGENT="${SKIP_AGENT:-false}"
SKIP_WEBAPP="${SKIP_WEBAPP:-false}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
# Seconds between status polls while waiting for child workflow runs.
WATCH_INTERVAL="${WATCH_INTERVAL:-180}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

RUN_IDS=()

dispatch_workflow() {
  local workflow_file="$1"
  shift
  local extra_flags=("$@")
  echo "==> Dispatching ${workflow_file} (environment=${ENVIRONMENT}, traffic_tier=${TIER})"
  local out
  out="$(gh workflow run "$workflow_file" \
    --repo "$REPO" \
    -f "environment=${ENVIRONMENT}" \
    -f "traffic_tier=${TIER}" \
    "${extra_flags[@]}" 2>&1)"
  echo "$out"
  local run_id
  run_id="$(echo "$out" | sed -n 's|.*/actions/runs/\([0-9][0-9]*\).*|\1|p' | head -1)"
  if [[ -z "$run_id" ]]; then
    sleep 3
    run_id="$(gh run list --workflow="$workflow_file" --repo "$REPO" --limit 1 --json databaseId -q '.[0].databaseId')"
  fi
  echo "    Run id: ${run_id}"
  RUN_IDS+=("$run_id")
}

wait_for_all_runs() {
  if [[ ${#RUN_IDS[@]} -eq 0 ]]; then
    echo "No child workflows dispatched."
    return 0
  fi

  echo ""
  echo "Waiting for ${#RUN_IDS[@]} workflow run(s) (poll every ${WATCH_INTERVAL}s)..."
  local failed=0
  while true; do
    local pending=0
    failed=0
    for run_id in "${RUN_IDS[@]}"; do
      local status conclusion
      status="$(gh run view "$run_id" --repo "$REPO" --json status -q .status)"
      conclusion="$(gh run view "$run_id" --repo "$REPO" --json conclusion -q .conclusion)"
      if [[ "$status" != "completed" ]]; then
        pending=$((pending + 1))
        echo "  ${run_id}: ${status}"
      elif [[ "$conclusion" != "success" ]]; then
        failed=$((failed + 1))
        echo "::error::Run ${run_id} finished with ${conclusion}"
      else
        echo "  ${run_id}: success"
      fi
    done
    if [[ "$pending" -eq 0 ]]; then
      if [[ "$failed" -gt 0 ]]; then
        echo "::error::${failed} child workflow run(s) failed"
        return 1
      fi
      return 0
    fi
    sleep "$WATCH_INTERVAL"
  done
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

echo "Dispatching hardware deploy workflows in parallel..."

if [[ "$SKIP_AGENT" != "true" ]]; then
  dispatch_workflow deploy-homecare-agent.yaml -f "action=update"
fi

dispatch_workflow deploy-homecare-agent-proxy.yaml

for wf in \
  deploy-checkpoint-analysis.yaml \
  deploy-document-analysis.yaml \
  deploy-checkpoint-metrics.yaml \
  deploy-pubsub-user-docs.yaml \
  deploy-report-generation.yaml; do
  dispatch_workflow "$wf"
done

if [[ "$SKIP_WEBAPP" != "true" ]]; then
  dispatch_workflow deploy-webapp-apphosting.yaml
fi

wait_for_all_runs

echo "All hardware deploy workflows completed for tier=${TIER}"
