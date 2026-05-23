#!/usr/bin/env bash
# Resolve hardware tier into GITHUB_ENV for deploy workflows.
# Usage: resolve-hardware-env.sh <environment> <tier>
set -euo pipefail

ENVIRONMENT="${1:?environment required (staging|prod)}"
TIER="${2:?tier required (idle|ph|scale_10x|scale_100x)}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pip install -q pyyaml
python3 .github/scripts/hardware_tier.py --environment "$ENVIRONMENT" --tier "$TIER" export-env
