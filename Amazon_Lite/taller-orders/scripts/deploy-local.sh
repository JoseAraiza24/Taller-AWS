#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/serverless-local.sh deploy "$@"
node scripts/mostrar-endpoints.cjs
