#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
unset AWS_PROFILE AWS_DEFAULT_PROFILE AWS_SESSION_TOKEN AWS_SECURITY_TOKEN
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
export AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null
export AWS_DEFAULT_REGION=us-east-1 AWS_REGION=us-east-1 AWS_EC2_METADATA_DISABLED=true
export AWS_ENDPOINT_URL=http://127.0.0.1:4566
export AWS_PAGER='' AWS_CLI_AUTO_PROMPT=off
exec ./node_modules/.bin/serverless "$@" --config serverless.yml --stage local
